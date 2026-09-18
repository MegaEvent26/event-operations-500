'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Pencil,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

const EVENT_NAME = 'Event 26';
const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_WIDTH = 140;
const EMPLOYEE_WIDTH = 280;

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

type SectorRow = {
  id: string;
  name: string;
  name_ar: string | null;
};

type AssignmentRow = {
  id: string;
  event_id: string;
  staff_id: string;
  sector_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status:
    | 'planned'
    | 'sent'
    | 'acknowledged'
    | 'active'
    | 'completed'
    | 'cancelled';
};

type TimelineAssignment = AssignmentRow & {
  staffName: string;
  employeeCode: string;
  sectorName: string;
};

type EditMode = 'time' | 'sector' | null;

type EditState = {
  assignment: TimelineAssignment | null;
  mode: EditMode;
  startTime: string;
  endTime: string;
  sectorId: string;
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
  const date = parseDateOnly(value);

  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatTime12(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function getLocalDateString(value: string) {
  return formatDateInput(new Date(value));
}

function getTimeParts(value: string) {
  const date = new Date(value);

  return {
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

function formatTimeForSelect(value: string) {
  const { hour, minute } = getTimeParts(value);

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(
    2,
    '0'
  )}`;
}

function minutesFromStartOfTimeline(value: string) {
  const date = new Date(value);

  const hour = date.getHours();
  const minute = date.getMinutes();

  return (hour - START_HOUR) * 60 + minute;
}

function getDurationMinutes(startsAt: string, endsAt: string) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  return Math.max(0, Math.round((end - start) / 60000));
}

function getStatusLabel(status: AssignmentRow['status']) {
  switch (status) {
    case 'planned':
      return 'مخطط';
    case 'sent':
      return 'مرسل';
    case 'acknowledged':
      return 'مؤكد';
    case 'active':
      return 'نشط';
    case 'completed':
      return 'مكتمل';
    case 'cancelled':
      return 'ملغي';
    default:
      return status;
  }
}

function getStatusClass(status: AssignmentRow['status']) {
  switch (status) {
    case 'planned':
      return 'border-slate-200 bg-slate-100 text-slate-700';

    case 'sent':
      return 'border-blue-200 bg-blue-50 text-blue-700';

    case 'acknowledged':
      return 'border-violet-200 bg-violet-50 text-violet-700';

    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';

    case 'completed':
      return 'border-gray-200 bg-gray-100 text-gray-700';

    case 'cancelled':
      return 'border-red-200 bg-red-50 text-red-700';

    default:
      return 'border-gray-200 bg-gray-100 text-gray-700';
  }
}

function getAssignmentStyle(assignment: TimelineAssignment) {
  const rawStart = minutesFromStartOfTimeline(assignment.starts_at);
  const rawDuration = getDurationMinutes(
    assignment.starts_at,
    assignment.ends_at
  );

  const timelineEndMinutes = (END_HOUR - START_HOUR) * 60;

  const start = Math.max(0, rawStart);
  const end = Math.min(
    timelineEndMinutes,
    rawStart + Math.max(rawDuration, 15)
  );

  const duration = Math.max(15, end - start);

  return {
    right: `${(start / 60) * HOUR_WIDTH}px`,
    width: `${(duration / 60) * HOUR_WIDTH}px`,
  };
}

function createTimeOptions() {
  const options: string[] = [];

  for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
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

function formatSelectTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);

  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

function combineDateAndTime(dateString: string, timeString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hour, minute] = timeString.split(':').map(Number);

  const localDate = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0
  );

  return localDate.toISOString();
}

function isTimeInsideBusinessWindow(value: string) {
  const [hour, minute] = value.split(':').map(Number);

  const totalMinutes = hour * 60 + minute;
  const startMinutes = START_HOUR * 60;
  const endMinutes = END_HOUR * 60;

  return (
    totalMinutes >= startMinutes &&
    totalMinutes <= endMinutes
  );
}

export default function TimelinePage() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [assignments, setAssignments] = useState<TimelineAssignment[]>(
    []
  );

  const [selectedDate, setSelectedDate] = useState(
    formatDateInput(new Date())
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [editState, setEditState] = useState<EditState>({
    assignment: null,
    mode: null,
    startTime: '07:00',
    endTime: '08:00',
    sectorId: '',
  });

  const [savingEdit, setSavingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState('');

  const hours = useMemo(
    () =>
      Array.from(
        { length: END_HOUR - START_HOUR },
        (_, index) => START_HOUR + index
      ),
    []
  );

  const timeOptions = useMemo(
    () => createTimeOptions(),
    []
  );

  const loadTimeline = useCallback(
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
          sectorsResult,
          assignmentsResult,
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

        if (staffResult.error) {
          throw staffResult.error;
        }

        if (sectorsResult.error) {
          throw sectorsResult.error;
        }

        if (assignmentsResult.error) {
          throw assignmentsResult.error;
        }

        const staffData = staffResult.data ?? [];
        const sectorData = sectorsResult.data ?? [];
        const assignmentData = assignmentsResult.data ?? [];

        setStaff(staffData);
        setSectors(sectorData);

        const staffMap = new Map(
          staffData.map((person) => [person.id, person])
        );

        const sectorMap = new Map(
          sectorData.map((sector) => [sector.id, sector])
        );

        const mappedAssignments: TimelineAssignment[] =
          assignmentData
            .filter(
              (assignment) =>
                getLocalDateString(assignment.starts_at) ===
                selectedDate
            )
            .map((assignment) => {
              const person = staffMap.get(assignment.staff_id);
              const sector = sectorMap.get(assignment.sector_id);

              return {
                ...assignment,
                staffName:
                  person?.full_name ?? 'موظف غير معروف',
                employeeCode:
                  person?.employee_code ?? '---',
                sectorName:
                  sector?.name_ar ||
                  sector?.name ||
                  'قطاع غير معروف',
              };
            });

        setAssignments(mappedAssignments);
      } catch (error) {
        console.warn('Timeline load error:', error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل الخط الزمني'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    loadTimeline(true);
  }, [loadTimeline]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTimeline(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [loadTimeline]);

  const assignmentByStaff = useMemo(() => {
    const map = new Map<string, TimelineAssignment[]>();

    for (const assignment of assignments) {
      const current = map.get(assignment.staff_id) ?? [];

      current.push(assignment);

      map.set(assignment.staff_id, current);
    }

    return map;
  }, [assignments]);

  const assignedStaffIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.staff_id)),
    [assignments]
  );

  const activeStaff = useMemo(
    () => staff.filter((person) => person.is_active),
    [staff]
  );

  const activeAssignmentsCount = useMemo(
    () =>
      assignments.filter(
        (assignment) => assignment.status !== 'completed'
      ).length,
    [assignments]
  );

  const completedAssignmentsCount = useMemo(
    () =>
      assignments.filter(
        (assignment) => assignment.status === 'completed'
      ).length,
    [assignments]
  );

  function openTimeEditor(assignment: TimelineAssignment) {
    setEditMessage('');

    setEditState({
      assignment,
      mode: 'time',
      startTime: formatTimeForSelect(assignment.starts_at),
      endTime: formatTimeForSelect(assignment.ends_at),
      sectorId: assignment.sector_id,
    });
  }

  function openSectorEditor(assignment: TimelineAssignment) {
    setEditMessage('');

    setEditState({
      assignment,
      mode: 'sector',
      startTime: formatTimeForSelect(assignment.starts_at),
      endTime: formatTimeForSelect(assignment.ends_at),
      sectorId: assignment.sector_id,
    });
  }

  function closeEditor() {
    if (savingEdit) {
      return;
    }

    setEditState({
      assignment: null,
      mode: null,
      startTime: '07:00',
      endTime: '08:00',
      sectorId: '',
    });

    setEditMessage('');
  }

  async function saveEdit() {
    if (!editState.assignment || !editState.mode) {
      return;
    }

    setSavingEdit(true);
    setEditMessage('');

    try {
      if (editState.mode === 'time') {
        if (
          !isTimeInsideBusinessWindow(editState.startTime) ||
          !isTimeInsideBusinessWindow(editState.endTime)
        ) {
          throw new Error(
            'الوقت يجب أن يكون من 7:00 AM إلى 9:00 PM فقط.'
          );
        }

        const [startHour, startMinute] = editState.startTime
          .split(':')
          .map(Number);

        const [endHour, endMinute] = editState.endTime
          .split(':')
          .map(Number);

        const startTotal = startHour * 60 + startMinute;
        const endTotal = endHour * 60 + endMinute;

        if (endTotal <= startTotal) {
          throw new Error(
            'وقت النهاية يجب أن يكون بعد وقت البداية.'
          );
        }

        const newStartsAt = combineDateAndTime(
          selectedDate,
          editState.startTime
        );

        const newEndsAt = combineDateAndTime(
          selectedDate,
          editState.endTime
        );

        const { error } = await supabase
          .from('assignments')
          .update({
            starts_at: newStartsAt,
            ends_at: newEndsAt,
          })
          .eq('id', editState.assignment.id);

        if (error) {
          throw error;
        }
      }

      if (editState.mode === 'sector') {
        if (!editState.sectorId) {
          throw new Error('اختر القطاع الجديد.');
        }

        const { error } = await supabase
          .from('assignments')
          .update({
            sector_id: editState.sectorId,
          })
          .eq('id', editState.assignment.id);

        if (error) {
          throw error;
        }
      }

      await loadTimeline(false);

      closeEditor();
    } catch (error) {
      console.warn('Assignment update error:', error);

      setEditMessage(
        error instanceof Error
          ? error.message
          : 'تعذر حفظ التعديل.'
      );
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 p-6 text-slate-900"
      >
        <div className="mx-auto max-w-[1700px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            جاري تحميل الخط الزمني...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6"
    >
      <div className="mx-auto max-w-[1700px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Clock3 size={18} />
              نظام إدارة التشغيل والفعاليات
            </div>

            <h1 className="text-2xl font-bold md:text-3xl">
              الخط الزمني للتكليفات
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              التكليفات يتم جلبها مباشرة من قاعدة البيانات.
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
              onClick={() => loadTimeline(false)}
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

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            تعذر تحميل الخط الزمني: {errorMessage}
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                الموظفون
              </span>

              <Users size={20} />
            </div>

            <div className="text-3xl font-bold">
              {activeStaff.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                التكليفات
              </span>

              <Clock3 size={20} />
            </div>

            <div className="text-3xl font-bold">
              {assignments.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                الفعالة
              </span>

              <MapPin size={20} />
            </div>

            <div className="text-3xl font-bold">
              {activeAssignmentsCount}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                المكتملة
              </span>

              <Check size={20} />
            </div>

            <div className="text-3xl font-bold">
              {completedAssignmentsCount}
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-lg font-bold">
            {formatArabicDate(selectedDate)}
          </div>

          <div className="mt-1 text-sm text-slate-500">
            {event?.name ?? EVENT_NAME} — من 7:00 AM إلى
            9:00 PM
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            className="min-w-max"
            style={{
              width:
                EMPLOYEE_WIDTH +
                (END_HOUR - START_HOUR) * HOUR_WIDTH,
            }}
          >
            <div
              className="grid border-b border-slate-200 bg-white"
              style={{
                gridTemplateColumns: `${EMPLOYEE_WIDTH}px 1fr`,
              }}
            >
              <div className="sticky right-0 z-30 flex items-center border-l border-slate-200 bg-white px-5 py-4 font-bold">
                الموظف
              </div>

              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${END_HOUR - START_HOUR}, ${HOUR_WIDTH}px)`,
                }}
              >
                {hours.map((hour) => {
                  const hour12 =
                    hour > 12 ? hour - 12 : hour;

                  const period = hour >= 12 ? 'PM' : 'AM';

                  return (
                    <div
                      key={hour}
                      className="flex h-16 items-center justify-center border-l border-slate-200 text-sm font-semibold text-slate-600"
                    >
                      {hour12}:00 {period}
                    </div>
                  );
                })}
              </div>
            </div>

            {activeStaff.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                لا يوجد موظفون نشطون حاليًا.
              </div>
            ) : (
              activeStaff.map((person) => {
                const personAssignments =
                  assignmentByStaff.get(person.id) ?? [];

                return (
                  <div
                    key={person.id}
                    className="grid border-b border-slate-200 last:border-b-0"
                    style={{
                      gridTemplateColumns: `${EMPLOYEE_WIDTH}px 1fr`,
                    }}
                  >
                    <div className="sticky right-0 z-10 min-h-[124px] border-l border-slate-200 bg-white p-4">
                      <div className="font-bold">
                        {person.full_name}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        كود الموظف: {person.employee_code}
                      </div>

                      <div className="mt-2">
                        {assignedStaffIds.has(person.id) ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            لديه تكليف
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                            بدون تكليف
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className="relative min-h-[124px] bg-slate-50"
                      style={{
                        width:
                          (END_HOUR - START_HOUR) *
                          HOUR_WIDTH,
                        backgroundImage: `
                          repeating-linear-gradient(
                            to left,
                            transparent,
                            transparent ${HOUR_WIDTH - 1}px,
                            rgb(226 232 240) ${HOUR_WIDTH}px
                          )
                        `,
                      }}
                    >
                      {personAssignments.map((assignment) => {
                        const style =
                          getAssignmentStyle(assignment);

                        return (
                          <div
                            key={assignment.id}
                            className={`absolute top-3 overflow-hidden rounded-xl border p-3 shadow-sm ${getStatusClass(
                              assignment.status
                            )}`}
                            style={{
                              ...style,
                              minHeight: '104px',
                            }}
                          >
                            <div className="truncate text-sm font-bold">
                              {assignment.title}
                            </div>

                            <div className="mt-1 flex items-center gap-1 truncate text-xs font-medium">
                              <MapPin size={12} />
                              {assignment.sectorName}
                            </div>

                            <div className="mt-1 truncate text-xs">
                              {formatTime12(
                                assignment.starts_at
                              )}{' '}
                              -{' '}
                              {formatTime12(
                                assignment.ends_at
                              )}
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-1">
                              <span className="inline-flex rounded-full border border-current/10 bg-white/60 px-2 py-0.5 text-[10px] font-semibold">
                                {getStatusLabel(
                                  assignment.status
                                )}
                              </span>

                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  title="تعديل الوقت"
                                  onClick={() =>
                                    openTimeEditor(
                                      assignment
                                    )
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-current/10 bg-white/70 hover:bg-white"
                                >
                                  <Pencil size={14} />
                                </button>

                                <button
                                  type="button"
                                  title="نقل القطاع"
                                  onClick={() =>
                                    openSectorEditor(
                                      assignment
                                    )
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-current/10 bg-white/70 hover:bg-white"
                                >
                                  <ArrowRightLeft
                                    size={14}
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {editState.assignment && editState.mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            dir="rtl"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editState.mode === 'time'
                    ? 'تعديل وقت التكليف'
                    : 'نقل التكليف إلى قطاع آخر'}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editState.assignment.title}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={savingEdit}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {editState.mode === 'time' ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  المسموح فقط من <strong>7:00 AM</strong> إلى{' '}
                  <strong>9:00 PM</strong> وفي نفس اليوم.
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">
                      وقت البداية
                    </span>

                    <select
                      value={editState.startTime}
                      onChange={(e) =>
                        setEditState((current) => ({
                          ...current,
                          startTime: e.target.value,
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-slate-400"
                    >
                      {timeOptions.map((time) => (
                        <option key={time} value={time}>
                          {formatSelectTime(time)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">
                      وقت النهاية
                    </span>

                    <select
                      value={editState.endTime}
                      onChange={(e) =>
                        setEditState((current) => ({
                          ...current,
                          endTime: e.target.value,
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-slate-400"
                    >
                      {timeOptions.map((time) => (
                        <option key={time} value={time}>
                          {formatSelectTime(time)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  الموظف: {editState.assignment.staffName}
                  <br />
                  الكود: {editState.assignment.employeeCode}
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    القطاع الجديد
                  </span>

                  <select
                    value={editState.sectorId}
                    onChange={(e) =>
                      setEditState((current) => ({
                        ...current,
                        sectorId: e.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-slate-400"
                  >
                    <option value="">اختر القطاع</option>

                    {sectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name_ar || sector.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {editMessage ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {editMessage}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={17} />
                {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}
              </button>

              <button
                type="button"
                onClick={closeEditor}
                disabled={savingEdit}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}