# claude-shot

One-click screenshot → Claude. A small Chrome (Manifest V3) extension that
captures the visible tab and routes the image to Claude wherever Claude is
running.

## Install (developer build)

1. Clone or download this folder.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and pick the `extension/` directory.
5. Pin the orange claude-shot icon to your toolbar so it's one click away.

## Use

1. **Navigate** the browser tab to whatever you want to screenshot (a website,
   an app you're testing, anything).
2. **Press ⌘⇧S.** Claude Shot screenshots the active tab and sends it to Claude
   instantly. By default the image lands on your system clipboard.
3. **Switch to your Claude window** (this terminal, Claude Desktop, claude.ai)
   and press **⌘V** to paste.
4. **Want just a region, or prefer a click?** Click the toolbar icon: hit
   **Send** for the whole tab, or **Crop** to drag a region (it sends as soon as
   you're done).

The popup header shows the hostname of the captured tab so you always know
which page got screenshotted. There's a small **↻** button next to it if you
want to retake from the same tab without closing the popup.

### Opt-in: paste directly into Claude.ai

If you toggle **Paste directly into Claude.ai when the active tab is claude.ai**
in the extension's options, screenshots taken while you're on claude.ai are
pasted straight into the chat composer instead of going to the clipboard. Off
by default because the common case is "screenshot a different page, then paste
in Claude."

### Opt-in: auto-paste into your terminal (macOS only)

Skip the manual ⌘V entirely. With the helper installed, **Send** activates
your terminal app and pastes the screenshot for you, landing it directly in
Claude Code's prompt.

#### Install the helper (one-time)

```sh
cd host
bash scripts/install.sh
```

The installer needs no Xcode or Swift toolchain. It:
1. Asks for your extension's ID (find it on `chrome://extensions`).
2. Downloads the prebuilt, signed helper from the latest GitHub release and
   verifies its checksum.
3. Copies it to `~/Library/Application Support/claude-shot/claude-shot-host`.
4. Registers the Chrome native-messaging manifest with that ID in your
   `allowed_origins` so only this extension can talk to the helper.

Prefer to build it yourself? Run `bash scripts/install-from-source.sh` instead
(needs the Xcode Command Line Tools).

#### Grant Accessibility

The helper needs Accessibility permission to post a ⌘V keystroke. macOS
prompts the first time you try auto-paste; click through to System Settings →
Privacy & Security → Accessibility and toggle on
`claude-shot-host`. After that, it's automatic.

#### Configure the target

In the extension's Options page, turn on **Auto-paste into a terminal** and
pick the target app (Terminal.app, iTerm2, VS Code, Cursor, Warp, WezTerm,
kitty, Claude Desktop). The options page shows a green dot once it's confirmed
the helper is reachable.

#### Use it

1. Open the page you want to screenshot.
2. Click the claude-shot icon → preview pops up.
3. Click **Send** → claude-shot activates your terminal and pastes. The
   image lands in Claude Code's prompt area; press Enter to send.

If the helper isn't installed or returns an error, the popup transparently
falls back to the regular clipboard path and tells you what happened.

#### Uninstall

```sh
bash host/scripts/uninstall.sh
```

Doesn't touch the Accessibility grant, revoke that yourself in System
Settings if you want a clean slate.

#### Releasing the helper (maintainers)

`install.sh` downloads a prebuilt binary, so a release has to exist. To cut one:

```sh
# optional, for a Developer ID signature + notarization (recommended):
export CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export NOTARY_PROFILE="claude-shot"   # from: xcrun notarytool store-credentials

bash host/scripts/build-release.sh
gh release create host-v1 \
  host/dist/claude-shot-host-macos.zip \
  host/dist/claude-shot-host-macos.zip.sha256
```

`build-release.sh` builds a universal binary when full Xcode is present (Intel +
Apple Silicon), or this Mac's architecture with the Command Line Tools alone. A
Developer ID signature is recommended: it keeps the Accessibility grant stable
across versions. Without it the binary is ad-hoc signed, which still works for
the curl-install path.

### Platform support

| Surface                | Phase 1 (clipboard) | Phase 2 (auto-paste) |
| ---------------------- | ------------------- | -------------------- |
| macOS                  | ✓                   | ✓                    |
| Windows                | ✓                   | Not yet, see below  |
| Linux                  | ✓ (untested)        | Not yet              |

The clipboard path is just the extension, works on any platform Chrome runs
on. The auto-paste path is the Swift native-messaging helper, which uses
macOS-only APIs (`NSPasteboard`, `CGEventPost`, `NSRunningApplication`). A
Windows port would need a separate native binary (Rust or C# is cleanest),
its own installer (PowerShell or .exe), and a different native-messaging
manifest location (Windows registry under
`HKCU\Software\Google\Chrome\NativeMessagingHosts\`). The protocol the
extension speaks is the same, so the extension side wouldn't change much.

### Crop a region

Hit **Crop** in the popup, drag a rectangle, then **Use crop**. Cropping happens
in-browser at the screenshot's native pixel resolution; Send works the same way
afterwards.

## Settings

Open the extension's options (right-click the icon → **Options**) to:

- Toggle the direct-paste-into-Claude.ai behavior on or off
- (Coming) Start in area-select mode when triggered by the hotkey

## Permissions

claude-shot asks for only what it needs:

- `activeTab`, read the page you're on when you invoke the extension, to
  screenshot it
- `scripting`, inject the Claude.ai paste helper into a claude.ai tab
- `storage`, remember your preferences and stash the captured PNG between the
  service worker and the popup
- `downloads`, fallback when the system clipboard refuses the image
- `notifications`, tell you when a capture is blocked (e.g. chrome:// pages)

No `<all_urls>` host permission. Screenshots never leave your device unless you
paste them somewhere yourself.

## What it can't capture

Chrome blocks tab capture on `chrome://` pages, the Chrome Web Store, the new
tab page, and PDF-viewer surfaces. The extension surfaces a notification when
this happens instead of failing silently.

## Roadmap

- **Phase 2:** Opt-in native messaging host (signed, notarized Swift binary)
  that pastes the image straight into the most-recently-active VS Code /
  Terminal / iTerm2 / Claude Desktop window. Eliminates the manual Cmd+V step
  for non-web targets. Requires a one-time install and an Accessibility
  permission grant.
- Annotation tools (arrows, boxes, text).
- Full-page (scrolling) capture.

## Layout

```
extension/
  manifest.json
  background.js              # service worker, capture + stash + command handling
  popup/
    popup.html               # preview UI
    popup.js                 # orchestrator: capture → render → send
    popup.css
    claude-ai-target.js      # picks claude.ai-direct-paste vs clipboard
    clipboard.js             # ClipboardItem write with downloads fallback
    crop.js                  # OffscreenCanvas-based area-select crop
  options/
    options.html / .js / .css
  icons/
    generate.py              # stdlib-only PNG generator for placeholder icons
    icon-16.png / icon-48.png / icon-128.png
```

## Regenerating icons

The toolbar/store icons are rendered from `store-assets/icon.html` (a coral
camera-focus reticle) with headless Chrome, then downscaled with `sips`:

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --force-device-scale-factor=1 \
  --default-background-color=00000000 \
  --screenshot=store-assets/icon-source-512.png --window-size=512,512 \
  "file://$PWD/store-assets/icon.html"
for s in 16 48 128; do
  sips -z $s $s store-assets/icon-source-512.png --out extension/icons/icon-$s.png
done
```

The legacy `extension/icons/generate.py` (pure-stdlib placeholder generator) is
kept for reference but is no longer the source of the shipped icons.
