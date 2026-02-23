import './styles.css';

const params = new URLSearchParams(window.location.search);
const targetTabId = parseInt(params.get('tabId') || '', 10);

if (!targetTabId || isNaN(targetTabId)) {
  document.getElementById('error-state')!.style.display = '';
} else {
  init();
}

async function init() {
  let tabUrl = params.get('target') || 'unknown';
  if (tabUrl === 'unknown') {
    try {
      const tab = await browser.tabs.get(targetTabId);
      if (tab?.url) tabUrl = new URL(tab.url).hostname;
    } catch { /* tab may have closed */ }
  }

  document.getElementById('target-domain')!.textContent = tabUrl;
  document.getElementById('import-ui')!.style.display = '';
  setupEvents();
}

let pendingData: Record<string, string> | null = null;

function setupEvents() {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone')!;

  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handleFile(file);
    fileInput.value = '';
  });

  document.getElementById('btn-confirm')!.addEventListener('click', confirmImport);
  document.getElementById('btn-cancel')!.addEventListener('click', () => {
    pendingData = null;
    document.getElementById('preview')!.style.display = 'none';
    document.getElementById('drop-zone')!.style.display = '';
    hideMsg();
  });
}

async function handleFile(file: File) {
  showMsg('Reading file...', 'info');
  try {
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      showMsg('Invalid format: expected a JSON object with key-value pairs', 'error');
      return;
    }

    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      raw[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }

    if (Object.keys(raw).length === 0) {
      showMsg('No data found in file', 'error');
      return;
    }

    pendingData = raw;

    const meta = document.getElementById('preview-meta')!;
    meta.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = 'Keys to import: ';
    meta.appendChild(strong);
    meta.appendChild(document.createTextNode(String(Object.keys(raw).length)));

    document.getElementById('preview-keys')!.textContent = Object.keys(raw).join('\n');
    document.getElementById('drop-zone')!.style.display = 'none';
    document.getElementById('preview')!.style.display = '';
    hideMsg();
  } catch (err) {
    showMsg(`Failed to parse JSON: ${err instanceof Error ? err.message : err}`, 'error');
  }
}

async function confirmImport() {
  if (!pendingData) return;
  const data = pendingData;
  pendingData = null;

  const btn = document.getElementById('btn-confirm') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Importing...';
  showMsg(`Injecting ${Object.keys(data).length} keys into localStorage...`, 'info');

  try {
    const response = await browser.tabs.sendMessage(targetTabId, {
      type: 'SET_ALL_STORAGE',
      data,
    });

    if (response?.success) {
      const written = response.written || Object.keys(data).length;
      showMsg(`Import successful! ${written} keys injected. You can close this tab.`, 'success');
      document.getElementById('preview')!.style.display = 'none';
    } else {
      showMsg(`Import failed: ${response?.error || 'Unknown error'}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Import into localStorage';
    }
  } catch (err) {
    showMsg(`Import failed: ${err instanceof Error ? err.message : err}. Make sure the target tab is still open.`, 'error');
    btn.disabled = false;
    btn.textContent = 'Import into localStorage';
  }
}

function showMsg(text: string, type: 'success' | 'error' | 'info') {
  const el = document.getElementById('message')!;
  el.textContent = text;
  el.className = `message message-${type}`;
  el.style.display = '';
}

function hideMsg() {
  const el = document.getElementById('message');
  if (el) el.style.display = 'none';
}
