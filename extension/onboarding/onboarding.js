// Welcome page shown once on first install (opened by background.js).
// Inline scripts are blocked by the extension CSP, so handlers live here.

// One-liner that downloads + runs the helper installer. Process substitution
// (not a pipe) so the installer's interactive extension-ID prompt still works.
const INSTALL_CMD =
  "bash <(curl -fsSL https://raw.githubusercontent.com/KhaledCodes/claude-shot/main/host/scripts/install.sh)";

// Open a real page so the user can immediately press the shortcut to try it.
document.getElementById("try").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://example.com" });
});

const openSettings = () => chrome.runtime.openOptionsPage();
document.getElementById("settings").addEventListener("click", openSettings);
document.getElementById("settings-link").addEventListener("click", (e) => {
  e.preventDefault();
  openSettings();
});

document.getElementById("shortcut-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

document.getElementById("copy-cmd").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  try {
    await navigator.clipboard.writeText(INSTALL_CMD);
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = "Copy"; }, 1500);
  } catch {
    btn.textContent = "Copy failed";
    setTimeout(() => { btn.textContent = "Copy"; }, 1500);
  }
});
