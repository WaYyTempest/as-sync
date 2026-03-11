const BRIDGE_TIMEOUT_MS = 5000;

export default defineContentScript({
  matches: ["<all_urls>"],

  async main() {
    // injectScript hangs on Firefox MV2: inline scripts (script.text) never fire
    // the load event that WXT awaits. Use Promise.race with a timeout as workaround.
    await Promise.race([
      injectScript("/injected.js", { keepInDom: true }).catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, 100)),
    ]);

    function postAndWait<T>(
      msg: Record<string, unknown>,
      responseType: string,
    ): Promise<T> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener("message", handler);
          reject(new Error("Timeout waiting for page script"));
        }, BRIDGE_TIMEOUT_MS);

        function handler(event: MessageEvent) {
          if (event.source !== window || event.data?.type !== responseType)
            return;
          window.removeEventListener("message", handler);
          clearTimeout(timeout);
          resolve(event.data as T);
        }

        window.addEventListener("message", handler);
        window.postMessage(msg, "*");
      });
    }

    browser.runtime.onMessage.addListener(
      (
        message: { type: string; data?: Record<string, string> },
        _sender: browser.Runtime.MessageSender,
        sendResponse: (response: unknown) => void,
      ) => {
        if (message.type === "GET_ALL_STORAGE") {
          postAndWait<{ data: Record<string, string> }>(
            { type: "AS_SYNC_GET" },
            "AS_SYNC_DATA",
          )
            .then((result) => sendResponse({ data: result.data }))
            .catch(() => sendResponse({ data: {} }));
          return true;
        }

        if (message.type === "SET_ALL_STORAGE" && message.data) {
          postAndWait<{ success: boolean; error?: string }>(
            { type: "AS_SYNC_SET", data: message.data },
            "AS_SYNC_SET_DONE",
          )
            .then((result) =>
              sendResponse({ success: result.success, error: result.error }),
            )
            .catch((err) =>
              sendResponse({ success: false, error: String(err) }),
            );
          return true;
        }

        return false;
      },
    );
  },
});
