#!/usr/bin/env bash
# claude-shot helper installer (prebuilt binary, no Xcode/Swift needed).
#
# Downloads the prebuilt macOS helper from the latest GitHub release, installs it
# into ~/Library/Application Support/claude-shot, registers the Chrome
# native-messaging manifest, and opens the Accessibility pane.
#
# The published Chrome Web Store ID is baked in, so store users need nothing.
# Testing an unpacked (dev) build with a different ID? Pass it as an argument:
#     bash install.sh <your-dev-extension-id>
# and it's added alongside the published ID in allowed_origins.
#
# Building locally instead? Use install-from-source.sh.
set -euo pipefail

REPO="KhaledCodes/claude-shot"
ASSET="claude-shot-host-macos.zip"
PUBLISHED_ID="omfglkencdaogkejhbgckigiiakkbjlg"
DEV_ID="${1:-}"
INSTALL_DIR="$HOME/Library/Application Support/claude-shot"
INSTALL_BIN="$INSTALL_DIR/claude-shot-host"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }
gray() { printf "\033[2m%s\033[0m\n" "$*"; }

bold "claude-shot helper installer"
echo

if [ -n "$DEV_ID" ] && ! [[ "$DEV_ID" =~ ^[a-p]{32}$ ]]; then
  red "That dev extension ID doesn't look valid (expected 32 letters a-p)."
  exit 1
fi

# 1. Download the prebuilt binary from the latest release.
bold "Step 1 of 3: downloading the helper"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
API="https://api.github.com/repos/$REPO/releases/latest"
RELEASE_JSON="$(curl -fsSL "$API" || true)"
URL="$(printf '%s' "$RELEASE_JSON" | grep -o "https://[^\"]*/$ASSET" | head -1 || true)"
SUMURL="$(printf '%s' "$RELEASE_JSON" | grep -o "https://[^\"]*/$ASSET.sha256" | head -1 || true)"
if [ -z "$URL" ]; then
  red "Couldn't find $ASSET in the latest release of $REPO."
  echo "Check https://github.com/$REPO/releases, or build locally with install-from-source.sh"
  exit 1
fi
curl -fsSL "$URL" -o "$TMP/$ASSET"
gray "  ✓ downloaded $ASSET"

if [ -n "$SUMURL" ]; then
  curl -fsSL "$SUMURL" -o "$TMP/$ASSET.sha256"
  if ( cd "$TMP" && shasum -a 256 -c "$ASSET.sha256" >/dev/null 2>&1 ); then
    gray "  ✓ checksum verified"
  else
    red "Checksum verification failed, refusing to install."
    exit 1
  fi
else
  gray "  (no checksum published for this release; skipping verification)"
fi

unzip -oq "$TMP/$ASSET" -d "$TMP"
if [ ! -f "$TMP/claude-shot-host" ]; then
  red "Downloaded archive didn't contain claude-shot-host."
  exit 1
fi

mkdir -p "$INSTALL_DIR"
cp "$TMP/claude-shot-host" "$INSTALL_BIN"
chmod +x "$INSTALL_BIN"
xattr -dr com.apple.quarantine "$INSTALL_BIN" 2>/dev/null || true
green "  ✓ Helper installed at $INSTALL_BIN"

# 2. Register the native-messaging manifest (published ID, plus a dev ID if given).
bold "Step 2 of 3: registering with your browser(s)"
ORIGINS="\"chrome-extension://$PUBLISHED_ID/\""
if [ -n "$DEV_ID" ]; then
  ORIGINS="$ORIGINS, \"chrome-extension://$DEV_ID/\""
  gray "  including dev ID $DEV_ID"
fi
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
  "allowed_origins": [$ORIGINS]
}
JSON
)
INSTALLED_COUNT=0
for parent in "${BROWSER_DIRS[@]}"; do
  if [ -d "$(dirname "$parent")" ]; then
    mkdir -p "$parent"
    printf '%s\n' "$MANIFEST_CONTENT" > "$parent/$MANIFEST_NAME"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    gray "  ✓ $parent"
  fi
done
if [ "$INSTALLED_COUNT" -eq 0 ]; then
  red "Couldn't find any Chromium-family browser data directory."
  exit 1
fi
echo

# 3. Accessibility.
bold "Step 3 of 3: grant Accessibility"
gray "  The helper needs Accessibility to post a ⌘V keystroke into your terminal."
echo "In the System Settings panel that's about to open:"
echo "  1. Click the +  under the Accessibility list"
echo "  2. Press ⌘⇧G and paste:  $INSTALL_DIR"
echo "  3. Pick claude-shot-host and click Open, then toggle it on"
echo
sleep 1
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility" || true

echo
green "Install complete."
echo "Claude Shot's 'Auto-paste into a terminal' is on by default; pick your target app in its options."
