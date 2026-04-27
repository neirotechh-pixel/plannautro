import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function auth(req: VercelRequest): boolean {
  return req.headers['x-app-token'] === process.env.TELEGRAM_WEBHOOK_SECRET;
}

function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function uid(): number {
  return parseInt(process.env.WEBAPP_USER_ID ?? '0', 10);
}

function weekBounds(week: string): { from: string; to: string } {
  const d = new Date(week + 'T12:00:00Z');
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + offset);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  return {
    from: mon.toISOString().split('T')[0],
    to: sun.toISOString().split('T')[0],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-app-token');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!auth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = db();
  const userId = uid();

  try {
    if (req.method === 'GET') {
      const week = (req.query.week as string) || new Date().toISOString().split('T')[0];
      const { from, to } = weekBounds(week);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .gte('day', from)
        .lte('day', to)
        .order('id', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data ?? []);
    }

    if (req.method === 'POST') {
      const { text, time, day } = req.body as { text: string; time?: string; day: string };
      const { data, error } = await supabase
        .from('tasks')
        .insert({ user_id: userId, text, time: time ?? null, day, done: false })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body as { id: number; [k: string]: unknown };
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body as { id: number };
      const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Tasks API:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    return res.status(500).json({ error: 'Internal server error' });
  }
}
