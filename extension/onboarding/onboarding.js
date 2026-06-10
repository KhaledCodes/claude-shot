// Welcome page shown once on first install (opened by background.js).
// Inline scripts are blocked by the extension CSP, so handlers live here.

// Open a real page so the user can immediately press the shortcut to try it.
document.getElementById("try").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://example.com" });
});

document.getElementById("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("shortcut-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

document.getElementById("helper-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({
    url: "https://github.com/KhaledCodes/claude-shot#install-the-helper-one-time",
  });
});
