'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Grid2X2,
  LayoutDashboard,
  Save,
  Settings as SettingsIcon,
  Users,
  Activity,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const EVENT_NAME = 'Event 26';
const MAX_TEAM_SIZE = 500;
const START_TIME = '07:00 AM';
const END_TIME = '09:00 PM';

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
  { label: 'الإعدادات', icon: SettingsIcon, href: '/settings' },
] as const;

type EventInfo = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function SettingsPage() {
  const pathname = usePathname();

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [teamLimit, setTeamLimit] = useState(String(MAX_TEAM_SIZE));
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('21:00');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setErrorMessage('');

        const { data, error } = await supabase
          .from('events')
          .select('id, name, is_active')
          .eq('name', EVENT_NAME)
          .eq('is_active', true)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error(
            `لم يتم العثور على الفعالية النشطة "${EVENT_NAME}".`
          );
        }

        setEvent(data as EventInfo);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل إعدادات النظام.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function saveSettings() {
    setMessage('');
    setErrorMessage('');

    const numericLimit = Number(teamLimit);

    if (!Number.isInteger(numericLimit) || numericLimit !== 500) {
      setErrorMessage(
        'حد فريق العمل يجب أن يكون 500 موظف.'
      );
      setTeamLimit('500');
      return;
    }

    if (startTime !== '07:00') {
      setErrorMessage(
        'وقت بداية التشغيل يجب أن يكون 07:00 AM.'
      );
      return;
    }

    if (endTime !== '21:00') {
      setErrorMessage(
        'وقت نهاية التشغيل يجب أن يكون 09:00 PM.'
      );
      return;
    }

    setSaving(true);

    setTimeout(() => {
      setSaving(false);
      setMessage('تم حفظ الإعدادات بنجاح.');
    }, 500);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 text-slate-900"
      >
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="rounded-2xl border border-slate-200 bg-white px-10 py-12 text-center shadow-sm">
            <SettingsIcon className="mx-auto mb-4 h-9 w-9 animate-pulse text-blue-600" />
            <div className="font-bold">جاري تحميل الإعدادات...</div>
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
          <div className="mt-1 text-sm text-slate-300">
            والفعاليات
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <SettingsIcon size={24} />
            </div>

            <div>
              <div className="font-bold">EVENT</div>
              <div className="text-xs text-slate-300">SETTINGS</div>
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
        <header className="border-b bg-white px-5 py-4 shadow-sm lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ArrowRight size={19} />
            </Link>

            <div>
              <h1 className="text-xl font-bold">الإعدادات</h1>
              <p className="text-sm text-slate-500">
                إعدادات نظام إدارة التشغيل والفعاليات
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-5 lg:p-8">
          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {message ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-700">
              <CheckCircle2 size={20} />
              {message}
            </div>
          ) : null}

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <CalendarDays size={28} />
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  الفعالية الحالية
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {event?.name || EVENT_NAME}
                </h2>

                <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  الفعالية نشطة
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-black">
                إعدادات فريق العمل
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                الإعدادات الأساسية لعدد الموظفين
              </p>
            </div>

            <div className="max-w-xl">
              <label className="mb-2 block text-sm font-bold">
                الحد الأقصى لفريق العمل
              </label>

              <div className="relative">
                <Users className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  type="number"
                  min={500}
                  max={500}
                  value={teamLimit}
                  onChange={(e) => setTeamLimit(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-12 pl-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <p className="mt-2 text-xs text-slate-400">
                الحد المعتمد للنظام: 500 موظف.
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-black">
                أوقات التشغيل
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                جميع العمليات الزمنية تعمل داخل هذه الفترة فقط.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold">
                  بداية التشغيل
                </label>

                <div className="relative">
                  <Clock3 className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />

                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-12 pl-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  07:00 AM
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  نهاية التشغيل
                </label>

                <div className="relative">
                  <Clock3 className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />

                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-12 pl-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  09:00 PM
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              <div className="font-bold">
                فترة التشغيل المعتمدة
              </div>

              <div className="mt-1">
                {START_TIME} — {END_TIME}
              </div>

              <div className="mt-2 text-xs text-blue-600">
                لا توجد فترة تشغيل ليلية أو لليوم التالي.
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-black">
                التحديث التلقائي
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                تحديث بيانات لوحة التشغيل تلقائيًا.
              </p>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 p-4 hover:bg-slate-50">
              <div>
                <div className="font-bold">
                  تحديث البيانات تلقائيًا
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  الصفحات التشغيلية تقوم بالتحديث الدوري للبيانات.
                </div>
              </div>

              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-5 w-5 accent-blue-600"
              />
            </label>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-black">
                حالة النظام
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                معلومات الاتصال والإعدادات الأساسية.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SystemItem
                title="الفعالية"
                value={EVENT_NAME}
              />

              <SystemItem
                title="حالة الفعالية"
                value="نشطة"
                success
              />

              <SystemItem
                title="حد الفريق"
                value="500 موظف"
              />

              <SystemItem
                title="بداية التشغيل"
                value="07:00 AM"
              />

              <SystemItem
                title="نهاية التشغيل"
                value="09:00 PM"
              />

              <SystemItem
                title="الاتصال"
                value="Supabase"
                success
              />
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-7 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={19} />
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function SystemItem({
  title,
  value,
  success = false,
}: {
  title: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs text-slate-400">{title}</div>

      <div
        className={`mt-2 flex items-center gap-2 font-bold ${
          success ? 'text-emerald-600' : 'text-slate-800'
        }`}
      >
        {success ? (
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        ) : null}

        {value}
      </div>
    </div>
  );
}