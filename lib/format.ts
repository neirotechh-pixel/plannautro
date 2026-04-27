import type { Task } from './db';

export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return 'Нет задач на сегодня.';

  const done = tasks.filter(t => t.done).length;
  const lines = tasks.map((t, i) => {
    const mark = t.done ? '✅' : '⬜';
    const time = t.time ? ` [${t.time}]` : '';
    return `${mark} ${i + 1}. ${t.text}${time}`;
  });

  lines.push('');
  lines.push(`Выполнено: ${done}/${tasks.length}`);
  return lines.join('\n');
}
