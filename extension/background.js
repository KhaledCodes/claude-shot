// Service worker: handles the keyboard command and capture-on-demand requests
// from the popup. The popup is what the user actually sees; this file only
// produces the PNG dataURL and stashes it for the popup to consume.

const STASH_KEY = "pending";
const FORBIDDEN_SCHEMES = ["chrome:", "chrome-extension:", "edge:", "about:", "devtools:"];
const FORBIDDEN_HOSTS = ["chrome.google.com"];

// Show the welcome page once, on first install only (not on updates).
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
  }
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

function capturableReason(url) {
  if (!url) return "No URL on the active tab.";
  let u;
  try {
    u = new URL(url);
  } catch {
    return "Active tab has an invalid URL.";
  }
  if (FORBIDDEN_SCHEMES.includes(u.protocol)) {
    return "Chrome blocks screenshots of internal pages (chrome://, devtools, etc.). Try a regular site.";
  }
  if (FORBIDDEN_HOSTS.includes(u.hostname)) {
    return "Chrome blocks screenshots of the Web Store. Try a different tab.";
  }
  return null;
}

async function notify(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title,
      message,
      priority: 1,
    });
  } catch (e) {
    console.warn("notify failed", e);
  }
}

async function captureActive() {
  const tab = await getActiveTab();
  if (!tab) return { ok: false, error: "No active tab." };

  const reason = capturableReason(tab.url);
  if (reason) return { ok: false, error: reason };

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    return {
      ok: true,
      dataUrl,
      tabId: tab.id,
      tabUrl: tab.url,
      capturedAt: Date.now(),
    };
  } catch (e) {
    return { ok: false, error: e?.message ?? "captureVisibleTab failed." };
  }
}

let ensuringOffscreen = null;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument?.()) return;
  if (ensuringOffscreen) {
    await ensuringOffscreen;
    return;
  }
  ensuringOffscreen = chrome.offscreen
    .createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["CLIPBOARD"],
      justification:
        "Write the captured screenshot PNG to the system clipboard from a focused document context.",
    })
    .catch((e) => {
      if (String(e?.message || e).includes("Only a single offscreen document")) return;
      throw e;
    });
  try {
    await ensuringOffscreen;
  } finally {
    ensuringOffscreen = null;
  }
}

async function writeClipboardViaOffscreen(base64) {
  await ensureOffscreen();
  // Brief settle delay so the offscreen doc's onMessage listener is attached.
  // createDocument resolves once the doc is loaded, but in practice the
  // listener can race with the immediate sendMessage on cold start.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await chrome.runtime.sendMessage({
        type: "offscreen-clipboard-write",
        base64,
      });
      if (r) return r;
    } catch (e) {
      if (attempt === 2) throw e;
    }
    await new Promise((res) => setTimeout(res, 50));
  }
  return { ok: false, error: "Offscreen document did not respond." };
}

// The popup asks us to capture when it opens, and to write the clipboard via
// the offscreen document if its own attempt failed.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "capture-now") {
    captureActive().then(sendResponse);
    return true; // keep the channel open for the async response
  }
  if (msg?.type === "consume-stash") {
    chrome.storage.session.get(STASH_KEY).then(async (s) => {
      const stash = s[STASH_KEY] ?? null;
      if (stash) await chrome.storage.session.remove(STASH_KEY);
      sendResponse(stash);
    });
    return true;
  }
  if (msg?.type === "offscreen-clipboard") {
    writeClipboardViaOffscreen(msg.base64)
      .then(sendResponse)
      .catch((e) =>
        sendResponse({ ok: false, error: e?.message ?? String(e) }),
      );
    return true;
  }
  return false;
});

// Keyboard command path: capture, stash, then ask Chrome to open the popup so
// it renders the freshly captured image. openPopup() requires default_popup to
// be set in the manifest, which it is.
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "capture-visible") {
    const result = await captureActive();
    if (!result.ok) {
      await notify("Claude Shot", result.error);
      return;
    }
    await chrome.storage.session.set({ [STASH_KEY]: result });
    try {
      await chrome.action.openPopup();
    } catch (e) {
      await notify(
        "Screenshot ready",
        "Click the Claude Shot icon to preview and send.",
      );
    }
    return;
  }
  if (command === "capture-and-send") {
    await instantSend();
    return;
  }
});

// Instant-send path: capture the active tab and immediately route the PNG to
// the user's configured destination: native host with their target app if
// auto-paste is on, otherwise the system clipboard via the offscreen doc.
// No popup, no confirm. Lives entirely in the service worker.
async function loadPrefs() {
  const { prefs } = await chrome.storage.local.get("prefs");
  return {
    autoPaste: true,
    targetBundleId: "com.apple.Terminal",
    ...(prefs ?? {}),
  };
}

async function instantSend() {
  const result = await captureActive();
  if (!result.ok) {
    await notify("Claude Shot", result.error);
    return;
  }
  const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, "");
  const prefs = await loadPrefs();

  if (prefs.autoPaste && prefs.targetBundleId) {
    try {
      const r = await chrome.runtime.sendNativeMessage("com.claudeshot.host", {
        type: "paste-png",
        base64,
        bundleId: prefs.targetBundleId,
      });
      if (r?.ok) {
        await notify("Claude Shot", `Pasted into ${r.target ?? prefs.targetBundleId}`);
        return;
      }
      await notify("Claude Shot", `Helper: ${r?.error ?? "rejected"}`);
      return;
    } catch (e) {
      // Helper missing or comms broken; silently fall back to clipboard.
      console.warn("[claude-shot] instant-send via host failed, falling back:", e);
    }
  }

  const cb = await writeClipboardViaOffscreen(base64);
  if (cb?.ok) {
    await notify("Claude Shot", "Copied. Cmd+V in Claude");
  } else {
    await notify("Claude Shot", cb?.error ?? "Clipboard write failed");
  }
}
