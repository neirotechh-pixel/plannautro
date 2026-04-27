const MAX_LEN = 1000;

function base(): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  const safe = text.length > MAX_LEN ? text.slice(0, MAX_LEN) + '…' : text;
  const res = await fetch(`${base()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: safe }),
  });
  if (!res.ok) {
    console.error('sendMessage failed:', await res.text());
  }
}

export async function downloadVoice(fileId: string): Promise<Buffer> {
  const infoRes = await fetch(`${base()}/getFile?file_id=${fileId}`);
  const info = await infoRes.json() as { ok: boolean; result: { file_path: string } };
  if (!info.ok) throw new Error(`getFile failed: ${JSON.stringify(info)}`);

  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${info.result.file_path}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error(`voice download failed: ${fileRes.status}`);

  return Buffer.from(await fileRes.arrayBuffer());
}
