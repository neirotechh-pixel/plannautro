import Groq from 'groq-sdk';
import { toFile } from 'groq-sdk';

export async function transcribeAudio(buffer: Buffer): Promise<string> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const file = await toFile(buffer, 'voice.ogg', { type: 'audio/ogg' });
  const result = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    language: 'ru',
  });
  return result.text;
}
