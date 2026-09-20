'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, LogIn, LogOut, RefreshCw, UserRound } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
type Staff = {
  id: string;
  full_name: string;
  employee_code: string;
  phone: string | null;
  is_active: boolean;
};

type AttendanceStatus =
  | 'not_arrived'
  | 'working'
  | 'available'
  | 'break'
  | 'checked_out';

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_arrived: 'لم يحضر',
  working: 'يعمل',
  available: 'متاح',
  break: 'في استراحة',
  checked_out: 'انصرف',
};

export default function AttendanceScanPage() {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [status, setStatus] =
    useState<AttendanceStatus>('not_arrived');

  const [eventId, setEventId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('staffId');

    if (!id) {
      setError('لم يتم العثور على كود الموظف في QR');
      setLoading(false);
      return;
    }

    setStaffId(id);
    loadStaff(id);
  }, []);

  async function loadStaff(id: string) {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select(
          'id, full_name, employee_code, phone, is_active'
        )
        .eq('id', id)
        .maybeSingle();

      if (staffError) {
        throw staffError;
      }

      if (!staffData) {
        throw new Error('الموظف غير موجود');
      }

      setStaff(staffData);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, name, is_active')
        .eq('name', 'Event 26')
        .eq('is_active', true)
        .maybeSingle();

      if (eventError) {
        throw eventError;
      }

      if (!eventData) {
        throw new Error('Event 26 غير موجود أو غير نشط');
      }

      setEventId(eventData.id);

      const { data: eventStaffData, error: eventStaffError } =
        await supabase
          .from('event_staff')
          .select('status')
          .eq('event_id', eventData.id)
          .eq('staff_id', id)
          .maybeSingle();

      if (eventStaffError) {
        throw eventStaffError;
      }

      setStatus(
        (eventStaffData?.status as AttendanceStatus) ||
          'not_arrived'
      );
    } catch (err) {
      console.error('QR load error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تحميل بيانات الموظف'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn() {
    if (!staffId || !eventId) return;

    setProcessing(true);
    setError('');
    setMessage('');

    try {
      const now = new Date().toISOString();

      const { data: activeBreak, error: breakError } =
        await supabase
          .from('breaks')
          .select('id')
          .eq('event_id', eventId)
          .eq('staff_id', staffId)
          .lte('starts_at', now)
          .or(`ends_at.is.null,ends_at.gt.${now}`)
          .limit(1)
          .maybeSingle();

      if (breakError) {
        throw breakError;
      }

      const newStatus: AttendanceStatus = activeBreak
        ? 'break'
        : 'working';

      const { error: updateError } = await supabase
        .from('event_staff')
        .upsert(
          {
            event_id: eventId,
            staff_id: staffId,
            status: newStatus,
          },
          {
            onConflict: 'event_id,staff_id',
          }
        );

      if (updateError) {
        throw updateError;
      }

      const { error: logError } = await supabase
        .from('attendance_logs')
        .insert({
          event_id: eventId,
          staff_id: staffId,
          action: 'check_in',
          action_at: now,
        });

      if (logError) {
        throw logError;
      }

      if (activeBreak) {
        await supabase
          .from('attendance_logs')
          .insert({
            event_id: eventId,
            staff_id: staffId,
            action: 'break_start',
            action_at: now,
          });
      }

      setStatus(newStatus);
      setMessage('تم تسجيل الحضور بنجاح ✓');
    } catch (err) {
      console.error('QR check-in error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تسجيل الحضور'
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleCheckOut() {
    if (!staffId || !eventId) return;

    setProcessing(true);
    setError('');
    setMessage('');

    try {
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('event_staff')
        .update({
          status: 'checked_out',
        })
        .eq('event_id', eventId)
        .eq('staff_id', staffId);

      if (updateError) {
        throw updateError;
      }

      const { error: logError } = await supabase
        .from('attendance_logs')
        .insert({
          event_id: eventId,
          staff_id: staffId,
          action: 'check_out',
          action_at: now,
        });

      if (logError) {
        throw logError;
      }

      setStatus('checked_out');
      setMessage('تم تسجيل الانصراف بنجاح ✓');
    } catch (err) {
      console.error('QR check-out error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تسجيل الانصراف'
      );
    } finally {
      setProcessing(false);
    }
  }

  async function refreshStatus() {
    if (!staffId) return;
    await loadStaff(staffId);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen flex items-center justify-center bg-slate-50 p-6"
      >
        <div className="rounded-2xl bg-white p-8 shadow-lg text-center">
          <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-lg font-semibold">
            جاري تحميل بيانات الموظف...
          </p>
        </div>
      </main>
    );
  }

  if (error && !staff) {
    return (
      <main
        dir="rtl"
        className="min-h-screen flex items-center justify-center bg-slate-50 p-6"
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mb-4 text-5xl">⚠️</div>

          <h1 className="mb-3 text-xl font-bold">
            تعذر تحميل بيانات الموظف
          </h1>

          <p className="mb-6 text-red-600">
            {error}
          </p>

          <button
            onClick={() => staffId && loadStaff(staffId)}
            className="w-full rounded-xl bg-slate-900 px-5 py-3 font-bold text-white"
          >
            إعادة المحاولة
          </button>
        </div>
      </main>
    );
  }

  if (!staff) {
    return null;
  }

  const isCheckedIn =
    status === 'working' ||
    status === 'available' ||
    status === 'break';

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-100 px-4 py-8"
    >
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="bg-slate-900 px-6 py-8 text-center text-white">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
              <UserRound className="h-10 w-10" />
            </div>

            <h1 className="text-2xl font-bold">
              تسجيل الحضور
            </h1>

            <p className="mt-2 text-sm text-slate-300">
              Event 26
            </p>
          </div>

          <div className="space-y-5 p-6">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="mb-1 text-sm text-slate-500">
                اسم الموظف
              </p>

              <p className="text-xl font-bold text-slate-900">
                {staff.full_name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  كود الموظف
                </p>

                <p className="mt-1 font-bold">
                  {staff.employee_code}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  الحالة
                </p>

                <p className="mt-1 font-bold">
                  {STATUS_LABELS[status]}
                </p>
              </div>
            </div>

            {staff.phone && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  الهاتف
                </p>

                <p className="mt-1 font-bold">
                  {staff.phone}
                </p>
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-green-700">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="font-semibold">
                  {message}
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            {!isCheckedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={processing || !staff.is_active}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-green-600 px-5 py-4 text-lg font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogIn className="h-6 w-6" />
                {processing
                  ? 'جاري التسجيل...'
                  : 'تسجيل حضور'}
              </button>
            ) : (
              <button
                onClick={handleCheckOut}
                disabled={processing}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red-600 px-5 py-4 text-lg font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="h-6 w-6" />
                {processing
                  ? 'جاري التسجيل...'
                  : 'تسجيل انصراف'}
              </button>
            )}

            <button
              onClick={refreshStatus}
              disabled={processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-5 w-5" />
              تحديث الحالة
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          نظام إدارة التشغيل والفعاليات
        </p>
      </div>
    </main>
  );
}