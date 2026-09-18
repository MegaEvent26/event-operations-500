'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Grid2X2,
  LayoutDashboard,
  RefreshCw,
  Settings,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const EVENT_NAME = 'Event 26';
const MAX_TEAM_SIZE = 500;

const menu = [
  { label: 'الرئيسية', icon: LayoutDashboard, href: '/' },
  { label: 'فريق العمل', icon: Users, href: '/staff' },
  { label: 'الحضور والانصراف', icon: Clock3, href: '/attendance' },
  { label: 'التكليفات', icon: Activity, href: '/assignments' },
  { label: 'الخط الزمني', icon: Clock3, href: '/timeline' },
  { label: 'الاستراحات', icon: Coffee, href: '/breaks' },
  { label: 'القطاعات', icon: Grid2X2, href: '/sectors' },
  { label: 'إدارة الفعالية', icon: CalendarDays, href: '/event-management' },
  { label: 'التقارير', icon: BarChart3, href: '/reports' },
  { label: 'الإعدادات', icon: Settings, href: '/settings' },
] as const;

type AttendanceStatus =
  | 'not_arrived'
  | 'working'
  | 'available'
  | 'break'
  | 'checked_out';

type StaffRow = {
  id: string;
  full_name: string;
  employee_code: string;
  is_active: boolean;
};

type EventStaffRow = {
  staff_id: string;
  sector_id: string | null;
  status: AttendanceStatus;
};

type SectorRow = {
  id: string;
  name: string;
  name_ar: string | null;
};

