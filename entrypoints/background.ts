export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (
      message: { type: string; data?: Record<string, string> },
      sender: browser.Runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      if (
        message.type !== "GET_ALL_STORAGE" &&
        message.type !== "SET_ALL_STORAGE"
      )
        return;

      if (sender.tab) {
        sendResponse({ error: "Unauthorized" });
        return;
      }

      browser.tabs
        .query({ active: true, currentWindow: true })
        .then((tabs) => {
          const tab = tabs[0];
          if (!tab?.id) {
            sendResponse({ error: "No active tab found" });
            return;
          }
          return browser.tabs.sendMessage(tab.id, message);
        })
        .then((response) => {
          if (response !== undefined) sendResponse(response);
        })
        .catch(() => {
          sendResponse({
            error: "Content script not available. Reload the page.",
          });
        });

      return true;
    },
  );
});
