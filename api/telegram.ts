import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleStart,
  handleToday,
  handleDone,
  handleClear,
  handleText,
  handleVoice,
} from '../lib/handlers';

type TgMessage = {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
  voice?: { file_id: string };
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
};

async function processMessage(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id ?? chatId;
  const text = msg.text ?? '';

  if (text.startsWith('/start')) {
    await handleStart(chatId);
  } else if (text.startsWith('/today')) {
    await handleToday(chatId, userId);
  } else if (text.startsWith('/done')) {
    await handleDone(chatId, userId, text.slice(5).trim());
  } else if (text.startsWith('/clear')) {
    await handleClear(chatId, userId);
  } else if (msg.voice) {
    await handleVoice(chatId, userId, msg.voice.file_id);
  } else if (text) {
    await handleText(chatId, userId, text);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('Invalid webhook secret, got:', secret, 'expected:', process.env.TELEGRAM_WEBHOOK_SECRET ? '[set]' : '[NOT SET]');
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      res.status(200).end();
      return;
    }

    const update = req.body as TgUpdate;
    if (!update?.message) {
      res.status(200).end();
      return;
    }

    await processMessage(update.message);
  } catch (err) {
    console.error('Webhook error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
  } finally {
    res.status(200).end();
  }
}
