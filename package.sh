#!/usr/bin/env bash
# Builds a Chrome Web Store upload zip from extension/.
# The zip places manifest.json at its root (required by the Web Store) and
# excludes dev-only files (icon generator, OS junk). Output is named with the
# manifest version so you always know which build a zip is.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/extension"
DIST="$ROOT/dist"

VERSION="$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$SRC/manifest.json" | grep -o '[0-9][0-9.]*')"
OUT="$DIST/claude-shot-$VERSION.zip"

mkdir -p "$DIST"
rm -f "$OUT"

# Zip from inside extension/ so manifest.json lands at the archive root.
( cd "$SRC" && zip -r -X "$OUT" . \
    -x '*.DS_Store' \
    -x 'icons/generate.py' \
    -x '__MACOSX/*' >/dev/null )

echo "Built $OUT"
unzip -l "$OUT"
