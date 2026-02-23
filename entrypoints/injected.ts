export default defineUnlistedScript(() => {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || !event.data?.type) return;

    if (event.data.type === 'AS_SYNC_GET') {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          data[key] = localStorage.getItem(key) || '';
        }
      }
      window.postMessage({ type: 'AS_SYNC_DATA', data }, '*');
    }

    if (event.data.type === 'AS_SYNC_SET' && event.data.data) {
      try {
        let written = 0;
        for (const [key, value] of Object.entries(event.data.data as Record<string, string>)) {
          if (typeof key === 'string' && typeof value === 'string') {
            localStorage.setItem(key, value);
            written++;
          }
        }
        window.postMessage({ type: 'AS_SYNC_SET_DONE', success: true, written }, '*');
      } catch (err) {
        window.postMessage({ type: 'AS_SYNC_SET_DONE', success: false, error: String(err) }, '*');
      }
    }
  });
});
