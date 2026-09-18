'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  Coffee,
  Pencil,
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
const DEFAULT_DURATION = 30;

type EventRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type StaffRow = {
  id: string;
  full_name: string;
  employee_code: string;
  phone: string | null;
  is_active: boolean;
};

type BreakRow = {
  id: string;
  event_id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
};

type BreakView = BreakRow & {
  staffName: string;
  employeeCode: string;
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function formatArabicDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateOnly(value));
}

function localDateFromTimestamp(value: string) {
  return formatDateInput(new Date(value));
}

function formatTime12(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function formatTimeValue(value: string) {
  const date = new Date(value);

  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

function createTimeOptions() {
  const result: string[] = [];

  for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === END_HOUR && minute !== 0) {
        continue;
      }

      result.push(
        `${String(hour).padStart(2, '0')}:${String(
          minute
        ).padStart(2, '0')}`
      );
    }
  }

  return result;
}

function formatTimeOption(value: string) {
  const [hour, minute] = value.split(':').map(Number);

  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

function makeTimestamp(dateString: string, timeString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hour, minute] = timeString.split(':').map(Number);

  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0
  ).toISOString();
}

function getDurationMinutes(
  startsAt: string,
  endsAt: string
) {
  return Math.round(
    (new Date(endsAt).getTime() -
      new Date(startsAt).getTime()) /
      60000
  );
}

function isInsideBusinessWindow(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  const total = hour * 60 + minute;

  return (
    total >= START_HOUR * 60 &&
    total <= END_HOUR * 60
  );
}

