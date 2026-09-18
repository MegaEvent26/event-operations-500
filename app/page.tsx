'use client';

import Link from 'next/link';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Coffee,
  Grid2X2,
  LayoutDashboard,
  MapPin,
  RefreshCw,
  Settings,
  Users,
  UserCheck,
  UserRound,
  ClipboardList,
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
  { label: 'التكليفات', icon: ClipboardList, href: '/assignments' },
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
  action: 'check_in' | 'break_start' | 'break_end' | 'check_out';
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

function actionLabel(action: ActivityLog['action']) {
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

function actionClass(action: ActivityLog['action']) {
  switch (action) {
    case 'check_in':
      return 'bg-emerald-50 text-emerald-700';
    case 'break_start':
      return 'bg-orange-50 text-orange-700';
    case 'break_end':
      return 'bg-blue-50 text-blue-700';
    case 'check_out':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function Home() {
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

  const loadDashboard = useCallback(async (showLoader = true) => {
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

      if (eventError) {
        throw eventError;
      }

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
          .neq('status', 'cancelled')
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
          .order('action_at', { ascending: false })
          .limit(8),
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
      console.warn('Dashboard load error:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل بيانات لوحة التحكم.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);

    const interval = setInterval(() => {
      loadDashboard(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  const activeStaff = useMemo(
    () => staff.filter((person) => person.is_active),
    [staff]
  );

  const workingCount = useMemo(
    () =>
      eventStaff.filter((item) => item.status === 'working').length,
    [eventStaff]
  );

  const availableCount = useMemo(
    () =>
      eventStaff.filter((item) => item.status === 'available').length,
    [eventStaff]
  );

  const checkedOutCount = useMemo(
    () =>
      eventStaff.filter((item) => item.status === 'checked_out').length,
    [eventStaff]
  );

  const notArrivedCount = useMemo(
    () =>
      activeStaff.filter((person) => {
        const row = eventStaff.find((item) => item.staff_id === person.id);
        return !row || row.status === 'not_arrived';
      }).length,
    [activeStaff, eventStaff]
  );

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

  const breakStaffIds = useMemo(
    () => new Set(activeBreaks.map((item) => item.staff_id)),
    [activeBreaks]
  );

  const presentCount = useMemo(
    () =>
      activeStaff.filter((person) => {
        const row = eventStaff.find((item) => item.staff_id === person.id);
        return (
          row?.status === 'working' ||
          row?.status === 'available' ||
          row?.status === 'break' ||
          breakStaffIds.has(person.id)
        );
      }).length,
    [activeStaff, eventStaff, breakStaffIds]
  );

  const activeTaskCount = useMemo(() => {
    const now = Date.now();

    return assignments.filter((item) => {
      if (item.status === 'completed') return false;

      const start = new Date(item.starts_at).getTime();
      const end = new Date(item.ends_at).getTime();

      return start <= now && now < end;
    }).length;
  }, [assignments]);

  const todayTaskCount = assignments.length;

  const sectorDistribution = useMemo(() => {
    return sectors.map((sector) => {
      const count = eventStaff.filter(
        (item) =>
          item.sector_id === sector.id &&
          item.status !== 'not_arrived' &&
          item.status !== 'checked_out'
      ).length;

      return {
        name: sector.name_ar || sector.name,
        count,
      };
    });
  }, [eventStaff, sectors]);

  const staffMap = useMemo(
    () => new Map(staff.map((person) => [person.id, person])),
    [staff]
  );

  const activityRows = useMemo(
    () =>
      activities.map((item) => ({
        ...item,
        staffName:
          staffMap.get(item.staff_id)?.full_name ?? 'موظف غير معروف',
      })),
    [activities, staffMap]
  );

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 text-slate-900"
      >
        <div className="mx-auto flex min-h-screen max-w-[1800px] items-center justify-center p-8">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
            <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
            <div className="font-semibold">جاري تحميل لوحة التحكم...</div>
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
              <Users size={24} />
            </div>
            <div>
              <div className="font-bold">EVENT</div>
              <div className="text-xs text-slate-300">OPERATIONS</div>
            </div>
          </div>
        </div>

        <nav className="space-y-2 p-4">
          {menu.map((item) => {
            const Icon = item.icon;

            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
            <h1 className="text-xl font-bold">لوحة التحكم</h1>
            <p className="text-sm text-slate-500">
              نظام إدارة التشغيل والفعاليات — {EVENT_NAME}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-left">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                البيانات مباشرة
              </div>
              <div className="text-xs text-slate-400">
                {lastUpdated ? `آخر تحديث ${formatTime(lastUpdated.toISOString())}` : ''}
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadDashboard(false)}
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
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              تعذر تحميل البيانات: {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">إجمالي فريق العمل</p>

                  <div className="mt-2 flex items-end gap-3">
                    <span className="text-5xl font-black text-[#092448]">
                      {activeStaff.length}
                    </span>
                    <span className="mb-2 text-slate-500">من {MAX_TEAM_SIZE}</span>
                  </div>

                  <div className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    الحد الأقصى للفريق: {MAX_TEAM_SIZE}
                  </div>
                </div>

                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Users size={40} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">الفعالية الحالية</p>
                  <h2 className="mt-2 text-2xl font-black">{EVENT_NAME}</h2>
                  <p className="mt-1 text-sm text-slate-500">فعالية نشطة</p>
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <CalendarDays size={28} />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 size={18} />
                النظام متصل بالبيانات
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">حاضرون الآن</p>
                  <div className="mt-3 text-4xl font-black">{presentCount}</div>
                  <p className="mt-2 text-xs text-slate-400">موظف</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <UserCheck size={25} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">متاحون</p>
                  <div className="mt-3 text-4xl font-black">{availableCount}</div>
                  <p className="mt-2 text-xs text-slate-400">موظف</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <UserRound size={25} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">في استراحة الآن</p>
                  <div className="mt-3 text-4xl font-black">{activeBreaks.length}</div>
                  <p className="mt-2 text-xs text-slate-400">موظف</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <Coffee size={25} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">خارج الخدمة</p>
                  <div className="mt-3 text-4xl font-black">{checkedOutCount}</div>
                  <p className="mt-2 text-xs text-slate-400">انصرفوا</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Activity size={25} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">توزيع الفريق على القطاعات</h2>
                  <p className="mt-1 text-xs text-slate-400">حسب حالة الموظف الحالية</p>
                </div>
                <Grid2X2 size={22} className="text-slate-400" />
              </div>

              <div className="space-y-5">
                {sectorDistribution.map((sector) => (
                  <div key={sector.name}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="font-semibold">{sector.name}</span>
                      <span className="text-slate-500">{sector.count} موظف</span>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{
                          width:
                            sector.count > 0
                              ? `${Math.max(3, (sector.count / Math.max(activeStaff.length, 1)) * 100)}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black">حالة الفعالية</h2>

              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="text-blue-500" />
                    <span>تاريخ اليوم</span>
                  </div>
                  <strong>{formatDateArabic(new Date())}</strong>
                </div>

                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <Clock3 className="text-blue-500" />
                    <span>وقت التشغيل</span>
                  </div>
                  <strong>07:00 AM - 09:00 PM</strong>
                </div>

                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="text-blue-500" />
                    <span>مهام اليوم</span>
                  </div>
                  <strong>{todayTaskCount}</strong>
                </div>

                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <Activity className="text-blue-500" />
                    <span>مهام نشطة الآن</span>
                  </div>
                  <strong>{activeTaskCount}</strong>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="text-blue-500" />
                    <span>عدد القطاعات</span>
                  </div>
                  <strong>{sectors.length}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">آخر النشاطات</h2>
                  <p className="mt-1 text-xs text-slate-400">من سجل الحضور والاستراحات اليوم</p>
                </div>

                <Link
                  href="/attendance"
                  className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700"
                >
                  عرض السجل
                  <ChevronLeft size={17} />
                </Link>
              </div>

              {activityRows.length === 0 ? (
                <div className="mt-6 flex min-h-48 items-center justify-center rounded-xl bg-slate-50 text-center">
                  <div>
                    <Activity className="mx-auto text-slate-300" size={42} />
                    <p className="mt-3 font-semibold text-slate-500">
                      لا توجد نشاطات اليوم
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      ستظهر هنا عمليات الحضور والانصراف والاستراحات
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {activityRows.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {activity.staffName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {actionLabel(activity.action)}
                        </div>
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${actionClass(activity.action)}`}
                      >
                        {formatTime(activity.action_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-[#092448] p-6 text-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                  <CheckCircle2 size={25} />
                </div>

                <div>
                  <h2 className="font-black">حالة النظام</h2>
                  <p className="text-sm text-slate-300">البيانات متصلة مباشرة بـ Supabase</p>
                </div>
              </div>

              <div className="mt-7 space-y-4 text-sm">
                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span>فريق العمل</span>
                  <strong>
                    {activeStaff.length} / {MAX_TEAM_SIZE}
                  </strong>
                </div>

                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span>القطاعات</span>
                  <strong>{sectors.length}</strong>
                </div>

                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span>المهام اليوم</span>
                  <strong>{todayTaskCount}</strong>
                </div>

                <div className="flex justify-between border-b border-white/10 pb-3">
                  <span>الاستراحات اليوم</span>
                  <strong>{breaks.length}</strong>
                </div>

                <div className="flex justify-between">
                  <span>الاتصال</span>
                  <span className="font-bold text-emerald-300">متصل</span>
                </div>
              </div>

              {notArrivedCount > 0 ? (
                <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                  {notArrivedCount} موظف لم يسجلوا حضورًا حتى الآن.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
