import './styles/global.css';
import { parseLocalStorage } from '../../utils/storage-parser';
import { exportToJson, downloadBlob } from '../../utils/json-handler';
import type { AnimeSamaData } from '../../utils/types';

let currentData: AnimeSamaData | null = null;
let currentDomain = '';

function init() {
  document.getElementById('btn-export')!.addEventListener('click', handleExport);
  document.getElementById('btn-import')!.addEventListener('click', handleImport);
  loadData();
}

async function loadData() {
  const statusEl = document.getElementById('status')!;
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);
      currentDomain = url.hostname;
    }

    const response = await browser.runtime.sendMessage({ type: 'GET_ALL_STORAGE' });

    if (response?.error) {
      currentData = null;
      updateStatus(statusEl, false);
      showErrorState(response.error);
    } else if (response?.data && Object.keys(response.data).length > 0) {
      currentData = parseLocalStorage(response.data, currentDomain);
      updateStatus(statusEl, true);
      updateSummary();
      updateProgressList();
      document.getElementById('btn-export')!.removeAttribute('disabled');
    } else {
      currentData = null;
      updateStatus(statusEl, false);
      showEmptyState();
    }
  } catch {
    currentData = null;
    updateStatus(statusEl, false);
    showErrorState('Content script not available. Try reloading the page.');
  }
}

function updateStatus(el: HTMLElement, connected: boolean) {
  const dot = el.querySelector('.status-dot') as HTMLElement;
  const text = el.querySelector('.status-text') as HTMLElement;
  if (connected) {
    dot.classList.add('connected');
    text.textContent = currentDomain;
  } else {
    dot.classList.add('disconnected');
    text.textContent = 'No data found';
  }
}

function updateSummary() {
  if (!currentData) return;
  const summary = document.getElementById('summary')!;
  summary.style.display = '';
  document.getElementById('count-history')!.textContent = String(currentData.history.length);
  document.getElementById('count-watchlist')!.textContent = String(currentData.watchlist.length);
  document.getElementById('count-favorites')!.textContent = String(currentData.favorites.length);
}

function updateProgressList() {
  const container = document.getElementById('progress-list')!;
  container.textContent = '';

  if (!currentData || currentData.progress.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No progress data found';
    container.appendChild(p);
    return;
  }

  const grouped = new Map<string, typeof currentData.progress>();
  for (const p of currentData.progress) {
    const title = p.titleSlug.replace(/-/g, ' ');
    if (!grouped.has(title)) grouped.set(title, []);
    grouped.get(title)!.push(p);
  }

  for (const [title, entries] of grouped) {
    const group = document.createElement('div');
    group.className = 'title-group';

    const header = document.createElement('div');
    header.className = 'title-header';
    header.textContent = capitalize(title);
    group.appendChild(header);

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'title-entry';

      const type = entry.type || '';
      const lang = entry.language || '';
      const progress = entry.episodeName || entry.chapterName || '\u2014';

      if (type) {
        const badge = document.createElement('span');
        badge.className = `badge badge-${sanitizeClassName(type)}`;
        badge.textContent = type;
        row.appendChild(badge);
      }
      if (lang) {
        const badge = document.createElement('span');
        badge.className = `badge badge-${sanitizeClassName(lang)}`;
        badge.textContent = lang.toUpperCase();
        row.appendChild(badge);
      }

      const progressSpan = document.createElement('span');
      progressSpan.className = 'entry-progress';
      progressSpan.textContent = progress;
      row.appendChild(progressSpan);

      group.appendChild(row);
    }

    container.appendChild(group);
  }
}

function showEmptyState() {
  const container = document.getElementById('progress-list')!;
  container.textContent = '';
  const div = document.createElement('div');
  div.className = 'empty-state';
  const p = document.createElement('p');
  p.textContent = 'No localStorage data found on this page.';
  div.appendChild(p);
  container.appendChild(div);
}

function showErrorState(error: string) {
  const container = document.getElementById('progress-list')!;
  container.textContent = '';
  const div = document.createElement('div');
  div.className = 'empty-state';
  const p = document.createElement('p');
  p.textContent = error;
  div.appendChild(p);
  container.appendChild(div);
}

function handleExport() {
  if (!currentData) return;
  const btn = document.getElementById('btn-export') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Exporting...';
  try {
    const blob = exportToJson(currentData.raw);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `as-sync-${currentDomain}-${date}.json`);
    showMessage('Export successful', 'success');
  } catch {
    showMessage('Export failed. Please try again.', 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Export';
}

async function handleImport() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const host = tab.url ? new URL(tab.url).hostname : '';
  browser.tabs.create({
    url: browser.runtime.getURL(`/import.html?tabId=${tab.id}&target=${encodeURIComponent(host)}`),
  });
  window.close();
}

let messageTimer: ReturnType<typeof setTimeout> | undefined;

function showMessage(text: string, type: 'success' | 'error' | 'info') {
  const el = document.getElementById('message')!;
  clearTimeout(messageTimer);
  el.textContent = text;
  el.className = `message message-${type}`;
  el.style.display = '';
  if (type !== 'info') {
    messageTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
  }
}

function sanitizeClassName(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/g, '');
}

function capitalize(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

init();
