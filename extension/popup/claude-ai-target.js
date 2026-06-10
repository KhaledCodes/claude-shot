// Decide whether the currently-active tab can receive an in-page synthetic
// paste (Claude.ai), or whether we should fall back to the system clipboard.

export function chooseTarget(tabUrl) {
  if (!tabUrl) return "clipboard";
  try {
    const u = new URL(tabUrl);
    if (u.hostname === "claude.ai" || u.hostname.endsWith(".claude.ai")) {
      return "claude-ai";
    }
    return "clipboard";
  } catch {
    return "clipboard";
  }
}

export function targetLabel(target) {
  return target === "claude-ai" ? "Claude.ai composer" : "System clipboard";
}

export function sendButtonLabel(target) {
  return target === "claude-ai" ? "Paste into Claude.ai" : "Copy. Cmd+V in Claude";
}
