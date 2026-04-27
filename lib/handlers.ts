import { sendMessage, downloadVoice } from './telegram';
import { transcribeAudio } from './transcribe';
import { extractTasks } from './llm';
import { saveTasks, getTodayTasks, markDoneByIndex, clearTodayTasks } from './db';
import { formatTaskList } from './format';

const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

function fmtDate(iso: string, today: string): string {
  if (iso === today) return 'сегодня';
  const d = new Date(iso + 'T12:00:00Z');
  const tomorrow = new Date(today + 'T12:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (iso === tomorrow.toISOString().split('T')[0]) return 'завтра';
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

export async function handleStart(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    'Привет! Я помогу планировать день.\n\n' +
      'Отправь голосовое или текст с планами — выделю задачи и распределю по датам.\n\n' +
      'Команды:\n' +
      '/today — задачи на сегодня\n' +
      '/done 1 — отметить выполненной\n' +
      '/clear — очистить задачи на сегодня',
  );
}

export async function handleToday(chatId: number, userId: number): Promise<void> {
  const tasks = await getTodayTasks(userId);
  await sendMessage(chatId, '📋 Задачи на сегодня:\n\n' + formatTaskList(tasks));
}

export async function handleDone(chatId: number, userId: number, args: string): Promise<void> {
  const parts = args.split(/[\s,]+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n > 0);
  if (parts.length === 0) {
    await sendMessage(chatId, 'Укажи номер задачи. Например: /done 1');
    return;
  }
  const results: string[] = [];
  for (const idx of parts) {
    const ok = await markDoneByIndex(userId, idx);
    results.push(ok ? `✅ Задача ${idx} выполнена!` : `❌ Задача ${idx} не найдена.`);
  }
  const tasks = await getTodayTasks(userId);
  await sendMessage(chatId, results.join('\n') + '\n\n' + formatTaskList(tasks));
}

export async function handleClear(chatId: number, userId: number): Promise<void> {
  const count = await clearTodayTasks(userId);
  await sendMessage(chatId, `🗑 Удалено задач: ${count}.`);
}

export async function handleText(chatId: number, userId: number, text: string): Promise<void> {
  await sendMessage(chatId, '⏳ Обрабатываю…');
  const today = new Date().toISOString().split('T')[0];
  const tasks = await extractTasks(text, today);
  if (tasks.length === 0) {
    await sendMessage(chatId, 'Не нашёл задач. Опиши что планируешь сегодня сделать.');
    return;
  }
  await saveTasks(userId, tasks, today);

  // Group by date for a nice summary
  const byDate: Record<string, string[]> = {};
  for (const t of tasks) {
    const d = t.date ?? today;
    (byDate[d] ??= []).push(t.text + (t.time ? ` [${t.time}]` : ''));
  }
  const lines = [`Добавлено задач: ${tasks.length}\n`];
  for (const [date, items] of Object.entries(byDate)) {
    lines.push(`📅 ${fmtDate(date, today).charAt(0).toUpperCase() + fmtDate(date, today).slice(1)}:`);
    items.forEach(i => lines.push(`  • ${i}`));
  }
  await sendMessage(chatId, lines.join('\n'));
}

export async function handleVoice(chatId: number, userId: number, fileId: string): Promise<void> {
  await sendMessage(chatId, '🎙 Транскрибирую…');
  const buffer = await downloadVoice(fileId);
  const text = await transcribeAudio(buffer);
  if (!text.trim()) {
    await sendMessage(chatId, 'Не удалось распознать речь. Попробуй ещё раз.');
    return;
  }
  await sendMessage(chatId, `Распознано: ${text}`);
  await handleText(chatId, userId, text);
}