type AssignmentRow = {
  id: string;
  staff_id: string;
  sector_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

type BreakRow = {
  id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string | null;
};

type ActivityLog = {
  id: string;
  staff_id: string;
  action: string;
  action_at: string;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function formatDateArabic(date: Date) {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function actionLabel(action: string) {
  switch (action) {
    case 'check_in':
      return 'سجل حضور';
    case 'break_start':
      return 'بدأ استراحة';
    case 'break_end':
      return 'عاد من الاستراحة';
    case 'check_out':
      return 'سجل انصراف';
    default:
      return action;
  }
}

function statusLabel(status: string) {
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

export default function ReportsPage() {
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [eventStaff, setEventStaff] = useState<EventStaffRow[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [breaks, setBreaks] = useState<BreakRow[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const loadReports = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setErrorMessage('');

      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name, is_active')
        .eq('name', EVENT_NAME)
        .eq('is_active', true)
        .maybeSingle();

      if (eventError) throw eventError;

      if (!event) {
        throw new Error(`لم يتم العثور على الفعالية النشطة "${EVENT_NAME}".`);
      }

      const now = new Date();

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const [
        staffResult,
        eventStaffResult,
        sectorsResult,
        assignmentsResult,
        breaksResult,
        activityResult,
      ] = await Promise.all([
        supabase
          .from('staff')
          .select('id, full_name, employee_code, is_active')
          .order('employee_code', { ascending: true })
          .limit(MAX_TEAM_SIZE),

        supabase
          .from('event_staff')
          .select('staff_id, sector_id, status')
          .eq('event_id', event.id),

        supabase
          .from('sectors')
          .select('id, name, name_ar')
          .order('name_ar', { ascending: true }),

        supabase
          .from('assignments')
          .select(
            'id, staff_id, sector_id, title, starts_at, ends_at, status'
          )
          .eq('event_id', event.id)
          .gte('starts_at', todayStart.toISOString())
          .lt('starts_at', todayEnd.toISOString())
          .order('starts_at', { ascending: true }),

        supabase
          .from('breaks')
          .select('id, staff_id, starts_at, ends_at')
          .eq('event_id', event.id)
          .gte('starts_at', todayStart.toISOString())
          .lt('starts_at', todayEnd.toISOString())
          .order('starts_at', { ascending: true }),

        supabase
          .from('attendance_logs')
          .select('id, staff_id, action, action_at')
          .eq('event_id', event.id)
          .gte('action_at', todayStart.toISOString())
          .lt('action_at', todayEnd.toISOString())
          .order('action_at', { ascending: false }),
      ]);

      if (staffResult.error) throw staffResult.error;
      if (eventStaffResult.error) throw eventStaffResult.error;
      if (sectorsResult.error) throw sectorsResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;
      if (breaksResult.error) throw breaksResult.error;
      if (activityResult.error) throw activityResult.error;

      setStaff((staffResult.data ?? []) as StaffRow[]);
      setEventStaff((eventStaffResult.data ?? []) as EventStaffRow[]);
      setSectors((sectorsResult.data ?? []) as SectorRow[]);
      setAssignments((assignmentsResult.data ?? []) as AssignmentRow[]);
      setBreaks((breaksResult.data ?? []) as BreakRow[]);
      setActivities((activityResult.data ?? []) as ActivityLog[]);
      setLastUpdated(new Date());
    } catch (error) {
      console.warn('Reports load error:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل بيانات التقارير.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports(true);

    const interval = setInterval(() => {
      loadReports(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [loadReports]);

  const activeStaff = useMemo(
    () => staff.filter((person) => person.is_active),
    [staff]
  );

  const statusCounts = useMemo(() => {
    return {
      working: eventStaff.filter((x) => x.status === 'working').length,
      available: eventStaff.filter((x) => x.status === 'available').length,
      break: eventStaff.filter((x) => x.status === 'break').length,
      checkedOut: eventStaff.filter((x) => x.status === 'checked_out').length,
      notArrived: activeStaff.filter((person) => {
        const row = eventStaff.find((x) => x.staff_id === person.id);
        return !row || row.status === 'not_arrived';
      }).length,
    };
  }, [activeStaff, eventStaff]);

  const presentCount =
    statusCounts.working +
    statusCounts.available +
    statusCounts.break;

  const completedAssignments = assignments.filter(
    (item) => item.status === 'completed'
  ).length;

  const activeAssignments = assignments.filter(
    (item) => item.status === 'active'
  ).length;

  const plannedAssignments = assignments.filter(
    (item) => item.status === 'planned'
  ).length;

  const activeBreaks = useMemo(() => {
    const now = Date.now();

    return breaks.filter((item) => {
      const start = new Date(item.starts_at).getTime();
      const end = item.ends_at
        ? new Date(item.ends_at).getTime()
        : Number.POSITIVE_INFINITY;

      return start <= now && now < end;
    });
  }, [breaks]);

  const sectorRows = useMemo(() => {
    return sectors.map((sector) => {
      const count = eventStaff.filter(
        (item) =>
          item.sector_id === sector.id &&
          item.status !== 'not_arrived' &&
          item.status !== 'checked_out'
      ).length;

      return {
        ...sector,
        displayName: sector.name_ar || sector.name,
        count,
      };
    });
  }, [sectors, eventStaff]);

  const staffMap = useMemo(
    () => new Map(staff.map((person) => [person.id, person])),
    [staff]
  );

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 text-slate-900"
      >
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="rounded-2xl border border-slate-200 bg-white px-10 py-12 text-center shadow-sm">
            <RefreshCw className="mx-auto mb-4 h-9 w-9 animate-spin text-blue-600" />
            <div className="font-bold">جاري تحميل التقارير...</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <aside className="fixed right-0 top-0 z-20 hidden h-screen w-72 bg-[#092448] text-white lg:block">
        <div className="border-b border-white/10 px-7 py-7">
          <div className="text-xl font-bold">نظام إدارة التشغيل</div>
          <div className="mt-1 text-sm text-slate-300">والفعاليات</div>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <BarChart3 size={24} />
            </div>

            <div>
              <div className="font-bold">EVENT</div>
              <div className="text-xs text-slate-300">REPORTS</div>
            </div>
          </div>
        </div>

        <nav className="space-y-2 p-4">
          {menu.map((item) => {
            const Icon = item.icon;

            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  isActive
                    ? 'bg-blue-500 font-bold text-white'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="lg:mr-72">
        <header className="flex flex-col gap-4 border-b bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ArrowRight size={19} />
              </Link>

              <div>
                <h1 className="text-xl font-bold">التقارير</h1>
                <p className="text-sm text-slate-500">
                  تقارير تشغيل الفعالية — {EVENT_NAME}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-left">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                البيانات مباشرة
              </div>

              <div className="text-xs text-slate-400">
                {lastUpdated
                  ? `آخر تحديث ${formatTime(lastUpdated.toISOString())}`
                  : ''}
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadReports(false)}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={refreshing ? 'animate-spin' : ''}
              />
              تحديث
            </button>
          </div>
        </header>

        <div className="space-y-6 p-5 lg:p-8">
          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              تعذر تحميل التقارير: {errorMessage}
            </div>
          ) : null}

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-sm text-slate-500">تقرير التشغيل اليومي</p>
                <h2 className="mt-2 text-2xl font-black">
                  {formatDateArabic(new Date())}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  الفعالية الحالية: {EVENT_NAME}
                </p>
              </div>

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <BarChart3 size={32} />
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            <ReportCard
              title="إجمالي الفريق"
              value={activeStaff.length}
              suffix={`/ ${MAX_TEAM_SIZE}`}
              icon={<Users size={25} />}
              iconClass="bg-blue-50 text-blue-600"
            />

            <ReportCard
              title="الحاضرون"
              value={presentCount}
              suffix="موظف"
              icon={<UserCheck size={25} />}
              iconClass="bg-emerald-50 text-emerald-600"
            />

            <ReportCard
              title="في الاستراحة"
              value={activeBreaks.length}
              suffix="موظف"
              icon={<Coffee size={25} />}
              iconClass="bg-orange-50 text-orange-600"
            />

            <ReportCard
              title="المنصرفون"
              value={statusCounts.checkedOut}
              suffix="موظف"
              icon={<UserX size={25} />}
              iconClass="bg-slate-100 text-slate-600"
            />

            <ReportCard
              title="لم يسجلوا حضورًا"
              value={statusCounts.notArrived}
              suffix="موظف"
              icon={<Clock3 size={25} />}
              iconClass="bg-red-50 text-red-600"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">حالة فريق العمل</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    الحالة الحالية للموظفين
                  </p>
                </div>

                <Users className="text-slate-400" />
              </div>

              <div className="space-y-4">
                <StatusRow
                  label="يعمل الآن"
                  value={statusCounts.working}
                  total={Math.max(activeStaff.length, 1)}
                  className="bg-emerald-500"
                />

                <StatusRow
                  label="متاح"
                  value={statusCounts.available}
                  total={Math.max(activeStaff.length, 1)}
                  className="bg-blue-500"
                />

                <StatusRow
                  label="في استراحة"
                  value={statusCounts.break}
                  total={Math.max(activeStaff.length, 1)}
                  className="bg-orange-500"
                />

                <StatusRow
                  label="لم يحضر"
                  value={statusCounts.notArrived}
                  total={Math.max(activeStaff.length, 1)}
                  className="bg-red-400"
                />

                <StatusRow
                  label="انصرف"
                  value={statusCounts.checkedOut}
                  total={Math.max(activeStaff.length, 1)}
                  className="bg-slate-500"
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">ملخص التكليفات</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    تكليفات اليوم
                  </p>
                </div>

                <Activity className="text-slate-400" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MiniStat
                  title="إجمالي التكليفات"
                  value={assignments.length}
                />

                <MiniStat
                  title="تكليفات نشطة"
                  value={activeAssignments}
                />

                <MiniStat
                  title="تكليفات مكتملة"
                  value={completedAssignments}
                />

                <MiniStat
                  title="تكليفات مخططة"
                  value={plannedAssignments}
                />
              </div>
            </section>
          </div>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">
                  توزيع الفريق على القطاعات
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  الموظفون الموجودون حاليًا في كل قطاع
                </p>
              </div>

              <Grid2X2 className="text-slate-400" />
            </div>

            {sectorRows.length === 0 ? (
              <div className="rounded-xl bg-slate-50 py-12 text-center text-slate-500">
                لا توجد قطاعات مسجلة.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sectorRows.map((sector) => (
                  <div
                    key={sector.id}
                    className="rounded-xl border border-slate-100 p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-bold">{sector.displayName}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {sector.name}
                        </div>
                      </div>

                      <div className="text-2xl font-black text-[#092448]">
                        {sector.count}
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width:
                            sector.count > 0
                              ? `${Math.min(
                                  100,
                                  (sector.count /
                                    Math.max(activeStaff.length, 1)) *
                                    100
                                )}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">سجل النشاط اليومي</h2>
                <p className="mt-1 text-xs text-slate-400">
                  جميع عمليات الحضور والانصراف والاستراحات
                </p>
              </div>

              <Clock3 className="text-slate-400" />
            </div>

            {activities.length === 0 ? (
              <div className="rounded-xl bg-slate-50 py-12 text-center text-slate-500">
                لا توجد نشاطات مسجلة اليوم.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-right text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="px-4 py-4 font-semibold">الموظف</th>
                      <th className="px-4 py-4 font-semibold">العملية</th>
                      <th className="px-4 py-4 font-semibold">الوقت</th>
                    </tr>
                  </thead>

                  <tbody>
                    {activities.map((activity) => (
                      <tr
                        key={activity.id}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="px-4 py-4 font-semibold">
                          {staffMap.get(activity.staff_id)?.full_name ??
                            'موظف غير معروف'}
                        </td>

                        <td className="px-4 py-4">
                          {actionLabel(activity.action)}
                        </td>

                        <td className="px-4 py-4 text-slate-500">
                          {formatTime(activity.action_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-[#092448] p-6 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={25} />

              <div>
                <h2 className="font-black">ملخص التقرير</h2>
                <p className="text-sm text-slate-300">
                  البيانات معروضة مباشرة من Supabase
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DarkStat
                label="الاستراحات اليوم"
                value={breaks.length}
              />

              <DarkStat
                label="التكليفات اليوم"
                value={assignments.length}
              />

              <DarkStat
                label="القطاعات"
                value={sectors.length}
              />

              <DarkStat
                label="نشاطات اليوم"
                value={activities.length}
              />
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-sm">
              <span className="text-slate-300">
                وقت التشغيل
              </span>

              <strong>07:00 AM - 09:00 PM</strong>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function ReportCard({
  title,
  value,
  suffix,
  icon,
  iconClass,
}: {
  title: string;
  value: number;
  suffix: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>

          <div className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-black text-[#092448]">
              {value}
            </span>

            <span className="mb-1 text-xs text-slate-400">
              {suffix}
            </span>
          </div>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  total,
  className,
}: {
  label: string;
  value: number;
  total: number;
  className: string;
}) {
  const percentage = Math.min(100, (value / total) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-slate-500">{value} موظف</span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${className}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
      <p className="text-sm text-slate-500">{title}</p>
      <div className="mt-2 text-3xl font-black text-[#092448]">
        {value}
      </div>
    </div>
  );
}

function DarkStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-5">
      <div className="text-sm text-slate-300">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}