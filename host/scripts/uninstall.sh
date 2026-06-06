#!/usr/bin/env bash
# Removes the claude-shot helper binary and native-messaging manifests.
# Does NOT remove the Accessibility grant — you can revoke that yourself in
# System Settings → Privacy & Security → Accessibility.
set -euo pipefail

INSTALL_DIR="$HOME/Library/Application Support/claude-shot"
MANIFEST_NAME="com.claudeshot.host.json"

declare -a BROWSER_DIRS=(
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
  "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
  "$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"
)

removed_any=0
for dir in "${BROWSER_DIRS[@]}"; do
  if [ -f "$dir/$MANIFEST_NAME" ]; then
    rm -f "$dir/$MANIFEST_NAME"
    echo "  ✓ Removed $dir/$MANIFEST_NAME"
    removed_any=1
  fi
done

if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo "  ✓ Removed $INSTALL_DIR"
  removed_any=1
fi

if [ "$removed_any" -eq 0 ]; then
  echo "Nothing to remove — looks like claude-shot helper isn't installed."
else
  echo
  echo "Done. If you'd like to fully revoke permissions, also remove the"
  echo "claude-shot-host entry under System Settings → Privacy & Security →"
  echo "Accessibility."
fi
