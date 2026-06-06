#!/usr/bin/env python3
"""Generate placeholder claude-shot icons (16/48/128) with stdlib only.

A solid rounded square in Claude's orange with a small camera-aperture mark.
PIL is not required; we hand-roll a minimal PNG writer using zlib + struct.
Run from the icons/ directory: `python3 generate.py`.
"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ACCENT = (217, 119, 87, 255)   # #d97757
DARK   = (28, 18, 9, 255)      # mark
TRANSP = (0, 0, 0, 0)

def write_png(path: Path, pixels: list[list[tuple[int, int, int, int]]]):
    h = len(pixels)
    w = len(pixels[0])
    raw = b""
    for row in pixels:
        raw += b"\x00"  # filter type 0
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(raw, 9)
    path.write_bytes(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))

def rounded_square(size: int) -> list[list[tuple[int, int, int, int]]]:
    radius = max(2, size // 6)
    inset = max(1, size // 16)
    aperture_r = max(1, size // 4)
    cx, cy = size / 2, size / 2
    px = [[TRANSP] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            # Rounded-square test
            xi = x - inset
            yi = y - inset
            w = size - 2 * inset
            if not (0 <= xi < w and 0 <= yi < w):
                continue
            cx2 = w / 2
            cy2 = w / 2
            dx = abs(xi - cx2) - (cx2 - radius)
            dy = abs(yi - cy2) - (cy2 - radius)
            outside = max(dx, 0) ** 2 + max(dy, 0) ** 2 > radius ** 2
            if outside and (dx > 0 and dy > 0):
                continue
            px[y][x] = ACCENT
            # Aperture: small dark filled circle slightly offset
            r2 = (x - cx) ** 2 + (y - cy) ** 2
            if r2 <= aperture_r ** 2 and r2 >= (aperture_r - max(1, size // 16)) ** 2:
                px[y][x] = DARK
            if r2 <= (aperture_r // 3) ** 2:
                px[y][x] = DARK
    return px

def main():
    here = Path(__file__).resolve().parent
    for size in (16, 48, 128):
        out = here / f"icon-{size}.png"
        write_png(out, rounded_square(size))
        print(f"wrote {out}")

if __name__ == "__main__":
    main()
