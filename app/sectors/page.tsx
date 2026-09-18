'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Coffee,
  Grid2X2,
  MapPin,
  RefreshCw,
  UserCheck,
  Users,
  X,
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

type StaffRow = {
  id: string;
  full_name: string;
  employee_code: string | null;
  phone: string | null;
  is_active: boolean;
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

type SectorStaff = {
  id: string;
  fullName: string;
  employeeCode: string;
  phone: string;
  status: EventStaffRow['status'];
};

type SectorView = {
  id: string;
  name: string;
  nameAr: string;
  staffCount: number;
  presentCount: number;
  workingCount: number;
  availableCount: number;
  breakCount: number;
  activeAssignments: number;
  totalAssignments: number;
  staff: SectorStaff[];
};

function formatArabicDate(date: Date) {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function isActiveAssignment(
  item: AssignmentRow,
  now = Date.now()
) {
  if (item.status === 'cancelled' || item.status === 'completed') {
    return false;
  }

  const start = new Date(item.starts_at).getTime();
  const end = new Date(item.ends_at).getTime();

  return start <= now && now < end;
}

function getStatusLabel(status: EventStaffRow['status']) {
  switch (status) {
    case 'working':
      return 'يعمل';
    case 'available':
      return 'متاح';
    case 'break':
      return 'استراحة';
    case 'not_arrived':
      return 'لم يصل';
    case 'checked_out':
      return 'انصرف';
    default:
      return status;
  }
}

function getStatusClass(status: EventStaffRow['status']) {
  switch (status) {
    case 'working':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'available':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'break':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'not_arrived':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'checked_out':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-600';
  }
}

export default function SectorsPage() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [sectors, setSectors] = useState<SectorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedStaff, setSelectedStaff] = useState<{
    id: string;
    fullName: string;
    employeeCode: string;
    currentSectorId: string;
  } | null>(null);

  const [movingStaff, setMovingStaff] = useState(false);
  const [moveError, setMoveError] = useState('');
  const [moveSuccess, setMoveSuccess] = useState('');

  const loadSectors = useCallback(
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
          throw new Error(
            `لم يتم العثور على الفعالية النشطة "${EVENT_NAME}".`
          );
        }

        setEvent(eventData);

        const [
          sectorResult,
          eventStaffResult,
          assignmentsResult,
          staffResult,
        ] = await Promise.all([
          supabase
            .from('sectors')
            .select('id, name, name_ar')
            .order('name_ar', { ascending: true }),

          supabase
            .from('event_staff')
            .select('staff_id, sector_id, status')
            .eq('event_id', eventData.id),

          supabase
            .from('assignments')
            .select(
              'id, staff_id, sector_id, title, starts_at, ends_at, status'
            )
            .eq('event_id', eventData.id)
            .neq('status', 'cancelled'),

          supabase
            .from('staff')
            .select(
              'id, full_name, employee_code, phone, is_active'
            )
            .eq('is_active', true)
            .order('employee_code', {
              ascending: true,
            }),
        ]);

        if (sectorResult.error) {
          throw sectorResult.error;
        }

        if (eventStaffResult.error) {
          throw eventStaffResult.error;
        }

        if (assignmentsResult.error) {
          throw assignmentsResult.error;
        }

        if (staffResult.error) {
          throw staffResult.error;
        }

        const sectorData = (sectorResult.data ??
          []) as SectorRow[];

        const eventStaffData = (eventStaffResult.data ??
          []) as EventStaffRow[];

        const assignmentData = (assignmentsResult.data ??
          []) as AssignmentRow[];

        const staffData = (staffResult.data ??
          []) as StaffRow[];

        const staffMap = new Map<string, StaffRow>();

        for (const staff of staffData) {
          staffMap.set(staff.id, staff);
        }

        const now = Date.now();

        const mapped: SectorView[] = sectorData.map((sector) => {
          const staffRows = eventStaffData.filter(
            (row) => row.sector_id === sector.id
          );

          const assignedRows = assignmentData.filter(
            (row) => row.sector_id === sector.id
          );

          const presentRows = staffRows.filter(
            (row) =>
              row.status === 'working' ||
              row.status === 'available' ||
              row.status === 'break'
          );

          const sectorStaff: SectorStaff[] = staffRows
            .map((row) => {
              const staff = staffMap.get(row.staff_id);

              if (!staff) {
                return null;
              }

              return {
                id: staff.id,
                fullName: staff.full_name,
                employeeCode:
                  staff.employee_code || 'بدون كود',
                phone: staff.phone || '',
                status: row.status,
              };
            })
            .filter(
              (item): item is SectorStaff => item !== null
            );

          return {
            id: sector.id,
            name: sector.name,
            nameAr: sector.name_ar || sector.name,
            staffCount: staffRows.length,
            presentCount: presentRows.length,
            workingCount: staffRows.filter(
              (row) => row.status === 'working'
            ).length,
            availableCount: staffRows.filter(
              (row) => row.status === 'available'
            ).length,
            breakCount: staffRows.filter(
              (row) => row.status === 'break'
            ).length,
            activeAssignments: assignedRows.filter((row) =>
              isActiveAssignment(row, now)
            ).length,
            totalAssignments: assignedRows.length,
            staff: sectorStaff,
          };
        });

        setSectors(mapped);
      } catch (error) {
        console.warn('Sectors load error:', error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل بيانات القطاعات.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadSectors(true);
  }, [loadSectors]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadSectors(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [loadSectors]);

  const totals = useMemo(
    () =>
      sectors.reduce(
        (sum, sector) => ({
          staff: sum.staff + sector.staffCount,
          present: sum.present + sector.presentCount,
          working: sum.working + sector.workingCount,
          available: sum.available + sector.availableCount,
          breaks: sum.breaks + sector.breakCount,
          activeAssignments:
            sum.activeAssignments + sector.activeAssignments,
          assignments:
            sum.assignments + sector.totalAssignments,
        }),
        {
          staff: 0,
          present: 0,
          working: 0,
          available: 0,
          breaks: 0,
          activeAssignments: 0,
          assignments: 0,
        }
      ),
    [sectors]
  );

  async function moveStaffToSector(
    targetSectorId: string
  ) {
    if (!selectedStaff) {
      return;
    }

    if (selectedStaff.currentSectorId === targetSectorId) {
      setMoveError('الموظف موجود بالفعل في هذا القطاع.');
      return;
    }

    try {
      setMovingStaff(true);
      setMoveError('');
      setMoveSuccess('');

      const { error } = await supabase
        .from('event_staff')
        .update({
          sector_id: targetSectorId,
        })
        .eq('event_id', event?.id)
        .eq('staff_id', selectedStaff.id);

      if (error) {
        throw error;
      }

      const targetSector = sectors.find(
        (sector) => sector.id === targetSectorId
      );

      setMoveSuccess(
        `تم نقل ${selectedStaff.fullName} إلى ${
          targetSector?.nameAr || 'القطاع الجديد'
        } بنجاح.`
      );

      setSelectedStaff(null);

      await loadSectors(false);
    } catch (error) {
      console.error('Move staff error:', error);

      setMoveError(
        error instanceof Error
          ? error.message
          : 'تعذر نقل الموظف. حاول مرة أخرى.'
      );
    } finally {
      setMovingStaff(false);
    }
  }

  function openMoveModal(
    staff: SectorStaff,
    currentSectorId: string
  ) {
    setMoveError('');
    setMoveSuccess('');

    setSelectedStaff({
      id: staff.id,
      fullName: staff.fullName,
      employeeCode: staff.employeeCode,
      currentSectorId,
    });
  }

  function closeMoveModal() {
    if (movingStaff) {
      return;
    }

    setSelectedStaff(null);
    setMoveError('');
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 p-6 text-slate-900"
      >
        <div className="mx-auto max-w-[1600px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          جاري تحميل القطاعات...
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6"
    >
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Grid2X2 size={18} />
              نظام إدارة التشغيل والفعاليات
            </div>

            <h1 className="text-2xl font-bold md:text-3xl">
              القطاعات
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              اختر أي قطاع لفتح تفاصيل الموظفين والتكليفات والاستراحات.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSectors(false)}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <RefreshCw
              size={17}
              className={refreshing ? 'animate-spin' : ''}
            />
            تحديث
          </button>
        </header>

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            تعذر تحميل القطاعات: {errorMessage}
          </div>
        ) : null}

        {moveSuccess ? (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            <span>{moveSuccess}</span>

            <button
              type="button"
              onClick={() => setMoveSuccess('')}
              className="rounded-lg p-1 hover:bg-emerald-100"
            >
              <X size={17} />
            </button>
          </div>
        ) : null}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-500">
                ملخص اليوم
              </div>

              <div className="mt-1 text-lg font-bold">
                {formatArabicDate(new Date())}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              {event?.name ?? EVENT_NAME} — البيانات مباشرة
            </div>
          </div>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Grid2X2 size={17} />
              القطاعات
            </div>

            <div className="mt-2 text-3xl font-black">
              {sectors.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Users size={17} />
              موزعون
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
              تكليفات نشطة
            </div>

            <div className="mt-2 text-3xl font-black">
              {totals.activeAssignments}
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sectors.map((sector) => {
            const fillWidth =
              totals.staff > 0
                ? Math.min(
                    100,
                    (sector.staffCount / totals.staff) * 100
                  )
                : 0;

            return (
              <div
                key={sector.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <Link
                  href={`/sectors/details?id=${sector.id}`}
                  className="group block"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <MapPin size={21} />
                        </div>

                        <div>
                          <h2 className="text-lg font-black">
                            {sector.nameAr}
                          </h2>

                          <p className="mt-0.5 text-xs text-slate-400">
                            {sector.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-center">
                      <div className="text-2xl font-black">
                        {sector.staffCount}
                      </div>

                      <div className="text-[11px] text-slate-500">
                        موظف
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">
                        نسبة التوزيع
                      </span>

                      <span className="font-semibold text-slate-700">
                        {Math.round(fillWidth)}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${fillWidth}%` }}
                      />
                    </div>
                  </div>
                </Link>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-700">
                      حاضرون
                    </div>

                    <div className="mt-1 text-xl font-black text-emerald-700">
                      {sector.presentCount}
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <div className="text-xs text-blue-700">
                      يعملون
                    </div>

                    <div className="mt-1 text-xl font-black text-blue-700">
                      {sector.workingCount}
                    </div>
                  </div>

                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <div className="text-xs text-orange-700">
                      استراحة
                    </div>

                    <div className="mt-1 text-xl font-black text-orange-700">
                      {sector.breakCount}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-600">
                      متاحون
                    </div>

                    <div className="mt-1 text-xl font-black text-slate-700">
                      {sector.availableCount}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <Users size={16} />
                      موظفو القطاع
                    </div>

                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                      {sector.staff.length}
                    </span>
                  </div>

                  {sector.staff.length > 0 ? (
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {sector.staff.map((staff) => (
                        <div
                          key={staff.id}
                          className="rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-800">
                                {staff.fullName}
                              </div>

                              <div className="mt-1 text-xs text-slate-400">
                                كود الموظف: {staff.employeeCode}
                              </div>

                              <div className="mt-2">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusClass(
                                    staff.status
                                  )}`}
                                >
                                  {getStatusLabel(staff.status)}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                openMoveModal(
                                  staff,
                                  sector.id
                                )
                              }
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                            >
                              <ArrowRight size={14} />
                              نقل
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-400">
                      لا يوجد موظفون موزعون على هذا القطاع حاليًا.
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                      <BriefcaseBusiness size={14} />
                      {sector.totalAssignments} تكليف
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={14} />
                      {sector.activeAssignments} نشط
                    </span>
                  </div>

                  <Link
                    href={`/sectors/details?id=${sector.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"
                  >
                    التفاصيل
                    <ArrowLeft size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </section>

        {sectors.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            لا توجد قطاعات في قاعدة البيانات.
          </div>
        ) : null}
      </div>

      {selectedStaff ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMoveModal();
            }
          }}
        >
          <div
            dir="rtl"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  نقل الموظف
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  اختر القطاع الجديد للموظف
                </p>
              </div>

              <button
                type="button"
                onClick={closeMoveModal}
                disabled={movingStaff}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-sm font-black text-blue-900">
                  {selectedStaff.fullName}
                </div>

                <div className="mt-1 text-xs text-blue-700">
                  كود الموظف: {selectedStaff.employeeCode}
                </div>

                <div className="mt-3 text-xs font-semibold text-blue-700">
                  القطاع الحالي:
                  {' '}
                  {
                    sectors.find(
                      (sector) =>
                        sector.id ===
                        selectedStaff.currentSectorId
                    )?.nameAr
                  }
                </div>
              </div>

              {moveError ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {moveError}
                </div>
              ) : null}

              <div className="mb-3 text-sm font-bold text-slate-700">
                اختر القطاع الجديد
              </div>

              <div className="max-h-80 space-y-2 overflow-y-auto">
                {sectors
                  .filter(
                    (sector) =>
                      sector.id !==
                      selectedStaff.currentSectorId
                  )
                  .map((sector) => (
                    <button
                      key={sector.id}
                      type="button"
                      disabled={movingStaff}
                      onClick={() =>
                        moveStaffToSector(sector.id)
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-right transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          <MapPin size={18} />
                        </div>

                        <div>
                          <div className="text-sm font-black text-slate-800">
                            {sector.nameAr}
                          </div>

                          <div className="mt-0.5 text-xs text-slate-400">
                            {sector.name}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-slate-500">
                        {sector.staffCount} موظف
                      </div>
                    </button>
                  ))}
              </div>

              {movingStaff ? (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-600">
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
                  جاري نقل الموظف...
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

