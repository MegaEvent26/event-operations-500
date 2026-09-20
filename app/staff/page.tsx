'use client';

import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';

const MAX_TEAM_SIZE = 500;
type Staff = {
  id: string;
  full_name: string;
  employee_code: string;
  phone: string | null;
  telegram_chat_id: string | null;
  telegram_link_token: string | null;
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
    return 'Ø­Ø¯Ø« Ø®Ø·Ø£ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ.';
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

  return 'Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ ØªÙ†ÙÙŠØ° Ø§Ù„Ø¹Ù…Ù„ÙŠØ©.';
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
  const [messageStaff, setMessageStaff] = useState<Staff | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [telegramLinkStaff, setTelegramLinkStaff] = useState<Staff | null>(null);
  const [telegramLinkCopied, setTelegramLinkCopied] = useState(false);
  const [telegramCommandCopied, setTelegramCommandCopied] = useState(false);

  async function loadStaff() {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('staff')
        .select(
  'id, full_name, employee_code, phone, telegram_chat_id, telegram_link_token, is_active, notes, created_at, updated_at'
)        .order('employee_code', { ascending: true })
        .limit(MAX_TEAM_SIZE);

      if (error) {
        throw error;
      }

      setStaff((data ?? []) as Staff[]);
    } catch (error) {
      console.error('Supabase staff error:', error);

      setErrorMessage(
        `ØªØ¹Ø°Ø± Ø¬Ù„Ø¨ Ø¨ÙŠØ§Ù†Ø§Øª ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù…Ù„ Ù…Ù† Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª: ${getErrorMessage(
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
        `ØªÙ… Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ Ù„Ù„ÙØ±ÙŠÙ‚ ÙˆÙ‡Ùˆ ${MAX_TEAM_SIZE} Ù…ÙˆØ¸Ù.`
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
      setErrorMessage('Ù…Ù† ÙØ¶Ù„Ùƒ Ø£Ø¯Ø®Ù„ Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù.');
      return;
    }

    if (!employeeCode) {
      setErrorMessage('Ù…Ù† ÙØ¶Ù„Ùƒ Ø£Ø¯Ø®Ù„ ÙƒÙˆØ¯ Ø§Ù„Ù…ÙˆØ¸Ù.');
      return;
    }

    setSaving(true);

    try {
      if (!editingStaff) {
        /*
         * Ù†Ø¹ÙŠØ¯ Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ø¹Ø¯Ø¯ Ù…Ù† Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù‚Ø¨Ù„ Ø§Ù„Ø¥Ø¶Ø§ÙØ©
         * Ø­ØªÙ‰ Ù„Ø§ Ù†Ø¹ØªÙ…Ø¯ ÙÙ‚Ø· Ø¹Ù„Ù‰ Ø§Ù„Ø¹Ø¯Ø¯ Ø§Ù„Ù…ÙˆØ¬ÙˆØ¯ Ø­Ø§Ù„ÙŠÙ‹Ø§ ÙÙŠ Ø§Ù„Ø´Ø§Ø´Ø©.
         */
        const { count, error: countError } = await supabase
          .from('staff')
          .select('id', { count: 'exact', head: true });

        if (countError) {
          throw countError;
        }

        if ((count ?? 0) >= MAX_TEAM_SIZE) {
          setErrorMessage(
            `Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ¸Ù Ø¬Ø¯ÙŠØ¯. Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ Ù‡Ùˆ ${MAX_TEAM_SIZE} Ù…ÙˆØ¸Ù.`
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
            'id, full_name, employee_code, phone, telegram_chat_id, telegram_link_token, is_active, notes, created_at, updated_at'
          )
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error(
              'ÙƒÙˆØ¯ Ø§Ù„Ù…ÙˆØ¸Ù Ù…ÙˆØ¬ÙˆØ¯ Ø¨Ø§Ù„ÙØ¹Ù„. Ø§Ø³ØªØ®Ø¯Ù… ÙƒÙˆØ¯Ù‹Ø§ Ù…Ø®ØªÙ„ÙÙ‹Ø§.'
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

        setSuccessMessage(`ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…ÙˆØ¸Ù "${fullName}" Ø¨Ù†Ø¬Ø§Ø­.`);
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
            'id, full_name, employee_code, phone, telegram_chat_id, telegram_link_token, is_active, notes, created_at, updated_at'
          )
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error(
              'ÙƒÙˆØ¯ Ø§Ù„Ù…ÙˆØ¸Ù Ù…ÙˆØ¬ÙˆØ¯ Ø¨Ø§Ù„ÙØ¹Ù„ Ù„Ù…ÙˆØ¸Ù Ø¢Ø®Ø±. Ø§Ø³ØªØ®Ø¯Ù… ÙƒÙˆØ¯Ù‹Ø§ Ù…Ø®ØªÙ„ÙÙ‹Ø§.'
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

        setSuccessMessage(`ØªÙ… ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª "${fullName}" Ø¨Ù†Ø¬Ø§Ø­.`);
      }

      setShowModal(false);
      setEditingStaff(null);
      setForm(emptyForm);
    } catch (error) {
      console.error('Save staff error:', error);

      setErrorMessage(
        `ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ¸Ù: ${getErrorMessage(error)}`
      );
    } finally {
      setSaving(false);
    }
  }

  function getTelegramLink(person: Staff): string | null {
    if (!person.telegram_link_token) {
      return null;
    }

    const botUsername = 'Event26StaffBot';
    const startParameter = `staff_${person.telegram_link_token}`;

    return `https://t.me/${botUsername}?start=${encodeURIComponent(startParameter)}`;
  }

  function getTelegramStartCommand(person: Staff): string | null {
    if (!person.telegram_link_token) {
      return null;
    }

    return `/start staff_${person.telegram_link_token}`;
  }

  function openTelegramLink(person: Staff) {
    const telegramUrl = getTelegramLink(person);

    if (!telegramUrl) {
      setErrorMessage('Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø±Ø§Ø¨Ø· Telegram Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…ÙˆØ¸Ù.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setTelegramLinkCopied(false);
    setTelegramCommandCopied(false);
    setTelegramLinkStaff(person);
  }

  function closeTelegramLinkModal() {
    setTelegramLinkStaff(null);
    setTelegramLinkCopied(false);
    setTelegramCommandCopied(false);
  }

  async function copyTelegramLink() {
    if (!telegramLinkStaff) return;

    const telegramUrl = getTelegramLink(telegramLinkStaff);

    if (!telegramUrl) {
      setErrorMessage('Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø±Ø§Ø¨Ø· Telegram Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…ÙˆØ¸Ù.');
      return;
    }

    try {
      await navigator.clipboard.writeText(telegramUrl);
      setTelegramLinkCopied(true);
      setSuccessMessage('ØªÙ… Ù†Ø³Ø® Ø±Ø§Ø¨Ø· Telegram. Ø£Ø±Ø³Ù„Ù‡ Ù„Ù„Ù…ÙˆØ¸Ù Ø¹Ù„Ù‰ WhatsApp Ø£Ùˆ Ø£ÙŠ ÙˆØ³ÙŠÙ„Ø© Ù…Ù†Ø§Ø³Ø¨Ø©.');
    } catch (error) {
      console.error('Copy Telegram link error:', error);
      setErrorMessage('ØªØ¹Ø°Ø± Ù†Ø³Ø® Ø§Ù„Ø±Ø§Ø¨Ø· ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§.');
    }
  }

  async function copyTelegramStartCommand() {
    if (!telegramLinkStaff) return;

    const command = getTelegramStartCommand(telegramLinkStaff);

    if (!command) {
      setErrorMessage('Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø±Ù…Ø² Ø±Ø¨Ø· Telegram Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…ÙˆØ¸Ù.');
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      setTelegramCommandCopied(true);
      setErrorMessage('');
      setSuccessMessage(
        'ØªÙ… Ù†Ø³Ø® Ø£Ù…Ø± Ø§Ù„Ø±Ø¨Ø·. Ø§Ù„ØµÙ‚Ù‡ Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© Ø§Ù„Ø®Ø§ØµØ© Ù…Ø¹ Ø§Ù„Ø¨ÙˆØª Ø«Ù… Ø§Ø¶ØºØ· Ø¥Ø±Ø³Ø§Ù„.'
      );
    } catch (error) {
      console.error('Copy Telegram start command error:', error);
      setErrorMessage('ØªØ¹Ø°Ø± Ù†Ø³Ø® Ø£Ù…Ø± Ø§Ù„Ø±Ø¨Ø· ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§.');
    }
  }

  function openMessageModal(person: Staff) {
    if (!person.telegram_chat_id) {
      setErrorMessage('ÙŠØ¬Ø¨ Ø±Ø¨Ø· Telegram Ø¨Ù‡Ø°Ø§ Ø§Ù„Ù…ÙˆØ¸Ù Ø£ÙˆÙ„Ø§Ù‹.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setMessageStaff(person);
    setMessageText('');
  }

  function closeMessageModal() {
    if (sendingMessage) return;
    setMessageStaff(null);
    setMessageText('');
  }

  async function sendTelegramMessage() {
    if (!messageStaff?.id) return;

    const message = messageText.trim();
    if (!message) {
      setErrorMessage('Ø§ÙƒØªØ¨ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø£ÙˆÙ„Ø§Ù‹.');
      return;
    }

    setSendingMessage(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: messageStaff.id,
          message,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || 'ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø©.');
      }

      setSuccessMessage(`ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø¥Ù„Ù‰ "${messageStaff.full_name}" Ø¨Ù†Ø¬Ø§Ø­.`);
      setMessageStaff(null);
      setMessageText('');
    } catch (error) {
      console.error('Telegram send error:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSendingMessage(false);
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
          'id, full_name, employee_code, phone, telegram_chat_id, telegram_link_token, is_active, notes, created_at, updated_at'
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
          ? `ØªÙ… ØªÙØ¹ÙŠÙ„ Ø§Ù„Ù…ÙˆØ¸Ù "${person.full_name}".`
          : `ØªÙ… Ø¥ÙŠÙ‚Ø§Ù Ø§Ù„Ù…ÙˆØ¸Ù "${person.full_name}".`
      );
    } catch (error) {
      console.error('Toggle staff error:', error);

      setErrorMessage(
        `ØªØ¹Ø°Ø± ØªØºÙŠÙŠØ± Ø­Ø§Ù„Ø© Ø§Ù„Ù…ÙˆØ¸Ù: ${getErrorMessage(error)}`
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
              ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù…Ù„
            </h1>

            <p className="mt-2 text-base text-slate-500">
              Ø¥Ø¯Ø§Ø±Ø© ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù…Ù„ â€” Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ {MAX_TEAM_SIZE} Ù…ÙˆØ¸Ù
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
              ØªØ­Ø¯ÙŠØ«
            </button>

            <button
              type="button"
              onClick={openAddModal}
              disabled={staff.length >= MAX_TEAM_SIZE}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus className="h-5 w-5" />
              Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ¸Ù
            </button>
          </div>
        </header>

        {/* Connection status */}
        {!errorMessage ? (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
            <CheckCircle2 className="h-6 w-6 shrink-0" />

            <span className="font-medium">
              Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙŠØ¹Ù…Ù„ Ø¨Ù†Ø¬Ø§Ø­
            </span>
          </div>
        ) : (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />

            <div className="min-w-0">
              <div className="font-semibold">Ø­Ø¯Ø« Ø®Ø·Ø£</div>
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
                  Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙØ±ÙŠÙ‚
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
                  Ø§Ù„Ù…ÙˆØ¸ÙÙˆÙ† Ø§Ù„Ù†Ø´Ø·ÙˆÙ†
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
                  Ø§Ù„Ù…ÙˆØ¸ÙÙˆÙ† Ø§Ù„Ù…ÙˆÙ‚ÙˆÙÙˆÙ†
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
              placeholder="Ø§Ø¨Ø­Ø« Ø¨Ø§Ù„Ø§Ø³Ù… Ø£Ùˆ ÙƒÙˆØ¯ Ø§Ù„Ù…ÙˆØ¸Ù Ø£Ùˆ Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ..."
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
              Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø«: {filteredStaff.length}
            </p>
          )}
        </section>

        {/* Staff table */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ†
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Ø¹Ø±Ø¶ {filteredStaff.length} Ù…Ù† {staff.length} Ù…ÙˆØ¸Ù
                </p>
              </div>

              <div className="hidden rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 sm:block">
                Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰: {MAX_TEAM_SIZE}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span>Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù…Ù„...</span>
              </div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full bg-slate-100 p-5">
                <Users className="h-10 w-10 text-slate-400" />
              </div>

              <h3 className="mt-5 text-xl font-semibold text-slate-800">
                {search
                  ? 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¬ Ù…Ø·Ø§Ø¨Ù‚Ø©'
                  : 'Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…ÙˆØ¸ÙÙˆÙ† Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†'}
              </h3>

              <p className="mt-2 max-w-md text-sm text-slate-500">
                {search
                  ? 'Ø¬Ø±Ù‘Ø¨ Ø§Ù„Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ù…Ø®ØªÙ„Ù Ø£Ùˆ ÙƒÙˆØ¯ Ø§Ù„Ù…ÙˆØ¸Ù Ø£Ùˆ Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ.'
                  : 'Ø§Ø¨Ø¯Ø£ Ø¨Ø¥Ø¶Ø§ÙØ© Ø£ÙˆÙ„ Ù…ÙˆØ¸Ù Ø¥Ù„Ù‰ ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù…Ù„.'}
              </p>

              {!search && staff.length < MAX_TEAM_SIZE && (
                <button
                  type="button"
                  onClick={openAddModal}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="h-5 w-5" />
                  Ø¥Ø¶Ø§ÙØ© Ø£ÙˆÙ„ Ù…ÙˆØ¸Ù
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-right">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      #
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      Ø§Ù„Ù…ÙˆØ¸Ù
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      ÙƒÙˆØ¯ Ø§Ù„Ù…ÙˆØ¸Ù
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      Ø§Ù„Ø­Ø§Ù„Ø©
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      QR
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-slate-600">
                      Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª
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
                        {person.phone || 'â€”'}
                      </td>

                      <td className="px-5 py-4">
                        {person.is_active ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Ù†Ø´Ø·
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            Ù…ÙˆÙ‚ÙˆÙ
                          </span>
                        )}
                      </td>

                      <td className="max-w-[250px] px-5 py-4 text-sm text-slate-500">
                        <span className="block truncate">
                          {person.notes || 'â€”'}
                        </span>
                      </td>

                      <td className="px-5 py-4 align-top">
  <div className="flex w-[280px] min-w-[280px] flex-col items-center rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <QRCodeSVG
      value={
        typeof window !== 'undefined'
          ? `${window.location.origin}/attendance/scan?staffId=${person.id}`
          : ''
      }
      size={220}
      level="M"
      includeMargin
    />

    <button
      type="button"
      onClick={() => {
        const url = `/attendance/scan?staffId=${person.id}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }}
      className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      سكان الحضور
    </button>
  </div>
</td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openTelegramLink(person)}
                            className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                              person.telegram_chat_id
                                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                            }`}
                            title={
                              person.telegram_chat_id
                                ? 'Telegram Ù…Ø±ØªØ¨Ø· â€” Ø§ÙØªØ­ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© Ù„Ø±Ø¨Ø·/Ø§Ø®ØªØ¨Ø§Ø± Ø§Ù„Ø­Ø³Ø§Ø¨'
                                : 'ÙØªØ­ Telegram Ù„Ø±Ø¨Ø· Ø§Ù„Ù…ÙˆØ¸Ù'
                            }
                          >
                            <MessageCircle className="h-4 w-4" />
                            {person.telegram_chat_id ? 'Telegram Ù…Ø±ØªØ¨Ø·' : 'Ø±Ø¨Ø· Telegram'}
                          </button>

                          {person.telegram_chat_id && (
                            <button
                              type="button"
                              onClick={() => openMessageModal(person)}
                              className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                            >
                              <MessageCircle className="h-4 w-4" />
                              Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„Ø©
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditModal(person)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" />
                            ØªØ¹Ø¯ÙŠÙ„
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

                            {person.is_active ? 'Ø¥ÙŠÙ‚Ø§Ù' : 'ØªÙØ¹ÙŠÙ„'}
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

      {/* Telegram Link Modal */}
      {telegramLinkStaff && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTelegramLinkModal();
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Ø±Ø¨Ø· Telegram</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ø±Ø¨Ø· Ø­Ø³Ø§Ø¨ Telegram Ø§Ù„Ø®Ø§Øµ Ø¨Ø§Ù„Ù…ÙˆØ¸Ù {telegramLinkStaff.full_name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeTelegramLinkModal}
                className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-900">
                <div className="font-bold">Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø±Ø¨Ø· Ø§Ù„ØµØ­ÙŠØ­Ø©</div>
                <div className="mt-1">
                  1) Ø§ÙØªØ­ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© Ø§Ù„Ø®Ø§ØµØ© Ù…Ø¹ Ø§Ù„Ø¨ÙˆØª Event 26 Staff.
                  <br />
                  2) Ø¬Ø±Ù‘Ø¨ QR Ø£Ùˆ Ø²Ø± ÙØªØ­ Telegram Ø£ÙˆÙ„Ù‹Ø§.
                  <br />
                  3) Ø¥Ø°Ø§ ÙØªØ­ Ø§Ù„Ø¨ÙˆØª ÙˆØ£Ø±Ø³Ù„ <span className="font-mono font-bold">/start</span> ÙÙ‚Ø·ØŒ
                  Ø§Ø³ØªØ®Ø¯Ù… Ø²Ø± Â«Ù†Ø³Ø® Ø£Ù…Ø± Ø§Ù„Ø±Ø¨Ø·Â» Ø¨Ø§Ù„Ø£Ø³ÙÙ„ ÙˆØ§Ù„ØµÙ‚ Ø§Ù„Ø£Ù…Ø± Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© Ø§Ù„Ø®Ø§ØµØ© Ø«Ù… Ø§Ø¶ØºØ· Ø¥Ø±Ø³Ø§Ù„.
                  <br />
                  4) ÙŠØ¬Ø¨ Ø£Ù† ÙŠØµÙ„ Ù„Ù„Ø¨ÙˆØª Ø£Ù…Ø± Ø¨Ø§Ù„Ø´ÙƒÙ„: <span className="font-mono font-bold">/start staff_...</span>
                  <br />
                  5) Ø¨Ø¹Ø¯ Ø¸Ù‡ÙˆØ± Ø±Ø³Ø§Ù„Ø© Ù†Ø¬Ø§Ø­ Ø§Ù„Ø±Ø¨Ø·ØŒ Ø­Ø¯Ù‘Ø« ØµÙØ­Ø© ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù…Ù„.
                </div>
              </div>

              <div className="flex justify-center">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <QRCodeSVG
                    value={getTelegramLink(telegramLinkStaff) ?? ''}
                    size={220}
                    level="M"
                    includeMargin
                  />
                </div>
              </div>

              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">
                  {telegramLinkStaff.full_name} â€” {telegramLinkStaff.employee_code}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Ù‡Ø°Ø§ Ø§Ù„Ø±Ø§Ø¨Ø· Ø®Ø§Øµ Ø¨Ù‡Ø°Ø§ Ø§Ù„Ù…ÙˆØ¸Ù ÙÙ‚Ø·
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-bold text-amber-900">
                  Ø§Ù„Ø­Ù„ Ø§Ù„Ù…Ø¶Ù…ÙˆÙ† Ø¥Ø°Ø§ ÙƒØ§Ù† Telegram ÙŠØ±Ø³Ù„ /start ÙÙ‚Ø·
                </div>
                <div className="mt-2 break-all rounded-xl bg-white p-3 text-center font-mono text-sm text-slate-700">
                  {getTelegramStartCommand(telegramLinkStaff) ?? 'â€”'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={copyTelegramStartCommand}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700"
                >
                  {telegramCommandCopied ? 'ØªÙ… Ù†Ø³Ø® Ø£Ù…Ø± Ø§Ù„Ø±Ø¨Ø· âœ“' : 'Ù†Ø³Ø® Ø£Ù…Ø± Ø§Ù„Ø±Ø¨Ø·'}
                </button>

                <button
                  type="button"
                  onClick={copyTelegramLink}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {telegramLinkCopied ? 'ØªÙ… Ù†Ø³Ø® Ø§Ù„Ø±Ø§Ø¨Ø· âœ“' : 'Ù†Ø³Ø® Ø§Ù„Ø±Ø§Ø¨Ø·'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const telegramUrl = getTelegramLink(telegramLinkStaff);
                    if (telegramUrl) {
                      window.open(telegramUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 font-semibold text-sky-700 transition hover:bg-sky-100 sm:col-span-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  ÙØªØ­ Telegram
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
              <button
                type="button"
                onClick={closeTelegramLinkModal}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-6 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Ø¥ØºÙ„Ø§Ù‚
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Message Modal */}
      {messageStaff && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMessageModal();
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„Ø© Telegram</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø³ØªÙØ±Ø³Ù„ Ø¥Ù„Ù‰ {messageStaff.full_name} ÙÙ‚Ø·.
                </p>
              </div>
              <button
                type="button"
                onClick={closeMessageModal}
                disabled={sendingMessage}
                className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Ø§ÙƒØªØ¨ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ù‡Ù†Ø§..."
                maxLength={4000}
                rows={6}
                autoFocus
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <div className="text-left text-xs text-slate-400">
                {messageText.length} / 4000
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5">
              <button
                type="button"
                onClick={closeMessageModal}
                disabled={sendingMessage}
                className="h-12 rounded-xl border border-slate-200 bg-white px-6 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Ø¥Ù„ØºØ§Ø¡
              </button>

              <button
                type="button"
                onClick={sendTelegramMessage}
                disabled={sendingMessage || !messageText.trim()}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingMessage ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-5 w-5" />
                    Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø©
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {editingStaff ? 'ØªØ¹Ø¯ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ¸Ù' : 'Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ¸Ù'}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingStaff
                    ? 'ÙŠÙ…ÙƒÙ†Ùƒ ØªØ¹Ø¯ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ¸Ù Ø«Ù… Ø­ÙØ¸ Ø§Ù„ØªØºÙŠÙŠØ±Ø§Øª.'
                    : `ÙŠÙ…ÙƒÙ†Ùƒ Ø¥Ø¶Ø§ÙØ© Ù…ÙˆØ¸Ù Ø¬Ø¯ÙŠØ¯. Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ ${MAX_TEAM_SIZE} Ù…ÙˆØ¸Ù.`}
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
                      Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù *
                    </label>

                    <input
                      type="text"
                      value={form.full_name}
                      onChange={(event) =>
                        updateForm('full_name', event.target.value)
                      }
                      placeholder="Ù…Ø«Ø§Ù„: Ø£Ø­Ù…Ø¯ Ù…Ø­Ù…Ø¯"
                      autoFocus
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Employee code */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      ÙƒÙˆØ¯ Ø§Ù„Ù…ÙˆØ¸Ù *
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
                      placeholder="Ù…Ø«Ø§Ù„: 001"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ
                    </label>

                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        updateForm('phone', event.target.value)
                      }
                      placeholder="Ù…Ø«Ø§Ù„: 01000000000"
                      dir="ltr"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Ù…Ù„Ø§Ø­Ø¸Ø§Øª
                    </label>

                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        updateForm('notes', event.target.value)
                      }
                      placeholder="Ø£ÙŠ Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø¥Ø¶Ø§ÙÙŠØ© Ø¹Ù† Ø§Ù„Ù…ÙˆØ¸Ù..."
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
                          Ø§Ù„Ù…ÙˆØ¸Ù Ù†Ø´Ø·
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          Ø§Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ù†Ø´Ø· ÙŠÙ…ÙƒÙ† Ø§Ø³ØªØ®Ø¯Ø§Ù…Ù‡ ÙÙŠ Ø¹Ù…Ù„ÙŠØ§Øª Ø§Ù„Ø­Ø¶ÙˆØ±
                          ÙˆØ§Ù„ØªÙƒÙ„ÙŠÙØ§Øª.
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
                  Ø¥Ù„ØºØ§Ø¡
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸...
                    </>
                  ) : (
                    <>
                      {editingStaff ? (
                        <Edit3 className="h-5 w-5" />
                      ) : (
                        <Plus className="h-5 w-5" />
                      )}

                      {editingStaff ? 'Ø­ÙØ¸ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª' : 'Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…ÙˆØ¸Ù'}
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



