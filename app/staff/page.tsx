'use client';

import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MAX_TEAM_SIZE = 500;

type Staff = {
  id: string;
  full_name: string;
  employee_code: string;
  phone: string | null;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

type StaffForm = {
  full_name: string;
  employee_code: string;
  phone: string;
  notes: string;
  is_active: boolean;
};

const emptyForm: StaffForm = {
  full_name: '',
  employee_code: '',
  phone: '',
  notes: '',
  is_active: true,
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

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadStaff() {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('staff')
        .select(
          'id, full_name, employee_code, phone, is_active, notes, created_at, updated_at'
        )
        .order('employee_code', { ascending: true })
        .limit(MAX_TEAM_SIZE);

      if (error) {
        throw error;
      }

      setStaff((data ?? []) as Staff[]);
    } catch (error) {
      console.error('Supabase staff error:', error);

      setErrorMessage(
        `تعذر جلب بيانات فريق العمل من قاعدة البيانات: ${getErrorMessage(
          error
        )}`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  const activeCount = useMemo(
    () => staff.filter((person) => person.is_active).length,
    [staff]
  );

  const inactiveCount = useMemo(
    () => staff.filter((person) => !person.is_active).length,
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

  function openAddModal() {
    if (staff.length >= MAX_TEAM_SIZE) {
      setErrorMessage(
        `تم الوصول إلى الحد الأقصى للفريق وهو ${MAX_TEAM_SIZE} موظف.`
      );
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setEditingStaff(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(person: Staff) {
    setErrorMessage('');
    setSuccessMessage('');
    setEditingStaff(person);

    setForm({
      full_name: person.full_name ?? '',
      employee_code: person.employee_code ?? '',
      phone: person.phone ?? '',
      notes: person.notes ?? '',
      is_active: person.is_active,
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingStaff(null);
    setForm(emptyForm);
  }

  function updateForm(field: keyof StaffForm, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    const fullName = form.full_name.trim();
    const employeeCode = form.employee_code.trim();
    const phone = form.phone.trim();
    const notes = form.notes.trim();

    if (!fullName) {
      setErrorMessage('من فضلك أدخل اسم الموظف.');
      return;
    }

    if (!employeeCode) {
      setErrorMessage('من فضلك أدخل كود الموظف.');
      return;
    }

    setSaving(true);

    try {
      if (!editingStaff) {
        /*
         * نعيد قراءة العدد من قاعدة البيانات قبل الإضافة
         * حتى لا نعتمد فقط على العدد الموجود حاليًا في الشاشة.
         */
        const { count, error: countError } = await supabase
          .from('staff')
          .select('id', { count: 'exact', head: true });

        if (countError) {
          throw countError;
        }

        if ((count ?? 0) >= MAX_TEAM_SIZE) {
          setErrorMessage(
            `لا يمكن إضافة موظف جديد. الحد الأقصى هو ${MAX_TEAM_SIZE} موظف.`
          );
          await loadStaff();
          return;
        }

        const { data, error } = await supabase
          .from('staff')
          .insert({
            full_name: fullName,
            employee_code: employeeCode,
            phone: phone || null,
            notes: notes || null,
            is_active: form.is_active,
          })
          .select(
            'id, full_name, employee_code, phone, is_active, notes, created_at, updated_at'
          )
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error(
              'كود الموظف موجود بالفعل. استخدم كودًا مختلفًا.'
            );
          }

          throw error;
        }

        if (data) {
          setStaff((current) =>
            [...current, data as Staff].sort((a, b) =>
              a.employee_code.localeCompare(b.employee_code, undefined, {
                numeric: true,
                sensitivity: 'base',
              })
            )
          );
        }

        setSuccessMessage(`تمت إضافة الموظف "${fullName}" بنجاح.`);
      } else {
        const { data, error } = await supabase
          .from('staff')
          .update({
            full_name: fullName,
            employee_code: employeeCode,
            phone: phone || null,
            notes: notes || null,
            is_active: form.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingStaff.id)
          .select(
            'id, full_name, employee_code, phone, is_active, notes, created_at, updated_at'
          )
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error(
              'كود الموظف موجود بالفعل لموظف آخر. استخدم كودًا مختلفًا.'
            );
          }

          throw error;
        }

        if (data) {
          setStaff((current) =>
            current
              .map((person) =>
                person.id === editingStaff.id ? (data as Staff) : person
              )
              .sort((a, b) =>
                a.employee_code.localeCompare(b.employee_code, undefined, {
                  numeric: true,
                  sensitivity: 'base',
                })
              )
          );
        }

        setSuccessMessage(`تم تحديث بيانات "${fullName}" بنجاح.`);
      }

      setShowModal(false);
      setEditingStaff(null);
      setForm(emptyForm);
    } catch (error) {
      console.error('Save staff error:', error);

      setErrorMessage(
        `تعذر حفظ بيانات الموظف: ${getErrorMessage(error)}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStaff(person: Staff) {
    setErrorMessage('');
    setSuccessMessage('');
    setTogglingId(person.id);

    try {
      const newStatus = !person.is_active;

      const { data, error } = await supabase
        .from('staff')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', person.id)
        .select(
          'id, full_name, employee_code, phone, is_active, notes, created_at, updated_at'
        )
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setStaff((current) =>
          current.map((item) =>
            item.id === person.id ? (data as Staff) : item
          )
        );
      }

      setSuccessMessage(
        newStatus
          ? `تم تفعيل الموظف "${person.full_name}".`
          : `تم إيقاف الموظف "${person.full_name}".`
      );
    } catch (error) {
      console.error('Toggle staff error:', error);

      setErrorMessage(
        `تعذر تغيير حالة الموظف: ${getErrorMessage(error)}`
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              فريق العمل
            </h1>

            <p className="mt-2 text-base text-slate-500">
              إدارة فريق العمل — الحد الأقصى {MAX_TEAM_SIZE} موظف
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadStaff}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
              />
              تحديث
            </button>

            <button
              type="button"
              onClick={openAddModal}
              disabled={staff.length >= MAX_TEAM_SIZE}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus className="h-5 w-5" />
              إضافة موظف
            </button>
          </div>
        </header>

        {/* Connection status */}
        {!errorMessage ? (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
            <CheckCircle2 className="h-6 w-6 shrink-0" />

            <span className="font-medium">
              الاتصال بقاعدة البيانات يعمل بنجاح
            </span>
          </div>
        ) : (
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

        {/* Success message */}
        {successMessage && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
            <CheckCircle2 className="h-6 w-6 shrink-0" />

            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Statistics */}
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  إجمالي الفريق
                </p>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-900">
                    {staff.length}
                  </span>

                  <span className="text-lg text-slate-400">
                    / {MAX_TEAM_SIZE}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <Users className="h-7 w-7 text-blue-600" />
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (staff.length / MAX_TEAM_SIZE) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  الموظفون النشطون
                </p>

                <p className="mt-2 text-4xl font-bold text-emerald-600">
                  {activeCount}
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-4">
                <UserCheck className="h-7 w-7 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  الموظفون الموقوفون
                </p>

                <p className="mt-2 text-4xl font-bold text-slate-600">
                  {inactiveCount}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-100 p-4">
                <UserX className="h-7 w-7 text-slate-600" />
              </div>
            </div>
          </div>
        </section>

        {/* Search */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالاسم أو كود الموظف أو رقم الهاتف..."
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pr-12 pl-4 text-base outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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

        {/* Staff table */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  قائمة الموظفين
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  عرض {filteredStaff.length} من {staff.length} موظف
                </p>
              </div>

              <div className="hidden rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 sm:block">
                الحد الأقصى: {MAX_TEAM_SIZE}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span>جاري تحميل فريق العمل...</span>
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
                  : 'لا يوجد موظفون حتى الآن'}
              </h3>

              <p className="mt-2 max-w-md text-sm text-slate-500">
                {search
                  ? 'جرّب البحث باسم مختلف أو كود الموظف أو رقم الهاتف.'
                  : 'ابدأ بإضافة أول موظف إلى فريق العمل.'}
              </p>

              {!search && staff.length < MAX_TEAM_SIZE && (
                <button
                  type="button"
                  onClick={openAddModal}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="h-5 w-5" />
                  إضافة أول موظف
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-right">
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
                      رقم الهاتف
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      الحالة
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      الملاحظات
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      الإجراءات
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((person, index) => (
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

                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">
                              {person.full_name}
                            </div>

                            {person.notes && (
                              <div className="mt-1 max-w-[300px] truncate text-xs text-slate-400">
                                {person.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-medium text-slate-700">
                          {person.employee_code}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {person.phone || '—'}
                      </td>

                      <td className="px-5 py-4">
                        {person.is_active ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            موقوف
                          </span>
                        )}
                      </td>

                      <td className="max-w-[250px] px-5 py-4 text-sm text-slate-500">
                        <span className="block truncate">
                          {person.notes || '—'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(person)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" />
                            تعديل
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleStaff(person)}
                            disabled={togglingId === person.id}
                            className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              person.is_active
                                ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {togglingId === person.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : person.is_active ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}

                            {person.is_active ? 'إيقاف' : 'تفعيل'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingStaff ? 'تعديل بيانات الموظف' : 'إضافة موظف'}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingStaff
                    ? 'يمكنك تعديل بيانات الموظف ثم حفظ التغييرات.'
                    : `يمكنك إضافة موظف جديد. الحد الأقصى ${MAX_TEAM_SIZE} موظف.`}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-5 px-6 py-6">
                {errorMessage && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

                    <div className="text-sm">{errorMessage}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {/* Full name */}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      اسم الموظف *
                    </label>

                    <input
                      type="text"
                      value={form.full_name}
                      onChange={(event) =>
                        updateForm('full_name', event.target.value)
                      }
                      placeholder="مثال: أحمد محمد"
                      autoFocus
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Employee code */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      كود الموظف *
                    </label>

                    <input
                      type="text"
                      value={form.employee_code}
                      onChange={(event) =>
                        updateForm(
                          'employee_code',
                          event.target.value
                        )
                      }
                      placeholder="مثال: 001"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      رقم الهاتف
                    </label>

                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        updateForm('phone', event.target.value)
                      }
                      placeholder="مثال: 01000000000"
                      dir="ltr"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      ملاحظات
                    </label>

                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        updateForm('notes', event.target.value)
                      }
                      placeholder="أي ملاحظات إضافية عن الموظف..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Active status */}
                  <div className="md:col-span-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(event) =>
                          updateForm(
                            'is_active',
                            event.target.checked
                          )
                        }
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />

                      <div>
                        <div className="font-semibold text-slate-800">
                          الموظف نشط
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          الموظف النشط يمكن استخدامه في عمليات الحضور
                          والتكليفات.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-start">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-12 rounded-xl border border-slate-200 bg-white px-6 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      {editingStaff ? (
                        <Edit3 className="h-5 w-5" />
                      ) : (
                        <Plus className="h-5 w-5" />
                      )}

                      {editingStaff ? 'حفظ التعديلات' : 'إضافة الموظف'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}