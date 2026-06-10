# Chrome Web Store listing: Claude Shot

Copy/paste these into the Developer Dashboard fields. All wording is written to
match the extension's actual behavior so it survives review.

---

## Item name
Claude Shot

## Summary (≤132 chars)
Send a screenshot of any tab straight into your Claude session. Built for macOS.

## Category
Developer Tools  (alt: Productivity)

## Language
English

---

## Detailed description

> Claude Shot is a one-click bridge from your browser to Claude, built for macOS.
>
> Press ⌘⇧S and Claude Shot screenshots the active tab and sends it to Claude
> instantly. By default the image lands on your clipboard; switch to Claude
> (claude.ai, Claude Desktop, or Claude Code in your terminal) and paste with
> ⌘V. Want just a region? Click the toolbar icon and Crop. Install the optional
> helper and your screenshot drops straight into your Claude session, no ⌘V.
>
> Built for people who are constantly screenshotting a page to ask Claude about
> it.
>
> FEATURES
> • Send a screenshot to Claude in one keystroke (⌘⇧S): no preview, no extra clicks.
> • Crop to a region at native pixel resolution; the crop sends the moment you finish.
> • Two shortcuts: send instantly, or open the popup to crop first.
> • Opt-in: paste directly into the claude.ai chat composer when you're already
>   on claude.ai.
> • Opt-in (macOS): install a small local helper to auto-paste straight into
>   your terminal (no manual ⌘V), landing the image right in Claude Code.
>
> PRIVACY
> • Your screenshots never leave your device. No servers, no analytics.
> • No access to all your websites. Claude Shot only reads a tab when you
>   explicitly invoke it.
>
> WHAT IT CAN'T CAPTURE
> Chrome blocks tab capture on chrome:// pages, the Web Store, the new-tab page,
> and the PDF viewer. Claude Shot shows a notification instead of failing
> silently.
>
> Not affiliated with or endorsed by Anthropic. "Claude" is a trademark of
> Anthropic.

---

## Single purpose (dashboard field)
Claude Shot captures a screenshot of the current browser tab and routes that
image to Claude in one of three ways: copying it to the clipboard, pasting it
into an open claude.ai tab, or handing it to an optional local helper that
pastes it into a terminal.

---

## Permission justifications (paste one per permission)

- **activeTab**: Capture a screenshot of the tab the user is currently viewing,
  only at the moment the user invokes the extension.
- **scripting**: Inject a small helper into a claude.ai tab to place the
  screenshot into the chat composer (opt-in feature only).
- **storage**: Save the user's preferences and temporarily hold the captured
  PNG so it can pass between the background service worker and the popup.
- **downloads**: Save the screenshot as a file as a fallback when the system
  clipboard refuses the image.
- **notifications**: Tell the user when a capture can't be performed (e.g. on a
  chrome:// page).
- **offscreen**: Host a focused document needed to perform the asynchronous
  Clipboard API write, which the popup cannot reliably do on macOS.
- **clipboardWrite**: Write the captured screenshot to the system clipboard so
  the user can paste it into Claude.
- **nativeMessaging**: Communicate with the optional, user-installed macOS
  helper that auto-pastes the screenshot into a terminal (opt-in).
- **Host permissions**: None requested. Claude Shot does not request access to
  all sites; it relies on activeTab only.

## Remote code
No. The extension contains no remotely hosted or eval'd code; all logic ships in
the package.

---

## Data usage (Privacy practices tab)

Data collected: **none.** Under the Chrome Web Store definition, "collect" means
transmitting data off the user's device. Claude Shot transmits nothing, the
screenshot stays on the device (clipboard / Downloads / a local helper) until
the user themselves pastes it somewhere.

Leave every data-type checkbox **unchecked**, and certify all three:
- ☑ I do not sell or transfer user data to third parties (outside approved uses).
- ☑ I do not use or transfer user data for purposes unrelated to the single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness / for lending.

Privacy policy URL: (host PRIVACY.md somewhere public, see SUBMISSION.md)

---

## Required graphics

| Asset | Size | Status |
| --- | --- | --- |
| Store icon | 128×128 PNG | Have `extension/icons/icon-128.png` (placeholder, see note) |
| Screenshots | 1280×800 or 640×400 PNG/JPEG, 1–5 images | **Need to create**: at least 1 |
| Small promo tile (optional) | 440×280 | Optional |
| Marquee promo (optional) | 1400×560 | Optional |

Screenshot ideas (1280×800): (1) the popup preview over a real webpage,
(2) the crop drag in progress, (3) the options page with auto-paste target
selected. A public listing looks unfinished with zero screenshots, add at
least one.
