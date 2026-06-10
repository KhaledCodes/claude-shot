import { chooseTarget, sendButtonLabel } from "./claude-ai-target.js";
import { writePngToClipboard } from "./clipboard.js";
import { Cropper } from "./crop.js";
import {
  pastePngViaHost,
  labelForBundle,
  HostNotInstalledError,
} from "./native-host.js";

const els = {
  frame: document.getElementById("frame"),
  stage: document.getElementById("stage"),
  placeholder: document.getElementById("placeholder"),
  preview: document.getElementById("preview"),
  cropOverlay: document.getElementById("crop-overlay"),
  cropRect: document.getElementById("crop-rect"),
  capturedFrom: document.getElementById("captured-from"),
  retake: document.getElementById("retake"),
  settings: document.getElementById("settings"),
  error: document.getElementById("error"),
  cancel: document.getElementById("cancel"),
  send: document.getElementById("send"),
  cropBtn: document.getElementById("crop"),
  cropDone: document.getElementById("crop-done"),
  cropCancel: document.getElementById("crop-cancel"),
  toast: document.getElementById("toast"),
  result: document.getElementById("result"),
  resultIcon: document.getElementById("result-icon"),
  resultText: document.getElementById("result-text"),
  resultSub: document.getElementById("result-sub"),
};

const cropper = new Cropper({
  stage: els.stage,
  preview: els.preview,
  overlay: els.cropOverlay,
  rect: els.cropRect,
});

let state = {
  /** @type {Blob | null} current PNG to send (post-crop if cropped) */
  blob: null,
  /** @type {string | null} active tab URL at capture time */
  tabUrl: null,
  /** @type {number | null} */
  tabId: null,
  /** "claude-ai" | "clipboard" */
  target: "clipboard",
  /** prefs */
  prefs: {
    directPaste: false,
    defaultArea: false,
    autoPaste: false,
    targetBundleId: "com.apple.Terminal",
  },
};

async function loadPrefs() {
  const { prefs } = await chrome.storage.local.get("prefs");
  if (prefs) state.prefs = { ...state.prefs, ...prefs };
}

function setError(msg) {
  if (!msg) {
    els.error.hidden = true;
    els.error.textContent = "";
    return;
  }
  els.error.hidden = false;
  els.error.textContent = msg;
}

function showToast(msg, kind = "ok", durationMs = 1400) {
  els.toast.textContent = msg;
  els.toast.classList.toggle("error", kind === "error");
  els.toast.hidden = false;
  return new Promise((resolve) => {
    setTimeout(() => {
      els.toast.hidden = true;
      resolve();
    }, durationMs);
  });
}

async function dataUrlToBlob(dataUrl) {
  const resp = await fetch(dataUrl);
  return await resp.blob();
}

