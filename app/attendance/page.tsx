'use client';

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  UserCheck,
  UserRound,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MAX_TEAM_SIZE = 500;
const EVENT_NAME = 'Event 26';

type AttendanceStatus =
  | 'not_arrived'
  | 'working'
  | 'available'
  | 'break'
  | 'checked_out';

type AttendanceAction =
  | 'check_in'
  | 'break_start'
  | 'break_end'
  | 'check_out';

type Staff = {
  id: string;
  full_name: string;
  employee_code: string;
  phone: string | null;
  is_active: boolean;
  notes: string | null;
};

type EventStaff = {
  staff_id: string;
  status: AttendanceStatus;
};

type AttendanceLog = {
  id: string;
  staff_id: string;
  action: AttendanceAction;
  action_at: string;
};

type BreakRow = {
  id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
};

type StaffRow = Staff & {
  attendance_status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  break_start_at: string | null;
  break_end_at: string | null;
};

function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'حدث خطأ غير معروف.';
  }

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    if (maybeError.message) {
      return maybeError.message;
    }

    if (maybeError.details) {
      return maybeError.details;
    }

    if (maybeError.hint) {
      return maybeError.hint;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'حدث خطأ أثناء تنفيذ العملية.';
}

function statusLabel(status: AttendanceStatus) {
  switch (status) {
    case 'working':
      return 'يعمل';
    case 'available':
      return 'متاح';
    case 'break':
      return 'استراحة';
    case 'checked_out':
      return 'انصرف';
    case 'not_arrived':
    default:
      return 'لم يصل';
  }
}

function statusClass(status: AttendanceStatus) {
  switch (status) {
    case 'working':
      return 'bg-emerald-50 text-emerald-700';
    case 'available':
      return 'bg-blue-50 text-blue-700';
    case 'break':
      return 'bg-orange-50 text-orange-700';
    case 'checked_out':
      return 'bg-slate-100 text-slate-600';
    case 'not_arrived':
    default:
      return 'bg-amber-50 text-amber-700';
  }
}

function statusDotClass(status: AttendanceStatus) {
  switch (status) {
    case 'working':
      return 'bg-emerald-500';
    case 'available':
      return 'bg-blue-500';
    case 'break':
      return 'bg-orange-500';
    case 'checked_out':
      return 'bg-slate-400';
    case 'not_arrived':
    default:
      return 'bg-amber-500';
  }
}

function actionLabel(action: AttendanceAction) {
  switch (action) {
    case 'check_in':
      return 'حضر';
    case 'break_start':
      return 'بدأ الاستراحة';
    case 'break_end':
      return 'عاد من الاستراحة';
    case 'check_out':
      return 'انصرف';
    default:
      return action;
  }
}

