'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

const EVENT_NAME = 'Event 26';
const START_HOUR = 7;
const END_HOUR = 21;

type Staff = {
  id: string;
  full_name: string;
  employee_code: string | null;
  phone: string | null;
  is_active: boolean;
};

type Sector = {
  id: string;
  name: string;
  name_ar: string | null;
};

type Assignment = {
  id: string;
  event_id: string;
  staff_id: string;
  sector_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

type Event = {
  id: string;
  name: string;
  is_active: boolean;
};

const statusLabels: Record<string, string> = {
  planned: 'مخطط',
  sent: 'مرسل',
  acknowledged: 'مؤكد',
  active: 'نشط',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

function formatTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatDate(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat('ar-EG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatInputTime(value: string) {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);

  if (Number.isNaN(hour)) return '';

  const period = hour >= 12 ? 'م' : 'ص';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${period}`;
}

function createTimeOptions() {
  const options: string[] = [];

  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    for (const minute of [0, 15, 30, 45]) {
      if (hour === END_HOUR && minute > 0) {
        continue;
      }

      options.push(
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(
          2,
          '0'
        )}`
      );
    }
  }

  return options;
}

const timeOptions = createTimeOptions();

export default function AssignmentsPage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [title, setTitle] = useState('');

  const [assignmentDate, setAssignmentDate] = useState(() => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  });

  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:00');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const activeStaff = useMemo(() => {
    return staff.filter((person) => person.is_active);
  }, [staff]);

  const staffMap = useMemo(() => {
    return new Map(staff.map((person) => [person.id, person]));
  }, [staff]);

  const sectorMap = useMemo(() => {
    return new Map(sectors.map((sector) => [sector.id, sector]));
  }, [sectors]);

  async function loadData() {
    setLoading(true);
    setErrorMessage('');

    try {
      const {
        data: eventData,
        error: eventError,
      } = await supabase
        .from('events')
        .select('id, name, is_active')
        .eq('name', EVENT_NAME)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (eventError) {
        throw eventError;
      }

      if (!eventData) {
        throw new Error(
          `لم يتم العثور على الفعالية النشطة "${EVENT_NAME}".`
        );
      }

      setEvent(eventData);

      const [
        { data: staffData, error: staffError },
        { data: sectorData, error: sectorError },
        {
          data: assignmentData,
          error: assignmentError,
        },
      ] = await Promise.all([
        supabase
          .from('staff')
          .select(
            'id, full_name, employee_code, phone, is_active'
          )
          .order('employee_code', {
            ascending: true,
          }),

        supabase
          .from('sectors')
          .select('id, name, name_ar')
          .order('name_ar', {
            ascending: true,
          }),

        supabase
          .from('assignments')
          .select(
            'id, event_id, staff_id, sector_id, title, starts_at, ends_at, status'
          )
          .eq('event_id', eventData.id)
          .neq('status', 'cancelled')
          .order('starts_at', {
            ascending: true,
          }),
      ]);

      if (staffError) {
        throw staffError;
      }

      if (sectorError) {
        throw sectorError;
      }

      if (assignmentError) {
        throw assignmentError;
      }

      setStaff(staffData ?? []);
      setSectors(sectorData ?? []);
      setAssignments(assignmentData ?? []);
    } catch (error) {
      console.warn(
        'Load assignments warning:',
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل بيانات التكليفات.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function validateTimes() {
    if (!assignmentDate) {
      return 'اختر تاريخ التكليف.';
    }

    if (!startTime || !endTime) {
      return 'اختر وقت البداية والنهاية.';
    }

    if (startTime < '07:00' || startTime >= '21:00') {
      return 'وقت البداية يجب أن يكون بين 7:00 ص و9:00 م.';
    }

    if (endTime <= '07:00' || endTime > '21:00') {
      return 'وقت النهاية يجب أن يكون بين 7:00 ص و9:00 م.';
    }

    if (endTime <= startTime) {
      return 'وقت النهاية يجب أن يكون بعد وقت البداية وفي نفس اليوم.';
    }

    return '';
  }

  async function syncStaffSector(
    currentEventId: string,
    currentStaffId: string,
    currentSectorId: string
  ) {
    const { data: existingRow, error: existingError } = await supabase
      .from('event_staff')
      .select('staff_id, status')
      .eq('event_id', currentEventId)
      .eq('staff_id', currentStaffId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingRow) {
      const { error: updateError } = await supabase
        .from('event_staff')
        .update({
          sector_id: currentSectorId,
        })
        .eq('event_id', currentEventId)
        .eq('staff_id', currentStaffId);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    const { error: insertError } = await supabase
      .from('event_staff')
      .insert({
        event_id: currentEventId,
        staff_id: currentStaffId,
        sector_id: currentSectorId,
        status: 'not_arrived',
      });

    if (insertError) {
      throw insertError;
    }
  }

  async function createAssignment() {
    setMessage('');
    setErrorMessage('');

    if (!event) {
      setErrorMessage('الفعالية غير متاحة.');
      return;
    }

    if (!selectedStaffId) {
      setErrorMessage('اختر الموظف.');
      return;
    }

    if (!selectedSectorId) {
      setErrorMessage('اختر القطاع.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('اكتب اسم المهمة.');
      return;
    }

    const timeError = validateTimes();

    if (timeError) {
      setErrorMessage(timeError);
      return;
    }

    setSaving(true);

    try {
      const startsAt = `${assignmentDate}T${startTime}:00`;
      const endsAt = `${assignmentDate}T${endTime}:00`;

      const { error } = await supabase
        .from('assignments')
        .insert({
          event_id: event.id,
          staff_id: selectedStaffId,
          sector_id: selectedSectorId,
          title: title.trim(),
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'planned',
        });

      if (error) {
        throw error;
      }

      await syncStaffSector(
        event.id,
        selectedStaffId,
        selectedSectorId
      );

      setMessage(
        'تم إنشاء التكليف وربط الموظف بالقطاع بنجاح.'
      );

      setTitle('');
      setSelectedStaffId('');
      setSelectedSectorId('');
      setStartTime('07:00');
      setEndTime('08:00');

      await loadData();
    } catch (error) {
      console.warn(
        'Create assignment warning:',
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر إنشاء التكليف.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(id: string) {
    const confirmed = window.confirm(
      'هل تريد حذف هذا التكليف نهائيًا؟'
    );

    if (!confirmed) {
      return;
    }

    setMessage('');
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setMessage('تم حذف التكليف بنجاح.');

      await loadData();
    } catch (error) {
      console.warn(
        'Delete assignment warning:',
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر حذف التكليف.'
      );
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              التكليفات
            </h1>

            <p className="mt-2 text-slate-500">
              توزيع فريق العمل ومتابعة التكليفات —{' '}
              {EVENT_NAME}
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={
                loading ? 'animate-spin' : ''
              }
            />

            تحديث
          </button>
        </header>

        {message && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            <CheckCircle2 size={22} />

            <span>{message}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <X size={22} />

            <span>{errorMessage}</span>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3 text-blue-600">
              <Users size={24} />

              <span className="font-semibold">
                الموظفون
              </span>
            </div>

            <div className="text-3xl font-bold">
              {activeStaff.length}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3 text-emerald-600">
              <MapPin size={24} />

              <span className="font-semibold">
                القطاعات
              </span>
            </div>

            <div className="text-3xl font-bold">
              {sectors.length}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3 text-violet-600">
              <CalendarDays size={24} />

              <span className="font-semibold">
                التكليفات
              </span>
            </div>

            <div className="text-3xl font-bold">
              {assignments.length}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Plus size={22} />
            </div>

            <div>
              <h2 className="text-xl font-bold">
                إضافة تكليف جديد
              </h2>

              <p className="text-sm text-slate-500">
                الوقت المسموح من 7:00 ص حتى 9:00 م فقط
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="font-semibold">
                الموظف
              </span>

              <select
                value={selectedStaffId}
                onChange={(e) =>
                  setSelectedStaffId(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">
                  اختر الموظف
                </option>

                {activeStaff.map((person) => (
                  <option
                    key={person.id}
                    value={person.id}
                  >
                    {person.employee_code
                      ? `${person.employee_code} — `
                      : ''}
                    {person.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="font-semibold">
                القطاع
              </span>

              <select
                value={selectedSectorId}
                onChange={(e) =>
                  setSelectedSectorId(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">
                  اختر القطاع
                </option>

                {sectors.map((sector) => (
                  <option
                    key={sector.id}
                    value={sector.id}
                  >
                    {sector.name_ar || sector.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="font-semibold">
                اسم المهمة
              </span>

              <input
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                placeholder="مثال: تنظيم بوابة الدخول"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">
                التاريخ
              </span>

              <input
                type="date"
                value={assignmentDate}
                onChange={(e) =>
                  setAssignmentDate(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">
                وقت البداية
              </span>

              <select
                value={startTime}
                onChange={(e) =>
                  setStartTime(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                {timeOptions
                  .filter((time) => time !== '21:00')
                  .map((time) => (
                    <option
                      key={time}
                      value={time}
                    >
                      {formatInputTime(time)}
                    </option>
                  ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="font-semibold">
                وقت النهاية
              </span>

              <select
                value={endTime}
                onChange={(e) =>
                  setEndTime(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
              >
                {timeOptions
                  .filter((time) => time !== '07:00')
                  .map((time) => (
                    <option
                      key={time}
                      value={time}
                    >
                      {formatInputTime(time)}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
            عند إنشاء التكليف، يتم ربط الموظف تلقائيًا بنفس القطاع حتى
            يظهر في صفحة القطاعات.
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Clock3 size={18} />

              <span>
                {formatInputTime(startTime)} →{' '}
                {formatInputTime(endTime)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={createAssignment}
            disabled={saving || loading}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={20} />

            {saving
              ? 'جاري الحفظ...'
              : 'إنشاء التكليف'}
          </button>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              سجل التكليفات
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              جميع التكليفات الخاصة بـ {EVENT_NAME}
            </p>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500">
              جاري تحميل التكليفات...
            </div>
          ) : assignments.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 py-12 text-center text-slate-500">
              لا توجد تكليفات حتى الآن.
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const person = staffMap.get(
                  assignment.staff_id
                );

                const sector = assignment.sector_id
                  ? sectorMap.get(
                      assignment.sector_id
                    )
                  : null;

                return (
                  <div
                    key={assignment.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">
                          {assignment.title}
                        </span>

                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {statusLabels[
                            assignment.status
                          ] ||
                            assignment.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users size={16} />

                          {person?.employee_code
                            ? `${person.employee_code} — `
                            : ''}

                          {person?.full_name ||
                            'موظف غير معروف'}
                        </span>

                        <span className="flex items-center gap-1">
                          <MapPin size={16} />

                          {sector?.name_ar ||
                            sector?.name ||
                            'بدون قطاع'}
                        </span>

                        <span className="flex items-center gap-1">
                          <CalendarDays size={16} />

                          {formatDate(
                            assignment.starts_at
                          )}
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock3 size={16} />

                          {formatTime(
                            assignment.starts_at
                          )}{' '}
                          →{' '}
                          {formatTime(
                            assignment.ends_at
                          )}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        deleteAssignment(
                          assignment.id
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 font-semibold text-red-600 hover:bg-red-100"
                    >
                      <Trash2 size={18} />

                      حذف
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}