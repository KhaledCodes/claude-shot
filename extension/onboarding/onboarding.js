// Welcome page shown once on first install (opened by background.js).
// Inline scripts are blocked by the extension CSP, so handlers live here.

const REPO_URL = "https://github.com/KhaledCodes/claude-shot";
const INSTALL_CMD = "cd claude-shot/host && bash scripts/install.sh";

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

document.getElementById("download-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: REPO_URL });
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
