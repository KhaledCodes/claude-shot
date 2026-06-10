import { pingHost, labelForBundle } from "../popup/native-host.js";

const DEFAULTS = {
  directPaste: false,
  defaultArea: false,
  autoPaste: false,
  targetBundleId: "com.apple.Terminal",
};

const els = {
  directPaste: document.getElementById("direct-paste"),
  defaultArea: document.getElementById("default-area"),
  autoPaste: document.getElementById("auto-paste"),
  targetBundle: document.getElementById("target-bundle"),
  helperDot: document.getElementById("helper-dot"),
  helperText: document.getElementById("helper-text"),
  helperRecheck: document.getElementById("helper-recheck"),
  openShortcuts: document.getElementById("open-shortcuts"),
  saved: document.getElementById("saved"),
};

async function load() {
  const { prefs } = await chrome.storage.local.get("prefs");
  const p = { ...DEFAULTS, ...(prefs ?? {}) };
  els.directPaste.checked = p.directPaste;
  els.defaultArea.checked = p.defaultArea;
  els.autoPaste.checked = p.autoPaste;
  els.targetBundle.value = p.targetBundleId;
  await refreshHelperStatus();
}

let savedTimer = null;
async function persist() {
  const prefs = {
    directPaste: els.directPaste.checked,
    defaultArea: els.defaultArea.checked,
    autoPaste: els.autoPaste.checked,
    targetBundleId: els.targetBundle.value,
  };
  await chrome.storage.local.set({ prefs });
  els.saved.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => (els.saved.hidden = true), 1200);
}

async function refreshHelperStatus() {
  els.helperDot.className = "dot checking";
  els.helperText.textContent = "Checking helper…";
  const r = await pingHost();
  if (r.installed) {
    els.helperDot.className = "dot ok";
    els.helperText.textContent = `Helper installed (v${r.version}). Ready to auto-paste into ${labelForBundle(els.targetBundle.value)}.`;
  } else {
    els.helperDot.className = "dot err";
    els.helperText.textContent =
      "Helper not detected. Run host/scripts/install.sh, then click recheck.";
  }
}

els.directPaste.addEventListener("change", persist);
els.defaultArea.addEventListener("change", persist);
els.autoPaste.addEventListener("change", persist);
els.targetBundle.addEventListener("change", async () => {
  await persist();
  await refreshHelperStatus();
});
els.helperRecheck.addEventListener("click", refreshHelperStatus);
// Chrome blocks chrome:// links, but an extension may open the shortcuts page
// programmatically. tabs.create needs no extra permission.
els.openShortcuts.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

load();
