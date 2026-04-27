import Groq from 'groq-sdk';

export type ExtractedTask = {
  text: string;
  time: string | null;
};

const SYSTEM_PROMPT = `Ты помощник по утреннему планированию. Пользователь описывает свои задачи на сегодня.
Извлеки список задач в формате JSON-массива. Каждый объект содержит:
- "text": текст задачи (кратко, в инфинитиве, по-русски)
- "time": время выполнения (если указано, иначе null)
Отвечай ТОЛЬКО JSON-массивом, без пояснений и без markdown-блоков.
Пример: [{"text":"Позвонить клиенту","time":"10:00"},{"text":"Написать отчёт","time":null}]`;

export async function extractTasks(userText: string): Promise<ExtractedTask[]> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '[]';
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is ExtractedTask =>
        typeof t === 'object' && t !== null && typeof t.text === 'string',
    ).map(t => ({ text: t.text, time: typeof t.time === 'string' ? t.time : null }));
  } catch (err) {
    console.error('LLM JSON parse error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    return [];
  }
}
