import { createClient } from '@supabase/supabase-js';
import type { ExtractedTask } from './llm';

export type Task = {
  id: number;
  user_id: number;
  text: string;
  time: string | null;
  day: string;
  done: boolean;
  created: string;
};

function client() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export async function saveTasks(userId: number, tasks: ExtractedTask[]): Promise<void> {
  const db = client();
  const rows = tasks.map(t => ({
    user_id: userId,
    text: t.text,
    time: t.time,
    day: today(),
    done: false,
  }));
  const { error } = await db.from('tasks').insert(rows);
  if (error) throw error;
}

export async function getTodayTasks(userId: number): Promise<Task[]> {
  const db = client();
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('day', today())
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function markDoneByIndex(userId: number, index: number): Promise<boolean> {
  const tasks = await getTodayTasks(userId);
  const task = tasks[index - 1];
  if (!task) return false;
  const db = client();
  const { error } = await db.from('tasks').update({ done: true }).eq('id', task.id);
  if (error) throw error;
  return true;
}

export async function clearTodayTasks(userId: number): Promise<number> {
  const db = client();
  const { data, error } = await db
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .eq('day', today())
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