export default function BreaksPage() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [breaks, setBreaks] = useState<BreakView[]>([]);

  const [selectedDate, setSelectedDate] = useState(
    formatDateInput(new Date())
  );

  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('07:30');

  const [editingBreakId, setEditingBreakId] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const timeOptions = useMemo(
    () => createTimeOptions(),
    []
  );

  const loadData = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setErrorMessage('');

        const { data: eventData, error: eventError } =
          await supabase
            .from('events')
            .select('id, name, is_active')
            .eq('name', EVENT_NAME)
            .eq('is_active', true)
            .maybeSingle();

        if (eventError) {
          throw eventError;
        }

        if (!eventData) {
          throw new Error('Event 26 not found');
        }

        setEvent(eventData);

        const [
          staffResult,
          breaksResult,
        ] = await Promise.all([
          supabase
            .from('staff')
            .select(
              'id, full_name, employee_code, phone, is_active'
            )
            .eq('is_active', true)
            .order('employee_code', {
              ascending: true,
            }),

          supabase
            .from('breaks')
            .select(
              'id, event_id, staff_id, starts_at, ends_at, duration_minutes'
            )
            .eq('event_id', eventData.id)
            .order('starts_at', {
              ascending: true,
            }),
        ]);

        if (staffResult.error) {
          throw staffResult.error;
        }

        if (breaksResult.error) {
          throw breaksResult.error;
        }

        const staffData = staffResult.data ?? [];
        const breakData = breaksResult.data ?? [];

        setStaff(staffData);

        const staffMap = new Map(
          staffData.map((person) => [person.id, person])
        );

        const visibleBreaks: BreakView[] = breakData
          .filter(
            (item) =>
              localDateFromTimestamp(item.starts_at) ===
              selectedDate
          )
          .map((item) => {
            const person = staffMap.get(item.staff_id);

            return {
              ...item,
              staffName:
                person?.full_name ?? 'موظف غير معروف',
              employeeCode:
                person?.employee_code ?? '---',
            };
          });

        setBreaks(visibleBreaks);
      } catch (error) {
        console.warn('Breaks load error:', error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل الاستراحات'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  async function syncStaffStatuses(eventId: string) {
    const now = Date.now();

    const { data: eventStaffRows, error } = await supabase
      .from('event_staff')
      .select('staff_id, status')
      .eq('event_id', eventId);

    if (error) {
      console.warn('event_staff status read error:', error);
      return;
    }

    const { data: breakRows, error: breakError } = await supabase
      .from('breaks')
      .select('staff_id, starts_at, ends_at')
      .eq('event_id', eventId);

    if (breakError) {
      console.warn('break status read error:', breakError);
      return;
    }

    const currentBreaks = breakRows ?? [];

    for (const row of eventStaffRows ?? []) {
      if (row.status === 'checked_out') {
        continue;
      }

      const isOnBreak = currentBreaks.some((item) => {
        const starts = new Date(item.starts_at).getTime();
        const ends = item.ends_at
          ? new Date(item.ends_at).getTime()
          : Number.POSITIVE_INFINITY;

        return (
          item.staff_id === row.staff_id &&
          starts <= now &&
          now < ends
        );
      });

      if (isOnBreak && row.status !== 'break') {
        await supabase
          .from('event_staff')
          .update({
            status: 'break',
          })
          .eq('event_id', eventId)
          .eq('staff_id', row.staff_id);
      }

      if (!isOnBreak && row.status === 'break') {
        await supabase
          .from('event_staff')
          .update({
            status: 'available',
          })
          .eq('event_id', eventId)
          .eq('staff_id', row.staff_id);
      }
    }
  }

  useEffect(() => {
    if (!event?.id) {
      return;
    }

    syncStaffStatuses(event.id);
  }, [event?.id, breaks]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!event?.id) {
        return;
      }

      await syncStaffStatuses(event.id);
      await loadData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [event?.id, loadData]);

  function resetForm() {
    setSelectedStaffId('');
    setStartTime('07:00');
    setEndTime('07:30');
    setEditingBreakId(null);
  }

  function openEdit(item: BreakView) {
    setEditingBreakId(item.id);
    setSelectedStaffId(item.staff_id);
    setStartTime(formatTimeValue(item.starts_at));
    setEndTime(
      item.ends_at
        ? formatTimeValue(item.ends_at)
        : '07:30'
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveBreak() {
    if (!event?.id) {
      return;
    }

    setMessage('');
    setErrorMessage('');

    if (!selectedStaffId) {
      setErrorMessage('اختر الموظف أولًا.');
      return;
    }

    if (
      !isInsideBusinessWindow(startTime) ||
      !isInsideBusinessWindow(endTime)
    ) {
      setErrorMessage(
        'وقت الاستراحة يجب أن يكون من 7:00 AM إلى 9:00 PM فقط.'
      );
      return;
    }

    const [startHour, startMinute] = startTime
      .split(':')
      .map(Number);

    const [endHour, endMinute] = endTime
      .split(':')
      .map(Number);

    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;

    if (endTotal <= startTotal) {
      setErrorMessage(
        'وقت نهاية الاستراحة يجب أن يكون بعد بدايتها.'
      );
      return;
    }

    const startsAt = makeTimestamp(
      selectedDate,
      startTime
    );

    const endsAt = makeTimestamp(
      selectedDate,
      endTime
    );

    const durationMinutes = endTotal - startTotal;

    setSaving(true);

    try {
      if (editingBreakId) {
        const { error } = await supabase
          .from('breaks')
          .update({
            staff_id: selectedStaffId,
            starts_at: startsAt,
            ends_at: endsAt,
            duration_minutes: durationMinutes,
          })
          .eq('id', editingBreakId);

        if (error) {
          throw error;
        }

        setMessage('تم تعديل الاستراحة بنجاح.');
      } else {
        const { error } = await supabase
          .from('breaks')
          .insert({
            event_id: event.id,
            staff_id: selectedStaffId,
            starts_at: startsAt,
            ends_at: endsAt,
            duration_minutes: durationMinutes,
          });

        if (error) {
          throw error;
        }

        setMessage('تم إنشاء الاستراحة بنجاح.');
      }

      resetForm();

      await loadData(false);
      await syncStaffStatuses(event.id);
    } catch (error) {
      console.warn('Break save error:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر حفظ الاستراحة.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteBreak(id: string) {
    if (!event?.id) {
      return;
    }

    setMessage('');
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('breaks')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setMessage('تم حذف الاستراحة من قاعدة البيانات.');

      await loadData(false);
      await syncStaffStatuses(event.id);
    } catch (error) {
      console.warn('Break delete error:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر حذف الاستراحة.'
      );
    }
  }

  function getBreakState(item: BreakView) {
    const now = Date.now();
    const start = new Date(item.starts_at).getTime();
    const end = item.ends_at
      ? new Date(item.ends_at).getTime()
      : Number.POSITIVE_INFINITY;

    if (start > now) {
      return {
        label: 'مجدولة',
        className:
          'border-blue-200 bg-blue-50 text-blue-700',
      };
    }

    if (start <= now && now < end) {
      return {
        label: 'جارية',
        className:
          'border-amber-200 bg-amber-50 text-amber-700',
      };
    }

    return {
      label: 'منتهية',
      className:
        'border-slate-200 bg-slate-100 text-slate-600',
    };
  }

  const activeCount = breaks.filter((item) => {
    const start = new Date(item.starts_at).getTime();
    const end = item.ends_at
      ? new Date(item.ends_at).getTime()
      : Number.POSITIVE_INFINITY;

    return start <= Date.now() && Date.now() < end;
  }).length;

  const scheduledCount = breaks.filter(
    (item) =>
      new Date(item.starts_at).getTime() > Date.now()
  ).length;

  const finishedCount = breaks.filter(
    (item) =>
      item.ends_at &&
      new Date(item.ends_at).getTime() <= Date.now()
  ).length;

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 p-6 text-slate-900"
      >
        <div className="mx-auto max-w-[1500px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          جاري تحميل الاستراحات...
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Coffee size={18} />
              نظام إدارة التشغيل والفعاليات
            </div>

            <h1 className="text-2xl font-bold md:text-3xl">
              Timeline الاستراحات
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              الاستراحة تغيّر حالة الموظف إلى Break أثناء وقتها.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <CalendarDays size={18} />

              <input
                type="date"
                value={selectedDate}
                onChange={(e) =>
                  setSelectedDate(e.target.value)
                }
                className="bg-transparent text-sm outline-none"
              />
            </label>

            <button
              type="button"
              onClick={() => loadData(false)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing ? 'animate-spin' : ''
                }
              />
              تحديث
            </button>
          </div>
        </div>

        {message ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Users size={18} />
              الموظفون
            </div>

            <div className="text-3xl font-bold">
              {staff.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Coffee size={18} />
              إجمالي الاستراحات
            </div>

            <div className="text-3xl font-bold">
              {breaks.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Clock3 size={18} />
              جارية
            </div>

            <div className="text-3xl font-bold">
              {activeCount}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Check size={18} />
              منتهية
            </div>

            <div className="text-3xl font-bold">
              {finishedCount}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              مجدولة: {scheduledCount}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                {editingBreakId
                  ? 'تعديل الاستراحة'
                  : 'إضافة استراحة'}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {formatArabicDate(selectedDate)}
              </p>
            </div>

            {editingBreakId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                <X size={16} />
                إلغاء التعديل
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                الموظف
              </span>

              <select
                value={selectedStaffId}
                onChange={(e) =>
                  setSelectedStaffId(e.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-slate-400"
              >
                <option value="">اختر الموظف</option>

                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.employee_code} — {person.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                البداية
              </span>

              <select
                value={startTime}
                onChange={(e) =>
                  setStartTime(e.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-slate-400"
              >
                {timeOptions.map((time) => (
                  <option key={time} value={time}>
                    {formatTimeOption(time)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                النهاية
              </span>

              <select
                value={endTime}
                onChange={(e) =>
                  setEndTime(e.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-slate-400"
              >
                {timeOptions.map((time) => (
                  <option key={time} value={time}>
                    {formatTimeOption(time)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={saveBreak}
                disabled={saving}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {editingBreakId ? (
                  <>
                    <Check size={17} />
                    حفظ التعديل
                  </>
                ) : (
                  <>
                    <Plus size={17} />
                    إضافة استراحة
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            المسموح من <strong>7:00 AM</strong> إلى{' '}
            <strong>9:00 PM</strong> فقط، ولا توجد استراحات بعد
            9:00 PM.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold">
              استراحات {formatArabicDate(selectedDate)}
            </h2>
          </div>

          {breaks.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              لا توجد استراحات لهذا اليوم.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {breaks.map((item) => {
                const state = getBreakState(item);

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">
                          {item.staffName}
                        </span>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                          {item.employeeCode}
                        </span>

                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-semibold ${state.className}`}
                        >
                          {state.label}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 size={15} />
                          {formatTime12(item.starts_at)}
                          {' - '}
                          {item.ends_at
                            ? formatTime12(item.ends_at)
                            : 'بدون نهاية'}
                        </span>

                        <span>
                          المدة:{' '}
                          {item.duration_minutes ??
                            (item.ends_at
                              ? getDurationMinutes(
                                  item.starts_at,
                                  item.ends_at
                                )
                              : DEFAULT_DURATION)}{' '}
                          دقيقة
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        <Pencil size={16} />
                        تعديل
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteBreak(item.id)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        <Trash2 size={16} />
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}