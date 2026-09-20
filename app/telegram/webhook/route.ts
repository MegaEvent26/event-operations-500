import { NextResponse } from 'next/server';

type TelegramUpdate = {
  message?: {
    chat?: {
      id?: number | string;
    };
    text?: string;
  };
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const update = (await request.json()) as TelegramUpdate;

    const chatId = update.message?.chat?.id;
    const text = update.message?.text?.trim() ?? '';

    if (!chatId || !text.startsWith('/start')) {
      return NextResponse.json({ ok: true });
    }

    const parts = text.split(/\s+/);
    const linkToken = parts[1];

    if (!linkToken) {
      return NextResponse.json({
        ok: true,
        message: 'Missing Telegram link token.',
      });
    }

    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    const botToken = getEnv('TELEGRAM_BOT_TOKEN');

    const lookupUrl =
      `${supabaseUrl}/rest/v1/staff` +
      `?telegram_link_token=eq.${encodeURIComponent(linkToken)}` +
      `&select=id,full_name,employee_code&limit=1`;

    const lookupResponse = await fetch(lookupUrl, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: 'no-store',
    });

    if (!lookupResponse.ok) {
      const details = await lookupResponse.text();
      console.error('Telegram staff lookup failed:', details);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const staffRows = (await lookupResponse.json()) as Array<{
      id: string;
      full_name: string;
      employee_code: string;
    }>;

    if (staffRows.length === 0) {
      await sendTelegramMessage(
        botToken,
        chatId,
        'عذرًا، رابط الربط غير صالح أو انتهت صلاحيته.'
      );

      return NextResponse.json({ ok: true });
    }

    const person = staffRows[0];

    const updateUrl =
      `${supabaseUrl}/rest/v1/staff?id=eq.${encodeURIComponent(person.id)}`;

    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        telegram_chat_id: String(chatId),
        updated_at: new Date().toISOString(),
      }),
    });

    if (!updateResponse.ok) {
      const details = await updateResponse.text();
      console.error('Telegram staff update failed:', details);

      await sendTelegramMessage(
        botToken,
        chatId,
        'تعذر إكمال الربط حاليًا. تأكد من إعدادات النظام وحاول مرة أخرى.'
      );

      return NextResponse.json({ ok: false }, { status: 500 });
    }

    await sendTelegramMessage(
      botToken,
      chatId,
      `تم ربط حساب Telegram بنجاح ✅\n\nالموظف: ${person.full_name}\nكود الموظف: ${person.employee_code}\n\nيمكنك الآن استقبال رسائل التشغيل على هذا الحساب.`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string
) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    console.error('Telegram sendMessage failed:', details);
  }
}
