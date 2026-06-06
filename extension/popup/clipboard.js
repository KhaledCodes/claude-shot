// Writes a PNG blob to the system clipboard. Tries three paths in order:
//   1. Direct write from the popup document. Fast when it works.
//   2. Write from an offscreen document, routed via the service worker.
//      Robust against MV3 popup focus quirks on macOS.
//   3. Save to Downloads. Always-on fallback.

export async function writePngToClipboard(blob) {
  if (!blob || blob.type !== "image/png") {
    throw new Error(`Expected image/png Blob, got type=${blob?.type}`);
  }

  const popupWrite = await tryPopupWrite(blob);
  if (popupWrite.ok) return { mode: "clipboard", via: "popup" };

  const offscreenWrite = await tryOffscreenWrite(blob);
  if (offscreenWrite.ok) return { mode: "clipboard", via: "offscreen" };

  return await downloadFallback(blob, popupWrite.error, offscreenWrite.error);
}

async function tryPopupWrite(blob) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return { ok: false, error: "Clipboard API unavailable in popup context" };
  }
  try {
    window.focus();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return { ok: true };
  } catch (e) {
    console.warn("[claude-shot] popup clipboard write failed:", e);
    return { ok: false, error: `${e?.name ?? "Error"}: ${e?.message ?? "rejected"}` };
  }
}

async function tryOffscreenWrite(blob) {
  try {
    const base64 = await blobToBase64(blob);
    const r = await chrome.runtime.sendMessage({
      type: "offscreen-clipboard",
      base64,
    });
    if (r?.ok) return { ok: true };
    return { ok: false, error: r?.error ?? "Offscreen write did not respond." };
  } catch (e) {
    console.warn("[claude-shot] offscreen clipboard request failed:", e);
    return { ok: false, error: `${e?.name ?? "Error"}: ${e?.message ?? String(e)}` };
  }
}

async function downloadFallback(blob, popupErr, offscreenErr) {
  console.warn("[claude-shot] falling back to downloads. popup:", popupErr, "offscreen:", offscreenErr);
  const url = URL.createObjectURL(blob);
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  try {
    await chrome.downloads.download({
      url,
      filename: `claude-shot-${stamp}.png`,
      saveAs: false,
    });
    return { mode: "download", popupErr, offscreenErr };
  } catch (dlErr) {
    throw new Error(
      `Both clipboard paths failed and downloads fallback also failed. popup=${popupErr} offscreen=${offscreenErr} download=${dlErr?.message ?? dlErr}`,
    );
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
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
