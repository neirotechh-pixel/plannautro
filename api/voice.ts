import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';
import { toFile } from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
import { extractTasks } from '../lib/llm';

export const config = { api: { bodyParser: false } };

function auth(req: VercelRequest): boolean {
  return req.headers['x-app-token'] === process.env.TELEGRAM_WEBHOOK_SECRET;
}

function uid(): number {
  return parseInt(process.env.WEBAPP_USER_ID ?? '0', 10);
}

async function readBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-app-token');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!auth(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const buffer = await readBody(req);
    const ct = (req.headers['content-type'] as string) || 'audio/webm';
    const ext = ct.includes('mp4') ? 'mp4' : ct.includes('ogg') ? 'ogg' : 'webm';

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const file = await toFile(buffer, `voice.${ext}`, { type: ct });
    const result = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      language: 'ru',
    });

    const text = result.text.trim();
    if (!text) return res.status(200).json({ transcription: '', tasks: [] });

    const today = new Date().toISOString().split('T')[0];
    const tasks = await extractTasks(text, today);
    if (tasks.length === 0) return res.status(200).json({ transcription: text, tasks: [] });

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const userId = uid();
    const rows = tasks.map(t => ({
      user_id: userId,
      text: t.text,
      time: t.time ?? null,
      day: t.date ?? today,
      done: false,
    }));
    const { data, error } = await supabase.from('tasks').insert(rows).select();
    if (error) throw error;

    return res.status(200).json({ transcription: text, tasks: data ?? [] });
  } catch (err) {
    console.error('Voice API:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    return res.status(500).json({ error: 'Internal server error' });
  }
}