function actionClass(action: AttendanceAction) {
  switch (action) {
    case 'check_in':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'break_start':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'break_end':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'check_out':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatArabicDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function getLocalDateString(value: string) {
  return formatDateInput(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function sameCalendarDay(value: string | null, selectedDate: string) {
  return Boolean(value) && getLocalDateString(value as string) === selectedDate;
}

export default function AttendancePage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const today = formatDateInput(new Date());
  const isLiveDate = selectedDate === today;

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const {
        data: event,
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

      if (!event) {
        throw new Error(`لم يتم العثور على الفعالية النشطة "${EVENT_NAME}".`);
      }

      setEventId(event.id);

      const [
        staffResult,
        attendanceResult,
        logsResult,
        breaksResult,
      ] = await Promise.all([
        supabase
          .from('staff')
          .select(
            'id, full_name, employee_code, phone, is_active, notes'
          )
          .order('employee_code', {
            ascending: true,
          })
          .limit(MAX_TEAM_SIZE),

        supabase
          .from('event_staff')
          .select('staff_id, status')
          .eq('event_id', event.id),

        supabase
          .from('attendance_logs')
          .select('id, staff_id, action, action_at')
          .eq('event_id', event.id)
          .gte('action_at', `${selectedDate}T00:00:00`)
          .lt(
            'action_at',
            `${formatDateInput(
              new Date(
                new Date(
                  Number(selectedDate.slice(0, 4)),
                  Number(selectedDate.slice(5, 7)) - 1,
                  Number(selectedDate.slice(8, 10))
                ).getTime() +
                  24 * 60 * 60 * 1000
              )
            )}T00:00:00`
          )
          .order('action_at', {
            ascending: true,
          }),

        supabase
          .from('breaks')
          .select(
            'id, staff_id, starts_at, ends_at, duration_minutes'
          )
          .eq('event_id', event.id)
          .gte('starts_at', `${selectedDate}T00:00:00`)
          .lt(
            'starts_at',
            `${formatDateInput(
              new Date(
                new Date(
                  Number(selectedDate.slice(0, 4)),
                  Number(selectedDate.slice(5, 7)) - 1,
                  Number(selectedDate.slice(8, 10))
                ).getTime() +
                  24 * 60 * 60 * 1000
              )
            )}T00:00:00`
          )
          .order('starts_at', {
            ascending: true,
          }),
      ]);

      if (staffResult.error) {
        throw staffResult.error;
      }

      if (attendanceResult.error) {
        throw attendanceResult.error;
      }

      if (logsResult.error) {
        throw logsResult.error;
      }

      if (breaksResult.error) {
        throw breaksResult.error;
      }

      const staffList = (staffResult.data ?? []) as Staff[];
      const attendanceRows = (attendanceResult.data ?? []) as EventStaff[];
      const logRows = (logsResult.data ?? []) as AttendanceLog[];
      const breakRows = (breaksResult.data ?? []) as BreakRow[];

      const attendanceMap = new Map<string, AttendanceStatus>();

      for (const item of attendanceRows) {
        attendanceMap.set(item.staff_id, item.status);
      }

      const logsByStaff = new Map<string, AttendanceLog[]>();

      for (const log of logRows) {
        const list = logsByStaff.get(log.staff_id) ?? [];
        list.push(log);
        logsByStaff.set(log.staff_id, list);
      }

      const breaksByStaff = new Map<string, BreakRow[]>();

      for (const item of breakRows) {
        const list = breaksByStaff.get(item.staff_id) ?? [];
        list.push(item);
        breaksByStaff.set(item.staff_id, list);
      }

      const rows: StaffRow[] = staffList.map((person) => {
        const logs = logsByStaff.get(person.id) ?? [];
        const personBreaks = breaksByStaff.get(person.id) ?? [];

        const checkInLog = logs.find(
          (log) => log.action === 'check_in'
        );

        const checkOutLog = [...logs]
          .reverse()
          .find((log) => log.action === 'check_out');

        const breakStartLog = [...logs]
          .reverse()
          .find((log) => log.action === 'break_start');

        const breakEndLog = [...logs]
          .reverse()
          .find((log) => log.action === 'break_end');

        const scheduledBreak = personBreaks[personBreaks.length - 1];
        const nowMs = Date.now();

        const scheduledBreakHasStarted =
          Boolean(scheduledBreak) &&
          new Date(scheduledBreak.starts_at).getTime() <= nowMs;

        const breakHasEnded =
          Boolean(scheduledBreak?.ends_at) &&
          new Date(scheduledBreak.ends_at as string).getTime() <= nowMs;

        return {
          ...person,
          attendance_status:
            attendanceMap.get(person.id) ?? 'not_arrived',
          check_in_at: checkInLog?.action_at ?? null,
          check_out_at: checkOutLog?.action_at ?? null,
          break_start_at:
            breakStartLog?.action_at ??
            (scheduledBreakHasStarted
              ? scheduledBreak?.starts_at ?? null
              : null),
          break_end_at:
            breakEndLog?.action_at ??
            (breakHasEnded
              ? scheduledBreak?.ends_at ?? null
              : null),
        };
      });

      setStaff(rows);
    } catch (error) {
      console.warn('Load attendance error:', error);

      setErrorMessage(
        `تعذر تحميل بيانات الحضور: ${getErrorMessage(error)}`
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const logAttendanceAction = useCallback(
    async (
      targetEventId: string,
      staffId: string,
      action: AttendanceAction
    ) => {
      const { error } = await supabase
        .from('attendance_logs')
        .insert({
          event_id: targetEventId,
          staff_id: staffId,
          action,
          action_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }
    },
    []
  );

  const syncBreakStatuses = useCallback(async () => {
    if (!eventId) {
      return;
    }

    try {
      const now = Date.now();

      const [eventStaffResult, breaksResult] = await Promise.all([
        supabase
          .from('event_staff')
          .select('staff_id, status')
          .eq('event_id', eventId),

        supabase
          .from('breaks')
          .select('id, staff_id, starts_at, ends_at, duration_minutes')
          .eq('event_id', eventId),
      ]);

      if (eventStaffResult.error) {
        throw eventStaffResult.error;
      }

      if (breaksResult.error) {
        throw breaksResult.error;
      }

      const currentStaff = (eventStaffResult.data ?? []) as EventStaff[];
      const currentBreaks = (breaksResult.data ?? []) as BreakRow[];

      for (const row of currentStaff) {
        if (row.status === 'checked_out') {
          continue;
        }

        const activeBreak = currentBreaks
          .filter((item) => item.staff_id === row.staff_id)
          .find((item) => {
            const start = new Date(item.starts_at).getTime();
            const end = item.ends_at
              ? new Date(item.ends_at).getTime()
              : Number.POSITIVE_INFINITY;

            return start <= now && now < end;
          });

        const shouldBeOnBreak = Boolean(activeBreak);

        if (shouldBeOnBreak && row.status !== 'break') {
          await supabase
            .from('event_staff')
            .update({ status: 'break' })
            .eq('event_id', eventId)
            .eq('staff_id', row.staff_id);

          const { data: existingStart } = await supabase
            .from('attendance_logs')
            .select('id')
            .eq('event_id', eventId)
            .eq('staff_id', row.staff_id)
            .eq('action', 'break_start')
            .gte('action_at', `${getLocalDateString(new Date().toISOString())}T00:00:00`)
            .lt('action_at', `${formatDateInput(new Date(new Date().setHours(24, 0, 0, 0)))}T00:00:00`)
            .limit(1);

          if (!existingStart?.length) {
            await logAttendanceAction(
              eventId,
              row.staff_id,
              'break_start'
            );
          }
        }

        if (!shouldBeOnBreak && row.status === 'break') {
          await supabase
            .from('event_staff')
            .update({ status: 'available' })
            .eq('event_id', eventId)
            .eq('staff_id', row.staff_id);

          const today = formatDateInput(new Date());

          const { data: existingEnd } = await supabase
            .from('attendance_logs')
            .select('id')
            .eq('event_id', eventId)
            .eq('staff_id', row.staff_id)
            .eq('action', 'break_end')
            .gte('action_at', `${today}T00:00:00`)
            .lt(
              'action_at',
              `${formatDateInput(
                new Date(
                  new Date(today).getTime() + 24 * 60 * 60 * 1000
                )
              )}T00:00:00`
            )
            .limit(1);

          if (!existingEnd?.length) {
            await logAttendanceAction(
              eventId,
              row.staff_id,
              'break_end'
            );
          }
        }
      }

      await loadAttendance();
    } catch (error) {
      console.warn('Break status sync error:', error);
    }
  }, [eventId, loadAttendance, logAttendanceAction]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    syncBreakStatuses();

    const interval = setInterval(() => {
      syncBreakStatuses();
    }, 10000);

    return () => clearInterval(interval);
  }, [eventId, syncBreakStatuses]);

  const presentCount = useMemo(
    () =>
      staff.filter(
        (person) =>
          person.attendance_status === 'working' ||
          person.attendance_status === 'available' ||
          person.attendance_status === 'break'
      ).length,
    [staff]
  );

  const workingCount = useMemo(
    () =>
      staff.filter(
        (person) => person.attendance_status === 'working'
      ).length,
    [staff]
  );

  const availableCount = useMemo(
    () =>
      staff.filter(
        (person) => person.attendance_status === 'available'
      ).length,
    [staff]
  );

  const breakCount = useMemo(
    () =>
      staff.filter(
        (person) => person.attendance_status === 'break'
      ).length,
    [staff]
  );

  const notArrivedCount = useMemo(
    () =>
      staff.filter(
        (person) => person.attendance_status === 'not_arrived'
      ).length,
    [staff]
  );

  const checkedOutCount = useMemo(
    () =>
      staff.filter(
        (person) => person.attendance_status === 'checked_out'
      ).length,
    [staff]
  );

  const filteredStaff = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return staff;
    }

    return staff.filter((person) => {
      const name = person.full_name?.toLowerCase() ?? '';
      const code = person.employee_code?.toLowerCase() ?? '';
      const phone = person.phone?.toLowerCase() ?? '';

      return (
        name.includes(value) ||
        code.includes(value) ||
        phone.includes(value)
      );
    });
  }, [staff, search]);

  async function processAttendance(
    person: StaffRow,
    action: 'check_in' | 'check_out'
  ) {
    if (!eventId) {
      setErrorMessage('لم يتم العثور على الفعالية النشطة.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setProcessingId(person.id);

    try {
      if (action === 'check_in') {
        const now = new Date();

        const { data: currentBreaks, error: breakError } =
          await supabase
            .from('breaks')
            .select(
              'id, staff_id, starts_at, ends_at, duration_minutes'
            )
            .eq('event_id', eventId)
            .eq('staff_id', person.id);

        if (breakError) {
          throw breakError;
        }

        const timestamp = now.getTime();

        const activeBreak = ((currentBreaks ?? []) as BreakRow[]).find(
          (item) => {
            const start = new Date(item.starts_at).getTime();
            const end = item.ends_at
              ? new Date(item.ends_at).getTime()
              : Number.POSITIVE_INFINITY;

            return start <= timestamp && timestamp < end;
          }
        );

        const newStatus: AttendanceStatus = activeBreak
          ? 'break'
          : 'working';

        const { data, error } = await supabase
          .from('event_staff')
          .upsert(
            {
              event_id: eventId,
              staff_id: person.id,
              status: newStatus,
            },
            {
              onConflict: 'event_id,staff_id',
            }
          )
          .select('staff_id, status')
          .single();

        if (error) {
          throw error;
        }

        await logAttendanceAction(
          eventId,
          person.id,
          'check_in'
        );

        if (activeBreak) {
          await logAttendanceAction(
            eventId,
            person.id,
            'break_start'
          );
        }

        setStaff((current) =>
          current.map((item) =>
            item.id === person.id
              ? {
                  ...item,
                  attendance_status:
                    (data?.status as AttendanceStatus) ?? newStatus,
                  check_in_at: new Date().toISOString(),
                }
              : item
          )
        );

        setSuccessMessage(
          `تم تسجيل حضور "${person.full_name}" بنجاح.`
        );
      } else {
        const { data, error } = await supabase
          .from('event_staff')
          .update({
            status: 'checked_out',
          })
          .eq('event_id', eventId)
          .eq('staff_id', person.id)
          .select('staff_id, status')
          .single();

        if (error) {
          throw error;
        }

        await logAttendanceAction(
          eventId,
          person.id,
          'check_out'
        );

        setStaff((current) =>
          current.map((item) =>
            item.id === person.id
              ? {
                  ...item,
                  attendance_status:
                    (data?.status as AttendanceStatus) ?? 'checked_out',
                  check_out_at: new Date().toISOString(),
                }
              : item
          )
        );

        setSuccessMessage(
          `تم تسجيل انصراف "${person.full_name}" بنجاح.`
        );
      }

      await loadAttendance();
    } catch (error) {
      console.warn('Attendance operation error:', error);

      setErrorMessage(
        `تعذر تنفيذ العملية: ${getErrorMessage(error)}`
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              الحضور والانصراف
            </h1>

            <p className="mt-2 text-base text-slate-500">
              متابعة الحالة الحالية وسجل حضور كل يوم — {EVENT_NAME}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
              <Clock3 className="h-5 w-5 text-slate-500" />

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(event.target.value)
                }
                className="bg-transparent text-sm outline-none"
              />
            </label>

            <button
              type="button"
              onClick={loadAttendance}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-5 w-5 ${
                  loading ? 'animate-spin' : ''
                }`}
              />
              تحديث
            </button>
          </div>
        </header>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-lg font-bold">
            سجل يوم {formatArabicDate(selectedDate)}
          </div>

          <div className="mt-1 text-sm text-slate-500">
            السجل يعرض أحداث اليوم المحدد. تسجيل الحضور والانصراف
            متاح فقط لتاريخ اليوم الحالي.
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />

            <div className="min-w-0">
              <div className="font-semibold">حدث خطأ</div>

              <div className="mt-1 break-words text-sm">
                {errorMessage}
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
            <CheckCircle2 className="h-6 w-6 shrink-0" />

            <span className="font-medium">
              {successMessage}
            </span>

            <button
              type="button"
              onClick={() => setSuccessMessage('')}
              className="mr-auto rounded-lg p-1 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              إجمالي الفريق
            </p>
            <p className="mt-2 text-3xl font-bold">
              {staff.length}
              <span className="text-lg font-normal text-slate-400">
                {' '}
                / {MAX_TEAM_SIZE}
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              الحاضرون
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {presentCount}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-blue-700">
              يعملون
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-700">
              {workingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-orange-700">
              استراحة
            </p>
            <p className="mt-2 text-3xl font-bold text-orange-700">
              {breakCount}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-blue-700">
              متاح
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-700">
              {availableCount}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">
              لم يصل
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {notArrivedCount}
            </p>
          </div>
        </section>

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span className="font-semibold text-slate-900">
              {checkedOutCount}
            </span>{' '}
            انصرفوا الآن
          </div>
        </div>

        {!isLiveDate ? (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-700">
            أنت تستعرض تاريخًا غير تاريخ اليوم؛ أزرار تسجيل الحضور والانصراف
            معطلة، والسجل يعرض البيانات التاريخية فقط.
          </div>
        ) : null}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="ابحث بالاسم أو كود الموظف أو رقم الهاتف..."
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pr-12 pl-12 text-base outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {search && (
            <p className="mt-3 text-sm text-slate-500">
              نتائج البحث: {filteredStaff.length}
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  سجل الحضور اليومي
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  عرض {filteredStaff.length} من {staff.length} موظف
                </p>
              </div>

              <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                الحد الأقصى للفريق: {MAX_TEAM_SIZE} موظف
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[350px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span>جاري تحميل بيانات الحضور...</span>
              </div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full bg-slate-100 p-5">
                <Users className="h-10 w-10 text-slate-400" />
              </div>

              <h3 className="mt-5 text-xl font-semibold text-slate-800">
                {search
                  ? 'لا توجد نتائج مطابقة'
                  : 'لا يوجد موظفون'}
              </h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-right">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      #
                    </th>
                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      الموظف
                    </th>
                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      كود الموظف
                    </th>
                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      الحالة الحالية
                    </th>
                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      حضر
                    </th>
                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      الاستراحة
                    </th>
                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      الانصراف
                    </th>
                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      الإجراءات
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((person, index) => {
                    const isPresent =
                      person.attendance_status === 'working' ||
                      person.attendance_status === 'available' ||
                      person.attendance_status === 'break';

                    const isCheckedOut =
                      person.attendance_status === 'checked_out';

                    const isProcessing =
                      processingId === person.id;

                    return (
                      <tr
                        key={person.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 text-sm font-medium text-slate-400">
                          {index + 1}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-600">
                              {person.full_name?.charAt(0) || '?'}
                            </div>

                            <div>
                              <div className="font-semibold text-slate-900">
                                {person.full_name}
                              </div>

                              <div className="mt-1 text-xs text-slate-400">
                                {sameCalendarDay(
                                  person.check_in_at,
                                  selectedDate
                                ) &&
                                person.check_in_at
                                  ? 'سجل حضور لهذا اليوم'
                                  : 'لا يوجد حضور مسجل لهذا اليوم'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-medium text-slate-700">
                            {person.employee_code}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${statusClass(
                              person.attendance_status
                            )}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${statusDotClass(
                                person.attendance_status
                              )}`}
                            />
                            {statusLabel(
                              person.attendance_status
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {sameCalendarDay(
                            person.check_in_at,
                            selectedDate
                          )
                            ? formatTime(person.check_in_at)
                            : '—'}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {sameCalendarDay(
                            person.break_start_at,
                            selectedDate
                          )
                            ? `${formatTime(
                                person.break_start_at
                              )}${
                                person.break_end_at
                                  ? ` → ${formatTime(
                                      person.break_end_at
                                    )}`
                                  : ''
                              }`
                            : '—'}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {sameCalendarDay(
                            person.check_out_at,
                            selectedDate
                          )
                            ? formatTime(person.check_out_at)
                            : '—'}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {!isPresent && !isCheckedOut && (
                              <button
                                type="button"
                                onClick={() =>
                                  processAttendance(
                                    person,
                                    'check_in'
                                  )
                                }
                                disabled={
                                  isProcessing ||
                                  !person.is_active ||
                                  !isLiveDate
                                }
                                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <LogIn className="h-4 w-4" />
                                )}
                                تسجيل حضور
                              </button>
                            )}

                            {isPresent && (
                              <button
                                type="button"
                                onClick={() =>
                                  processAttendance(
                                    person,
                                    'check_out'
                                  )
                                }
                                disabled={isProcessing || !isLiveDate}
                                className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <LogOut className="h-4 w-4" />
                                )}
                                تسجيل انصراف
                              </button>
                            )}

                            {isCheckedOut && (
                              <button
                                type="button"
                                onClick={() =>
                                  processAttendance(
                                    person,
                                    'check_in'
                                  )
                                }
                                disabled={
                                  isProcessing ||
                                  !person.is_active ||
                                  !isLiveDate
                                }
                                className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <LogIn className="h-4 w-4" />
                                )}
                                تسجيل حضور مرة أخرى
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5">
            <h2 className="text-xl font-bold">
              تفاصيل حركات اليوم
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              يظهر هنا كل حدث تم تسجيله في التاريخ المختار.
            </p>
          </div>

          {staff.some(
            (person) =>
              sameCalendarDay(person.check_in_at, selectedDate) ||
              sameCalendarDay(person.break_start_at, selectedDate) ||
              sameCalendarDay(person.break_end_at, selectedDate) ||
              sameCalendarDay(person.check_out_at, selectedDate)
          ) ? (
            <div className="divide-y divide-slate-100">
              {staff.map((person) => {
                const events = [
                  person.check_in_at
                    ? {
                        action: 'حضر',
                        at: person.check_in_at,
                        cls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                      }
                    : null,
                  person.break_start_at
                    ? {
                        action: 'بدأ الاستراحة',
                        at: person.break_start_at,
                        cls: 'border-orange-200 bg-orange-50 text-orange-700',
                      }
                    : null,
                  person.break_end_at
                    ? {
                        action: 'عاد من الاستراحة',
                        at: person.break_end_at,
                        cls: 'border-blue-200 bg-blue-50 text-blue-700',
                      }
                    : null,
                  person.check_out_at
                    ? {
                        action: 'انصرف',
                        at: person.check_out_at,
                        cls: 'border-slate-200 bg-slate-100 text-slate-700',
                      }
                    : null,
                ].filter(
  (
    item
  ): item is {
    action: string;
    at: string;
    cls: string;
  } =>
    item !== null &&
    Boolean(item.at) &&
    sameCalendarDay(item.at, selectedDate)
);

                if (!events.length) {
                  return null;
                }

                return (
                  <div
                    key={person.id}
                    className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="font-bold">
                        {person.full_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {person.employee_code}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {events.map((event) => (
                        <span
                          key={`${person.id}-${event.action}-${event.at}`}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${event.cls}`}
                        >
                          {event.action} — {formatTime(event.at)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              لا توجد حركات مسجلة لهذا اليوم.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
