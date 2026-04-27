import Groq from 'groq-sdk';

export type ExtractedTask = {
  text: string;
  time: string | null;
  date: string | null; // YYYY-MM-DD, null = today
};

const DAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function systemPrompt(today: string): string {
  const d = new Date(today + 'T12:00:00Z');
  const dayName = DAYS_RU[d.getUTCDay()];
  const dateStr = `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `Ты помощник по планированию. Сегодня ${dateStr} (${dayName}), ISO-дата: ${today}.
Извлеки задачи из текста пользователя. Верни JSON-массив объектов:
- "text": текст задачи (кратко, в инфинитиве)
- "time": время (строка, если указано, иначе null)
- "date": дата YYYY-MM-DD (вычисли из "завтра", "в среду", "3 мая" и т.д.; если не указана — ${today})
Отвечай ТОЛЬКО JSON-массивом, без markdown и пояснений.`;
}

export async function extractTasks(userText: string, today: string): Promise<ExtractedTask[]> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt(today) },
      { role: 'user', content: userText },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '[]';
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null && typeof t.text === 'string')
      .map(t => ({
        text: t.text as string,
        time: typeof t.time === 'string' ? t.time : null,
        date: typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date as string) ? t.date as string : null,
      }));
  } catch (err) {
    console.error('LLM JSON parse:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    return [];
  }
}
