'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coffee,
  Grid2X2,
  Power,
  RefreshCw,
  Users,
  UserCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const EVENT_NAME = 'Event 26';
const START_HOUR = 7;
const END_HOUR = 21;

type AttendanceStatus =
  | 'not_arrived'
  | 'working'
  | 'available'
  | 'break'
  | 'checked_out';

type EventRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type EventStaffRow = {
  staff_id: string;
  status: AttendanceStatus;
  sector_id: string | null;
};

type SectorRow = {
  id: string;
  name: string;
  name_ar: string | null;
};

type AssignmentRow = {
  id: string;
};

type BreakRow = {
  id: string;
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export default function EventManagementPage() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [eventStaff, setEventStaff] = useState<EventStaffRow[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [breaks, setBreaks] = useState<BreakRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadEvent = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setErrorMessage('');

      /*
       * مهم:
       * لا نضع .eq('is_active', true)
       * هنا حتى نستطيع إدارة الفعالية حتى لو كانت متوقفة.
       */
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, name, is_active')
        .eq('name', EVENT_NAME)
        .maybeSingle();

      if (eventError) {
        throw eventError;
      }

      if (!eventData) {
        throw new Error(`لم يتم العثور على الفعالية "${EVENT_NAME}".`);
      }

      const eventRow = eventData as EventRow;

      const [
        eventStaffResult,
        sectorsResult,
        assignmentsResult,
        breaksResult,
      ] = await Promise.all([
        supabase
          .from('event_staff')
          .select('staff_id, status, sector_id')
          .eq('event_id', eventRow.id),

        supabase
          .from('sectors')
          .select('id, name, name_ar')
          .order('name_ar', { ascending: true }),

        supabase
          .from('assignments')
          .select('id')
          .eq('event_id', eventRow.id)
          .neq('status', 'cancelled'),

        supabase
          .from('breaks')
          .select('id')
          .eq('event_id', eventRow.id),
      ]);

      if (eventStaffResult.error) {
        throw eventStaffResult.error;
      }

      if (sectorsResult.error) {
        throw sectorsResult.error;
      }

      if (assignmentsResult.error) {
        throw assignmentsResult.error;
      }

      if (breaksResult.error) {
        throw breaksResult.error;
      }

      setEvent(eventRow);
      setEventStaff((eventStaffResult.data ?? []) as EventStaffRow[]);
      setSectors((sectorsResult.data ?? []) as SectorRow[]);
      setAssignments((assignmentsResult.data ?? []) as AssignmentRow[]);
      setBreaks((breaksResult.data ?? []) as BreakRow[]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Event management load error:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل بيانات الفعالية.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvent(true);

    const interval = setInterval(() => {
      loadEvent(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [loadEvent]);

  const teamCount = useMemo(() => {
    return new Set(eventStaff.map((item) => item.staff_id)).size;
  }, [eventStaff]);

  const presentCount = useMemo(() => {
    return eventStaff.filter(
      (item) =>
        item.status === 'working' ||
        item.status === 'available' ||
        item.status === 'break'
    ).length;
  }, [eventStaff]);

  const workingCount = useMemo(() => {
    return eventStaff.filter((item) => item.status === 'working').length;
  }, [eventStaff]);

  const availableCount = useMemo(() => {
    return eventStaff.filter((item) => item.status === 'available').length;
  }, [eventStaff]);

  const breakCount = useMemo(() => {
    return eventStaff.filter((item) => item.status === 'break').length;
  }, [eventStaff]);

  const checkedOutCount = useMemo(() => {
    return eventStaff.filter((item) => item.status === 'checked_out')
      .length;
  }, [eventStaff]);

  const notArrivedCount = useMemo(() => {
    return eventStaff.filter(
      (item) => item.status === 'not_arrived'
    ).length;
  }, [eventStaff]);

  const toggleEventStatus = async () => {
    if (!event || savingStatus) return;

    const nextStatus = !event.is_active;

    try {
      setSavingStatus(true);
      setErrorMessage('');

      const { error } = await supabase
        .from('events')
        .update({
          is_active: nextStatus,
        })
        .eq('id', event.id);

      if (error) {
        throw error;
      }

      setEvent({
        ...event,
        is_active: nextStatus,
      });

      await loadEvent(false);
    } catch (error) {
      console.error('Event status update error:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تغيير حالة الفعالية.'
      );
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 text-slate-900"
      >
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
            <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />

            <div className="font-semibold">
              جاري تحميل إدارة الفعالية...
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 p-8"
      >
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {errorMessage || 'لم يتم العثور على الفعالية.'}
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      {/* Sidebar */}
      <aside className="fixed right-0 top-0 z-20 hidden h-screen w-72 bg-[#092448] text-white lg:block">
        <div className="border-b border-white/10 px-7 py-7">
          <div className="text-xl font-bold">
            نظام إدارة التشغيل
          </div>

          <div className="mt-1 text-sm text-slate-300">
            والفعاليات
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <CalendarDays size={24} />
            </div>

            <div>
              <div className="font-bold">EVENT</div>

              <div className="text-xs text-slate-300">
                OPERATIONS
              </div>
            </div>
          </div>
        </div>

        <nav className="space-y-2 p-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <ArrowRight size={20} />
            <span>العودة للوحة التحكم</span>
          </Link>

          <div className="flex items-center gap-3 rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white">
            <CalendarDays size={20} />
            <span>إدارة الفعالية</span>
          </div>

          <Link
            href="/staff"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <Users size={20} />
            <span>فريق العمل</span>
          </Link>

          <Link
            href="/attendance"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <UserCheck size={20} />
            <span>الحضور والانصراف</span>
          </Link>

          <Link
            href="/assignments"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <ClipboardList size={20} />
            <span>التكليفات</span>
          </Link>

          <Link
            href="/timeline"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <Clock3 size={20} />
            <span>الخط الزمني</span>
          </Link>

          <Link
            href="/breaks"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <Coffee size={20} />
            <span>الاستراحات</span>
          </Link>
        </nav>
      </aside>

      {/* Main */}
      <section className="lg:mr-72">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <h1 className="text-xl font-bold">
              إدارة الفعالية
            </h1>

            <p className="text-sm text-slate-500">
              التحكم في إعدادات وتشغيل {EVENT_NAME}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-left">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    event.is_active
                      ? 'bg-emerald-500'
                      : 'bg-slate-400'
                  }`}
                />

                {event.is_active
                  ? 'الفعالية نشطة'
                  : 'الفعالية متوقفة'}
              </div>

              <div className="text-xs text-slate-400">
                {lastUpdated
                  ? `آخر تحديث ${formatTime(lastUpdated)}`
                  : ''}
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadEvent(false)}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
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
        </header>

        <div className="space-y-6 p-5 lg:p-8">
          {/* Error */}
          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              تعذر تحميل البيانات: {errorMessage}
            </div>
          ) : null}

          {/* Event */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <CalendarDays size={32} />
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-500">
                    الفعالية الحالية
                  </div>

                  <h2 className="mt-1 text-3xl font-black">
                    {event.name}
                  </h2>

                  <div className="mt-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        event.is_active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {event.is_active
                        ? 'نشطة'
                        : 'متوقفة'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleEventStatus}
                disabled={savingStatus}
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-sm transition disabled:opacity-60 ${
                  event.is_active
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {savingStatus ? (
                  <RefreshCw
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Power size={18} />
                )}

                {event.is_active
                  ? 'إيقاف الفعالية'
                  : 'تشغيل الفعالية'}
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              icon={<Users size={25} />}
              title="فريق العمل"
              value={teamCount}
              subtitle="موظف مرتبط بالفعالية"
            />

            <StatCard
              icon={<UserCheck size={25} />}
              title="الحاضرون الآن"
              value={presentCount}
              subtitle="موظف"
            />

            <StatCard
              icon={<Grid2X2 size={25} />}
              title="القطاعات"
              value={sectors.length}
              subtitle="قطاع"
            />

            <StatCard
              icon={<ClipboardList size={25} />}
              title="التكليفات"
              value={assignments.length}
              subtitle="تكليف"
            />

            <StatCard
              icon={<Coffee size={25} />}
              title="الاستراحات"
              value={breaks.length}
              subtitle={`${breakCount} الآن`}
            />
          </div>

          {/* Operating Hours */}
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Clock3 size={24} />
                </div>

                <div>
                  <h2 className="text-lg font-black">
                    وقت التشغيل
                  </h2>

                  <p className="text-sm text-slate-500">
                    فترة التشغيل المسموح بها للنظام
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center">
                <div className="text-4xl font-black text-[#092448]">
                  07:00 AM
                </div>

                <div className="my-2 text-sm font-semibold text-slate-400">
                  إلى
                </div>

                <div className="text-4xl font-black text-[#092448]">
                  09:00 PM
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-700">
                <CheckCircle2 size={18} />

                جميع أوقات التكليفات والاستراحات يجب أن تكون داخل
                هذه الفترة.
              </div>
            </div>

            {/* Current Status */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black">
                ملخص حالة التشغيل
              </h2>

              <div className="mt-6 space-y-4">
                <SummaryRow
                  label="حالة الفعالية"
                  value={
                    event.is_active
                      ? 'نشطة'
                      : 'متوقفة'
                  }
                  active={event.is_active}
                />

                <SummaryRow
                  label="الموظفون العاملون"
                  value={`${workingCount} موظف`}
                />

                <SummaryRow
                  label="الموظفون المتاحون"
                  value={`${availableCount} موظف`}
                />

                <SummaryRow
                  label="في الاستراحة الآن"
                  value={`${breakCount} موظف`}
                />

                <SummaryRow
                  label="منصرفون"
                  value={`${checkedOutCount} موظف`}
                />

                <SummaryRow
                  label="لم يسجلوا الحضور"
                  value={`${notArrivedCount} موظف`}
                />
              </div>
            </div>
          </div>

          {/* Event stopped */}
          {!event.is_active ? (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <div className="flex items-start gap-3">
                <Power className="mt-0.5 text-orange-600" />

                <div>
                  <div className="font-bold text-orange-800">
                    الفعالية متوقفة
                  </div>

                  <p className="mt-1 text-sm text-orange-700">
                    البيانات الحالية محفوظة، ويمكن تشغيل
                    الفعالية مرة أخرى من الزر أعلاه.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Database summary */}
          <div className="rounded-2xl bg-[#092448] p-6 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <CheckCircle2 size={25} />
              </div>

              <div>
                <h2 className="font-black">
                  بيانات الفعالية
                </h2>

                <p className="text-sm text-slate-300">
                  البيانات مرتبطة مباشرة بقاعدة بيانات Supabase.
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoBox
                label="فريق العمل"
                value={`${teamCount}`}
              />

              <InfoBox
                label="القطاعات"
                value={`${sectors.length}`}
              />

              <InfoBox
                label="التكليفات"
                value={`${assignments.length}`}
              />

              <InfoBox
                label="الاستراحات"
                value={`${breaks.length}`}
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink
              href="/staff"
              icon={<Users size={22} />}
              title="فريق العمل"
              description="إدارة الموظفين"
            />

            <QuickLink
              href="/attendance"
              icon={<UserCheck size={22} />}
              title="الحضور والانصراف"
              description="متابعة الحضور"
            />

            <QuickLink
              href="/assignments"
              icon={<ClipboardList size={22} />}
              title="التكليفات"
              description="إدارة التكليفات"
            />

            <QuickLink
              href="/breaks"
              icon={<Coffee size={22} />}
              title="الاستراحات"
              description="إدارة الاستراحات"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {title}
          </p>

          <div className="mt-3 text-4xl font-black">
            {value}
          </div>

          <p className="mt-2 text-xs text-slate-400">
            {subtitle}
          </p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
      <span className="text-sm font-semibold text-slate-600">
        {label}
      </span>

      <span
        className={`font-bold ${
          active
            ? 'text-emerald-600'
            : 'text-slate-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-slate-300">
        {label}
      </div>

      <div className="mt-1 text-2xl font-black">
        {value}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
          {icon}
        </div>

        <div>
          <div className="font-bold">
            {title}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {description}
          </div>
        </div>
      </div>
    </Link>
  );
}

