'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
ArrowRight,
BriefcaseBusiness,
CalendarDays,
CheckCircle2,
Clock3,
Coffee,
MapPin,
RefreshCw,
UserCheck,
Users,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

const EVENT_NAME = 'Event 26';

type EventRow = {
id: string;
name: string;
is_active: boolean;
};

type SectorRow = {
id: string;
name: string;
name_ar: string | null;
};

type StaffRow = {
id: string;
full_name: string;
employee_code: string;
phone: string | null;
is_active: boolean;
};

type EventStaffRow = {
staff_id: string;
sector_id: string | null;
status:
| 'not_arrived'
| 'working'
| 'available'
| 'break'
| 'checked_out';
};

type AssignmentRow = {
id: string;
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

type BreakRow = {
id: string;
staff_id: string;
starts_at: string;
ends_at: string | null;
duration_minutes: number | null;
};

type SectorStaffView = StaffRow & {
attendanceStatus: EventStaffRow['status'];
assignments: AssignmentRow[];
breaks: BreakRow[];
};

function formatDateInput(date: Date) {
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');

return `${year}-${month}-${day}`;
}

function getLocalDateString(value: string) {
return formatDateInput(new Date(value));
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

function formatTime(value: string) {
return new Intl.DateTimeFormat('en-US', {
hour: 'numeric',
minute: '2-digit',
hour12: true,
}).format(new Date(value));
}

function statusLabel(status: EventStaffRow['status']) {
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

function statusClass(status: EventStaffRow['status']) {
switch (status) {
case 'working':
return 'border-emerald-200 bg-emerald-50 text-emerald-700';
case 'available':
return 'border-blue-200 bg-blue-50 text-blue-700';
case 'break':
return 'border-orange-200 bg-orange-50 text-orange-700';
case 'checked_out':
return 'border-slate-200 bg-slate-100 text-slate-600';
case 'not_arrived':
default:
return 'border-amber-200 bg-amber-50 text-amber-700';
}
}

function assignmentStatusLabel(status: AssignmentRow['status']) {
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

function assignmentStatusClass(status: AssignmentRow['status']) {
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
return 'border-slate-200 bg-slate-100 text-slate-700';
}
}

function SectorDetailsContent() {
const searchParams = useSearchParams();
const sectorId = searchParams.get('id');

const [event, setEvent] = useState<EventRow | null>(null);
const [sector, setSector] = useState<SectorRow | null>(null);
const [staff, setStaff] = useState<SectorStaffView[]>([]);
const [selectedDate, setSelectedDate] = useState(
formatDateInput(new Date())
);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [errorMessage, setErrorMessage] = useState('');

const loadSector = useCallback(
async (showLoader = true) => {
if (!sectorId) {
setLoading(false);
setErrorMessage(
'لم يتم تحديد القطاع. افتح صفحة القطاعات واضغط على القطاع المطلوب.'
);
return;
}

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
      throw new Error('لم يتم العثور على Event 26.');
    }

    setEvent(eventData);

    const [
      sectorResult,
      eventStaffResult,
      staffResult,
      assignmentResult,
      breakResult,
    ] = await Promise.all([
      supabase
        .from('sectors')
        .select('id, name, name_ar')
        .eq('id', sectorId)
        .maybeSingle(),

      supabase
        .from('event_staff')
        .select('staff_id, sector_id, status')
        .eq('event_id', eventData.id)
        .eq('sector_id', sectorId),

      supabase
        .from('staff')
        .select(
          'id, full_name, employee_code, phone, is_active'
        )
        .eq('is_active', true)
        .order('employee_code', { ascending: true }),

      supabase
        .from('assignments')
        .select(
          'id, staff_id, sector_id, title, starts_at, ends_at, status'
        )
        .eq('event_id', eventData.id)
        .eq('sector_id', sectorId)
        .neq('status', 'cancelled')
        .order('starts_at', { ascending: true }),

      supabase
        .from('breaks')
        .select(
          'id, staff_id, starts_at, ends_at, duration_minutes'
        )
        .eq('event_id', eventData.id)
        .order('starts_at', { ascending: true }),
    ]);

    if (sectorResult.error) {
      throw sectorResult.error;
    }

    if (eventStaffResult.error) {
      throw eventStaffResult.error;
    }

    if (staffResult.error) {
      throw staffResult.error;
    }

    if (assignmentResult.error) {
      throw assignmentResult.error;
    }

    if (breakResult.error) {
      throw breakResult.error;
    }

    if (!sectorResult.data) {
      throw new Error('القطاع غير موجود.');
    }

    setSector(sectorResult.data);

    const staffMap = new Map(
      (staffResult.data ?? []).map((person) => [
        person.id,
        person as StaffRow,
      ])
    );

    const assignmentMap = new Map<string, AssignmentRow[]>();

    for (const item of (assignmentResult.data ?? []) as AssignmentRow[]) {
      if (getLocalDateString(item.starts_at) !== selectedDate) {
        continue;
      }

      const list = assignmentMap.get(item.staff_id) ?? [];
      list.push(item);
      assignmentMap.set(item.staff_id, list);
    }

    const breakMap = new Map<string, BreakRow[]>();

    for (const item of (breakResult.data ?? []) as BreakRow[]) {
      if (getLocalDateString(item.starts_at) !== selectedDate) {
        continue;
      }

      const list = breakMap.get(item.staff_id) ?? [];
      list.push(item);
      breakMap.set(item.staff_id, list);
    }

    const mappedStaff: SectorStaffView[] = (
      eventStaffResult.data ?? []
    ).flatMap((row) => {
      const person = staffMap.get(row.staff_id);

      if (!person) {
        return [];
      }

      return [
        {
          ...person,
          attendanceStatus: row.status as EventStaffRow['status'],
          assignments: assignmentMap.get(person.id) ?? [],
          breaks: breakMap.get(person.id) ?? [],
        },
      ];
    });

    setStaff(mappedStaff);
  } catch (error) {
    console.warn('Sector details load error:', error);

    setErrorMessage(
      error instanceof Error
        ? error.message
        : 'تعذر تحميل تفاصيل القطاع.'
    );
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
},
[sectorId, selectedDate]

);

useEffect(() => {
loadSector(true);
}, [loadSector]);

useEffect(() => {
const interval = setInterval(() => {
loadSector(false);
}, 10000);

return () => clearInterval(interval);

}, [loadSector]);

const totals = useMemo(
() =>
staff.reduce(
(sum, person) => ({
staff: sum.staff + 1,
present:
sum.present +
(person.attendanceStatus === 'working' ||
person.attendanceStatus === 'available' ||
person.attendanceStatus === 'break'
? 1
: 0),
working:
sum.working +
(person.attendanceStatus === 'working' ? 1 : 0),
available:
sum.available +
(person.attendanceStatus === 'available' ? 1 : 0),
breaks:
sum.breaks +
(person.attendanceStatus === 'break' ? 1 : 0),
assignments: sum.assignments + person.assignments.length,
breakItems: sum.breakItems + person.breaks.length,
}),
{
staff: 0,
present: 0,
working: 0,
available: 0,
breaks: 0,
assignments: 0,
breakItems: 0,
}
),
[staff]
);

if (loading) {
return ( <main
     dir="rtl"
     className="min-h-screen bg-slate-50 p-6 text-slate-900"
   > <div className="mx-auto max-w-[1600px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
جاري تحميل تفاصيل القطاع... </div> </main>
);
}

return ( <main
   dir="rtl"
   className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6"
 > <div className="mx-auto max-w-[1600px]"> <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"> <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"> <div> <Link
             href="/sectors"
             className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
           > <ArrowRight size={17} />
العودة إلى القطاعات </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <MapPin size={28} />
            </div>

            <div>
              <h1 className="text-2xl font-black md:text-3xl">
                {sector?.name_ar || sector?.name}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {sector?.name} — {event?.name ?? EVENT_NAME}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <CalendarDays size={18} />

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => loadSector(false)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <RefreshCw
              size={17}
              className={refreshing ? 'animate-spin' : ''}
            />
            تحديث
          </button>
        </div>
      </div>
    </header>

    {errorMessage ? (
      <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
        {errorMessage}
      </div>
    ) : null}

    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">
        بيانات اليوم
      </div>
      <div className="mt-1 text-lg font-bold">
        {formatArabicDate(selectedDate)}
      </div>
    </div>

    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users size={17} />
          الموظفون
        </div>
        <div className="mt-2 text-3xl font-black">
          {totals.staff}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <UserCheck size={17} />
          حاضرون
        </div>
        <div className="mt-2 text-3xl font-black text-emerald-700">
          {totals.present}
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Clock3 size={17} />
          يعملون
        </div>
        <div className="mt-2 text-3xl font-black text-blue-700">
          {totals.working}
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <CheckCircle2 size={17} />
          متاحون
        </div>
        <div className="mt-2 text-3xl font-black text-blue-700">
          {totals.available}
        </div>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-orange-700">
          <Coffee size={17} />
          استراحة
        </div>
        <div className="mt-2 text-3xl font-black text-orange-700">
          {totals.breaks}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <BriefcaseBusiness size={17} />
          التكليفات
        </div>
        <div className="mt-2 text-3xl font-black">
          {totals.assignments}
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-xl font-black">
          فريق القطاع
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          الموظفون المرتبطون بهذا القطاع مع تكليفاتهم واستراحاتهم.
        </p>
      </div>

      {staff.length === 0 ? (
        <div className="p-10 text-center text-slate-500">
          لا يوجد موظفون مرتبطون بهذا القطاع حتى الآن.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {staff.map((person) => (
            <div
              key={person.id}
              className="p-5"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-slate-900">
                      {person.full_name}
                    </div>

                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600">
                      {person.employee_code}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                        person.attendanceStatus
                      )}`}
                    >
                      {statusLabel(person.attendanceStatus)}
                    </span>
                  </div>

                  {person.phone ? (
                    <div
                      className="mt-2 text-sm text-slate-500"
                      dir="ltr"
                    >
                      {person.phone}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[650px] xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                      <BriefcaseBusiness size={16} />
                      تكليفات يوم {formatArabicDate(selectedDate)}
                    </div>

                    {person.assignments.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        لا يوجد تكليف في هذا اليوم.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {person.assignments.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-white bg-white p-3"
                          >
                            <div className="font-semibold">
                              {item.title}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>
                                {formatTime(item.starts_at)} —{' '}
                                {formatTime(item.ends_at)}
                              </span>

                              <span
                                className={`rounded-full border px-2 py-0.5 font-semibold ${assignmentStatusClass(
                                  item.status
                                )}`}
                              >
                                {assignmentStatusLabel(item.status)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-orange-800">
                      <Coffee size={16} />
                      استراحات اليوم
                    </div>

                    {person.breaks.length === 0 ? (
                      <div className="text-sm text-orange-700/70">
                        لا توجد استراحة في هذا اليوم.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {person.breaks.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-orange-200 bg-white/70 p-3"
                          >
                            <div className="font-semibold text-orange-900">
                              استراحة
                            </div>

                            <div className="mt-1 text-xs text-orange-800">
                              {formatTime(item.starts_at)}
                              {item.ends_at
                                ? ` — ${formatTime(item.ends_at)}`
                                : ''}
                            </div>

                            {item.duration_minutes ? (
                              <div className="mt-1 text-xs text-orange-700/70">
                                المدة: {item.duration_minutes} دقيقة
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  </div>
</main>

);
}

function LoadingSectorDetails() {
return ( <main
   dir="rtl"
   className="min-h-screen bg-slate-50 p-6 text-slate-900"
 > <div className="mx-auto max-w-[1600px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
جاري تحميل تفاصيل القطاع... </div> </main>
);
}

export default function SectorDetailsPage() {
return (
<Suspense fallback={<LoadingSectorDetails />}> <SectorDetailsContent /> </Suspense>
);
}
