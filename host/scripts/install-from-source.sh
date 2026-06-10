#!/usr/bin/env bash
# claude-shot helper installer (BUILD FROM SOURCE).
#
# Most people should use install.sh instead, which downloads a prebuilt binary
# and needs no toolchain. Use this if you want to build locally (a contributor,
# or an architecture with no prebuilt release). Requires Xcode Command Line Tools.
#
# Builds the Swift host, copies it into ~/Library/Application Support/claude-shot,
# writes the Chrome native-messaging manifest, and prints next steps.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$HOST_ROOT"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }
gray() { printf "\033[2m%s\033[0m\n" "$*"; }

bold "claude-shot helper installer"
echo

# 1. Xcode CLI tools
if ! xcode-select -p >/dev/null 2>&1; then
  red "Xcode Command Line Tools are required to build the helper."
  echo "Install them with:"
  echo "    xcode-select --install"
  echo "Then re-run this script."
  exit 1
fi

# 2. Extension ID
bold "Step 1 of 3: get your extension's ID"
gray "  1. Open chrome://extensions in Chrome"
gray "  2. Turn on Developer mode (top-right) if it isn't already"
gray "  3. Find the claude-shot card and copy its ID, a 32-letter string"
echo
read -r -p "Paste extension ID: " EXT_ID
if ! [[ "$EXT_ID" =~ ^[a-p]{32}$ ]]; then
  red "That doesn't look like a valid Chrome extension ID."
  echo "Expected 32 lowercase letters in the range a–p. Got: '$EXT_ID'"
  exit 1
fi
echo

# 3. Build
bold "Step 2 of 3: building the helper"
gray "  swift build -c release  (10–40 seconds on first run)"
swift build -c release
BUILD_BIN="$(swift build -c release --show-bin-path)/ClaudeShotHost"
if [ ! -f "$BUILD_BIN" ]; then
  red "Build succeeded but binary wasn't found at:"
  echo "  $BUILD_BIN"
  exit 1
fi

INSTALL_DIR="$HOME/Library/Application Support/claude-shot"
INSTALL_BIN="$INSTALL_DIR/claude-shot-host"
mkdir -p "$INSTALL_DIR"
cp "$BUILD_BIN" "$INSTALL_BIN"
chmod +x "$INSTALL_BIN"
# Ad-hoc codesign with a stable identifier. Doesn't fully prevent TCC from
# asking to re-grant on rebuild (cdhash still changes), but gives macOS a
# consistent name to associate with the entry instead of an opaque path.
codesign --sign - --force --identifier com.claudeshot.host "$INSTALL_BIN" >/dev/null 2>&1 || true
green "  ✓ Helper binary installed at $INSTALL_BIN"

# 4. Native messaging manifests, drop into every Chromium-family browser
# we recognise, so the helper works in whichever browser actually hosts the
# extension. Each browser keeps its own NativeMessagingHosts directory.
declare -a BROWSER_DIRS=(
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
  "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
  "$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"
)
MANIFEST_NAME="com.claudeshot.host.json"
MANIFEST_CONTENT=$(cat <<JSON
{
  "name": "com.claudeshot.host",
  "description": "claude-shot helper for auto-pasting screenshots into terminals",
  "path": "$INSTALL_BIN",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
JSON
)

INSTALLED_COUNT=0
for parent in "${BROWSER_DIRS[@]}"; do
  parent_root="$(dirname "$parent")"
  if [ -d "$parent_root" ]; then
    mkdir -p "$parent"
    printf '%s\n' "$MANIFEST_CONTENT" > "$parent/$MANIFEST_NAME"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    gray "  ✓ Registered in $parent"
  fi
done
if [ "$INSTALLED_COUNT" -eq 0 ]; then
  red "Couldn't find any Chromium-family browser data directory."
  echo "If you're using a less common Chromium fork, drop this file manually:"
  echo
  echo "  $MANIFEST_NAME (path varies per browser)"
  echo "  contents:"
  echo "$MANIFEST_CONTENT"
  exit 1
fi
green "  ✓ Native messaging manifest written ($INSTALLED_COUNT browser(s))"
echo

# 5. Accessibility, open the right Settings pane and explain.
bold "Step 3 of 3: grant Accessibility permission"
gray "  The helper needs Accessibility to post a ⌘V keystroke into your"
gray "  terminal. macOS *sometimes* prompts on first auto-paste, but for"
gray "  native-messaging subprocesses the prompt is unreliable, so we'll"
gray "  open the right Settings pane now and you can grant it up front."
echo
echo "In the System Settings panel that's about to open:"
echo "  1. Click the +  button under the Accessibility list"
echo "  2. Press ⌘⇧G (Go to folder) and paste:"
echo "       $INSTALL_DIR"
echo "  3. Pick claude-shot-host and click Open"
echo "  4. Toggle the new row on"
echo
echo "Tip: you can also drag this path into the + dialog:"
echo "  $INSTALL_BIN"
echo
sleep 1
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility" || true

echo
green "Install complete."
echo
echo "Next:"
echo "  1. In the claude-shot extension's options, turn on"
echo "     'Auto-paste into a terminal' and pick your target app."
echo "  2. Try it. If you skipped the Accessibility step above, claude-shot"
echo "     will surface a clear error the first time you click Send."
