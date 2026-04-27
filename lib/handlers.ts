import { sendMessage, downloadVoice } from './telegram';
import { transcribeAudio } from './transcribe';
import { extractTasks } from './llm';
import { saveTasks, getTodayTasks, markDoneByIndex, clearTodayTasks } from './db';
import { formatTaskList } from './format';

export async function handleStart(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    'Привет! Я помогу планировать утро.\n\n' +
      'Отправь голосовое сообщение или текст с планами на день — извлеку задачи и сохраню их.\n\n' +
      'Команды:\n' +
      '/today — список задач на сегодня\n' +
      '/done 1 — отметить задачу выполненной\n' +
      '/clear — очистить все задачи на сегодня',
  );
}

export async function handleToday(chatId: number, userId: number): Promise<void> {
  const tasks = await getTodayTasks(userId);
  await sendMessage(chatId, '📋 Задачи на сегодня:\n\n' + formatTaskList(tasks));
}

export async function handleDone(chatId: number, userId: number, args: string): Promise<void> {
  const parts = args
    .split(/[\s,]+/)
    .map(s => parseInt(s, 10))
    .filter(n => !isNaN(n) && n > 0);

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
  const tasks = await extractTasks(text);
  if (tasks.length === 0) {
    await sendMessage(chatId, 'Не нашёл задач в сообщении. Опиши что планируешь сегодня сделать.');
    return;
  }
  await saveTasks(userId, tasks);
  const all = await getTodayTasks(userId);
  await sendMessage(chatId, `Добавлено задач: ${tasks.length}\n\n📋 Задачи на сегодня:\n\n${formatTaskList(all)}`);
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
