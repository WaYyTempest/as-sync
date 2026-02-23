const MAX_FILE_SIZE = 10 * 1024 * 1024;
const REVOKE_DELAY_MS = 500;

export function exportToJson(raw: Record<string, string>): Blob {
  const json = JSON.stringify(raw, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export async function importFromJson(file: File): Promise<Record<string, string>> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB, max 10 MB)`);
  }

  const text = await file.text();
  const parsed: unknown = JSON.parse(text);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid format: expected a JSON object');
  }

  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    raw[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }

  if (Object.keys(raw).length === 0) {
    throw new Error('No data found in file');
  }

  return raw;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}