function shortHost(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function applyTarget() {
  if (state.prefs.autoPaste) {
    state.target = "native-host";
    els.send.textContent = `Send to ${labelForBundle(state.prefs.targetBundleId)}`;
  } else if (state.prefs.directPaste) {
    state.target = chooseTarget(state.tabUrl);
    els.send.textContent = sendButtonLabel(state.target);
  } else {
    state.target = "clipboard";
    els.send.textContent = sendButtonLabel(state.target);
  }
  els.capturedFrom.textContent = shortHost(state.tabUrl) || "this tab";
  els.capturedFrom.title = state.tabUrl ?? "";
}

function renderPreview(blob) {
  state.blob = blob;
  if (els.preview.src && els.preview.src.startsWith("blob:")) {
    URL.revokeObjectURL(els.preview.src);
  }
  const url = URL.createObjectURL(blob);
  els.preview.src = url;
  els.preview.hidden = false;
  els.placeholder.hidden = true;
  els.send.disabled = false;
  els.cropBtn.hidden = false;
}

function setCropMode(on) {
  if (on) {
    cropper.enable();
    els.cropBtn.hidden = true;
    els.send.hidden = true;
    els.cancel.hidden = true;
    els.cropDone.hidden = false;
    els.cropCancel.hidden = false;
  } else {
    cropper.disable();
    els.cropBtn.hidden = false;
    els.send.hidden = false;
    els.cancel.hidden = false;
    els.cropDone.hidden = true;
    els.cropCancel.hidden = true;
  }
}

async function captureFresh() {
  return await chrome.runtime.sendMessage({ type: "capture-now" });
}

async function applyCaptureResult(result) {
  if (!result?.ok) {
    els.placeholder.hidden = true;
    setError(result?.error ?? "Capture failed.");
    return;
  }
  setError(null);
  state.tabUrl = result.tabUrl;
  state.tabId = result.tabId;
  applyTarget();
  const blob = await dataUrlToBlob(result.dataUrl);
  renderPreview(blob);
}

async function init() {
  await loadPrefs();

  // Either there's a fresh stash from the keyboard-command path, or we ask the
  // background to capture now (toolbar-click path).
  const stash = await chrome.runtime.sendMessage({ type: "consume-stash" });
  let result;
  if (stash && Date.now() - stash.capturedAt < 30_000) {
    result = { ok: true, ...stash };
  } else {
    result = await captureFresh();
  }

  await applyCaptureResult(result);

  if (state.prefs.defaultArea && state.blob) {
    setCropMode(true);
  }
}

async function retake() {
  els.retake.disabled = true;
  els.send.disabled = true;
  els.placeholder.textContent = "Recapturing…";
  els.placeholder.hidden = false;
  els.preview.hidden = true;
  try {
    const result = await captureFresh();
    await applyCaptureResult(result);
  } finally {
    els.retake.disabled = false;
  }
}

function showResult({ ok, title, sub }) {
  els.result.hidden = false;
  els.result.classList.toggle("ok", ok);
  els.result.classList.toggle("err", !ok);
  els.resultIcon.textContent = ok ? "✓" : "✗";
  els.resultText.textContent = title;
  els.resultSub.textContent = sub ?? "";
  // Hide the action bar; replace with a single "Close" button.
  els.send.hidden = true;
  els.cropBtn.hidden = true;
  els.cropDone.hidden = true;
  els.cropCancel.hidden = true;
  els.cancel.textContent = "Close";
  els.cancel.hidden = false;
}

async function send() {
  if (!state.blob) { setError("No screenshot blob. Try reopening the popup."); return; }
  els.send.disabled = true;
  els.send.textContent = "Sending…";
  setError(null);

  try {
    if (state.target === "native-host") {
      try {
        const base64 = await blobToBase64(state.blob);
        const r = await pastePngViaHost(base64, state.prefs.targetBundleId);
        showResult({
          ok: true,
          title: `Pasted into ${r.target}`,
          sub: "Screenshot is in your terminal. Claude Code should see it next time you submit.",
        });
        setTimeout(() => window.close(), 1800);
      } catch (e) {
        // If the helper isn't installed, transparently fall back to the
        // clipboard path so the user isn't blocked.
        if (e instanceof HostNotInstalledError) {
          console.warn("[claude-shot] helper not installed; falling back to clipboard");
          const fb = await writePngToClipboard(state.blob);
          showResult({
            ok: true,
            title: "Copied. Cmd+V in Claude",
            sub: `Helper isn't installed yet. Image is on the clipboard (via ${fb.via ?? fb.mode}). Run host/scripts/install.sh to enable auto-paste.`,
          });
          setTimeout(() => window.close(), 2800);
        } else {
          throw e;
        }
      }
    } else if (state.target === "claude-ai") {
      await sendToClaudeAi(state.blob, state.tabId);
      showResult({
        ok: true,
        title: "Pasted into Claude.ai",
        sub: "The image is in the chat composer. Switch to that tab to send.",
      });
      setTimeout(() => window.close(), 1800);
    } else {
      const r = await writePngToClipboard(state.blob);
      if (r.mode === "clipboard") {
        showResult({
          ok: true,
          title: "Copied. Cmd+V in Claude",
          sub: `Image is on the clipboard (via ${r.via}). Switch to your Claude window and paste.`,
        });
        setTimeout(() => window.close(), 2000);
      } else {
        showResult({
          ok: true,
          title: "Saved to Downloads",
          sub: "Clipboard wasn't available; drag the PNG into Claude from Downloads.",
        });
      }
    }
  } catch (e) {
    // console.warn (not error) so a user-facing failure (wrong target app,
    // helper not installed, page not capturable) doesn't trip Chrome's
    // dev-mode Errors badge. The popup banner already surfaces the reason
    // to the user.
    console.warn("[claude-shot] send() failed:", e);
    els.send.disabled = false;
    els.send.textContent = sendButtonLabel(state.target);
    showResult({
      ok: false,
      title: "Send failed",
      sub: `${e?.name ?? "Error"}: ${e?.message ?? String(e)}`,
    });
    els.send.hidden = false;
    els.cancel.textContent = "Cancel";
  }
}

async function blobToBase64(blob) {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function sendToClaudeAi(blob, tabId) {
  if (!tabId) throw new Error("No target tab for Claude.ai paste.");
  const base64 = await blobToBase64(blob);
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: pasteIntoClaudeAi,
    args: [base64],
  });
  if (!result?.ok) {
    throw new Error(result?.error ?? "Could not paste into Claude.ai.");
  }
}

// Injected into the claude.ai tab. Self-contained: decodes the PNG bytes,
// finds the chat composer, and dispatches a synthetic paste event.
function pasteIntoClaudeAi(base64) {
  try {
    const bin = atob(base64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const blob = new Blob([u8], { type: "image/png" });
    const file = new File([blob], `claude-shot-${Date.now()}.png`, {
      type: "image/png",
      lastModified: Date.now(),
    });

    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const selectors = [
      'div[contenteditable="true"][data-placeholder]',
      'div.ProseMirror[contenteditable="true"]',
      'fieldset div[contenteditable="true"]',
      'div[contenteditable="true"]',
    ];
    let composer = null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) { composer = el; break; }
    }
    if (!composer) return { ok: false, error: "Couldn't find the Claude.ai chat composer." };

    composer.focus();
    const dt = new DataTransfer();
    dt.items.add(file);
    const ev = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
    try { Object.defineProperty(ev, "clipboardData", { value: dt }); } catch {}
    composer.dispatchEvent(ev);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

els.cancel.addEventListener("click", () => window.close());
els.send.addEventListener("click", send);
els.retake.addEventListener("click", retake);
els.settings.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
els.cropBtn.addEventListener("click", () => setCropMode(true));
els.cropCancel.addEventListener("click", () => setCropMode(false));
els.cropDone.addEventListener("click", async () => {
  try {
    if (!cropper.hasSelection()) {
      setCropMode(false);
      return;
    }
    const cropped = await cropper.cropToBlob(state.blob);
    renderPreview(cropped);   // sets state.blob to the cropped image
    setCropMode(false);       // tear down the crop overlay
    await send();             // crop is instant-send: no extra Send click
  } catch (e) {
    setError(e?.message ?? "Crop failed.");
  }
});

init().catch((e) => {
  els.placeholder.hidden = true;
  setError(e?.message ?? String(e));
});
