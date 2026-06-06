// Thin wrapper around chrome.runtime.sendNativeMessage for the claude-shot
// helper. Surfaces "not installed" vs "host returned an error" cleanly so
// the popup can fall back to the clipboard path with a clear message.

const HOST_NAME = "com.claudeshot.host";

export const KNOWN_TARGETS = [
  { id: "com.apple.Terminal",            label: "Terminal.app" },
  { id: "com.googlecode.iterm2",         label: "iTerm2" },
  { id: "com.microsoft.VSCode",          label: "VS Code" },
  { id: "com.microsoft.VSCodeInsiders",  label: "VS Code Insiders" },
  { id: "com.todesktop.230313mzl4w4u92", label: "Cursor" },
  { id: "dev.warp.Warp-Stable",          label: "Warp" },
  { id: "com.github.wez.wezterm",        label: "WezTerm" },
  { id: "net.kovidgoyal.kitty",          label: "kitty" },
  { id: "com.anthropic.claudefordesktop",label: "Claude Desktop" },
];

export function labelForBundle(bundleId) {
  return KNOWN_TARGETS.find((t) => t.id === bundleId)?.label ?? bundleId;
}

export async function pingHost() {
  try {
    const r = await chrome.runtime.sendNativeMessage(HOST_NAME, { type: "ping" });
    return { installed: true, version: r?.version ?? "?" };
  } catch (e) {
    return { installed: false, error: e?.message ?? String(e) };
  }
}

export async function pastePngViaHost(base64, bundleId) {
  if (!bundleId) throw new Error("No target bundleId configured.");
  try {
    const r = await chrome.runtime.sendNativeMessage(HOST_NAME, {
      type: "paste-png",
      base64,
      bundleId,
    });
    if (!r) throw new Error("Helper returned no response.");
    if (!r.ok) throw new HostError(r.error ?? "Helper reported failure.");
    return { target: r.target ?? labelForBundle(bundleId) };
  } catch (e) {
    if (e instanceof HostError) throw e;
    // chrome.runtime.lastError surfaces "Specified native messaging host not
    // found." when the manifest isn't installed.
    const msg = e?.message ?? String(e);
    if (/host not found|not registered|host name not specified/i.test(msg)) {
      throw new HostNotInstalledError();
    }
    throw new Error(`Native helper communication failed: ${msg}`);
  }
}

export class HostNotInstalledError extends Error {
  constructor() {
    super("The claude-shot helper isn't installed. Run host/scripts/install.sh.");
    this.name = "HostNotInstalledError";
  }
}

export class HostError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "HostError";
  }
}
