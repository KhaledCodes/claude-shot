#!/usr/bin/env bash
# Maintainer script: build a distributable claude-shot helper.
#
# Produces a universal (arm64 + x86_64) release binary, code-signs it, optionally
# notarizes it, and zips it with a checksum for a GitHub Release. End users then
# install it with install.sh, which downloads this artifact, so they need no
# Xcode or Swift toolchain.
#
# Signing (recommended):
#   export CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"
#     Signs with your Developer ID. Keeps the Accessibility grant stable across
#     versions and passes Gatekeeper even if the file is ever quarantined.
#   Leave it unset for an ad-hoc signature (fine for the curl-install path, but
#     the Accessibility grant resets on each new release).
#
# Notarization (only meaningful with a Developer ID signature):
#   export NOTARY_PROFILE="claude-shot"   # from: xcrun notarytool store-credentials
#     When set (together with CODESIGN_IDENTITY) the zip is submitted and waited on.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$HOST_ROOT"

DIST="$HOST_ROOT/dist"
BIN_NAME="claude-shot-host"
ZIP_NAME="claude-shot-host-macos.zip"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
gray() { printf "\033[2m%s\033[0m\n" "$*"; }

# A universal (arm64 + x86_64) build needs the Xcode build system (xcbuild),
# which ships with full Xcode, not the Command Line Tools alone. Try it; if it's
# unavailable, fall back to a build for this Mac's architecture only.
bold "Building release binary…"
if swift build -c release --arch arm64 --arch x86_64 >/dev/null 2>&1; then
  BUILT="$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)/ClaudeShotHost"
  green "  ✓ universal (arm64 + x86_64)"
else
  gray "  Universal build needs full Xcode; building for this Mac's architecture only."
  gray "  (Install Xcode and re-run for a universal binary that also covers Intel Macs.)"
  swift build -c release
  BUILT="$(swift build -c release --show-bin-path)/ClaudeShotHost"
fi
if [ ! -f "$BUILT" ]; then
  echo "Build succeeded but binary wasn't found at: $BUILT" >&2
  exit 1
fi

mkdir -p "$DIST"
cp "$BUILT" "$DIST/$BIN_NAME"
chmod +x "$DIST/$BIN_NAME"
gray "  archs: $(lipo -archs "$DIST/$BIN_NAME" 2>/dev/null || echo "unknown")"

# Code sign.
if [ -n "${CODESIGN_IDENTITY:-}" ]; then
  bold "Signing with Developer ID: $CODESIGN_IDENTITY"
  codesign --force --options runtime --timestamp \
    --identifier com.claudeshot.host --sign "$CODESIGN_IDENTITY" "$DIST/$BIN_NAME"
else
  bold "Ad-hoc signing (set CODESIGN_IDENTITY for a Developer ID signature)…"
  codesign --force --identifier com.claudeshot.host --sign - "$DIST/$BIN_NAME"
fi
codesign --verify --verbose "$DIST/$BIN_NAME" 2>&1 | sed 's/^/  /' || true

# Zip the bare binary.
( cd "$DIST" && rm -f "$ZIP_NAME" && /usr/bin/zip -q "$ZIP_NAME" "$BIN_NAME" )

# Notarize (optional; bare CLI binaries can't be stapled, the ticket is checked online).
if [ -n "${CODESIGN_IDENTITY:-}" ] && [ -n "${NOTARY_PROFILE:-}" ]; then
  bold "Notarizing $ZIP_NAME…"
  xcrun notarytool submit "$DIST/$ZIP_NAME" --keychain-profile "$NOTARY_PROFILE" --wait
else
  gray "  Skipping notarization (set CODESIGN_IDENTITY + NOTARY_PROFILE to enable)."
fi

# Checksum.
( cd "$DIST" && shasum -a 256 "$ZIP_NAME" > "$ZIP_NAME.sha256" )

green "Done."
echo "Artifacts in host/dist:"
echo "  $ZIP_NAME"
echo "  $ZIP_NAME.sha256"
echo
echo "Upload both as assets on a GitHub release, e.g.:"
echo "  gh release create host-v1 host/dist/$ZIP_NAME host/dist/$ZIP_NAME.sha256 \\"
echo "    --title 'Claude Shot helper' --notes 'macOS native helper (universal).'"
