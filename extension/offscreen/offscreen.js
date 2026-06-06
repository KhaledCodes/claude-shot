// Offscreen document used purely to host a focused DOM context for the
// async Clipboard API. The popup may lose focus between user gesture and
// clipboard.write on macOS, so we have the background route the write here.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "offscreen-clipboard-write") return false;
  (async () => {
    try {
      const bin = atob(msg.base64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const blob = new Blob([u8], { type: "image/png" });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      sendResponse({ ok: true });
    } catch (e) {
      console.error("[claude-shot/offscreen] write failed:", e);
      sendResponse({ ok: false, error: `${e?.name ?? "Error"}: ${e?.message ?? String(e)}` });
    }
  })();
  return true; // async response
});
