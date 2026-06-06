# claude-shot — Privacy Policy

_Last updated: 2026-06-06_

claude-shot is a Chrome extension that captures a screenshot of the tab you're
viewing and helps you get that image into Claude — via your system clipboard, a
direct paste into a claude.ai tab, or an optional helper that pastes into your
terminal.

## What we collect

**Nothing.** claude-shot has no servers and no analytics. It does not transmit
your screenshots, your browsing data, or any personal information off your
device to the developer or to any third party.

## What the extension does with your screenshot

A screenshot is captured **only when you explicitly invoke the extension** (by
clicking the toolbar icon or pressing the keyboard shortcut). The captured image
is handled entirely on your own machine:

- **Clipboard (default):** The image is written to your system clipboard so you
  can paste it wherever you choose.
- **Downloads (fallback):** If the clipboard write is refused, the image is
  saved as a `.png` file to your Downloads folder.
- **Direct paste into claude.ai (opt-in):** If you enable this, the image is
  placed into the message composer of a claude.ai tab you already have open. The
  image is inserted into that page in your browser; it is not sent anywhere by
  the extension. You decide whether to actually submit it to Claude.
- **Auto-paste into a terminal (opt-in, macOS only):** If you install the
  optional native helper, the image is passed to that helper — a program running
  locally on your own computer — which pastes it into the terminal app you
  selected. The helper has no network access and sends nothing to the internet.

## What is stored locally

- **Your preferences** (e.g., which paste target you chose) are saved using
  Chrome's extension storage, on your device.
- **The captured PNG** is briefly held in extension storage so it can pass
  between the extension's background worker and its popup window. It is
  overwritten by your next capture and never leaves your device.

## Permissions

claude-shot requests only the permissions needed for the behavior above
(`activeTab`, `scripting`, `storage`, `downloads`, `notifications`, `offscreen`,
`clipboardWrite`, `nativeMessaging`). It does **not** request broad host access
to all websites.

## Third parties

claude-shot does not sell or share data with third parties. When you choose to
paste a screenshot into claude.ai or into Claude Code, your subsequent use of
those products is governed by Anthropic's own privacy policy.

## Changes

If this policy changes, the updated version will be posted at the same location
with a new "Last updated" date.

## Contact

Questions? Contact: khaledelkhatib94@gmail.com
