#!/usr/bin/env python3
"""Prepare generated clay art for the web app.

- characters: flood-fill the near-uniform light background to alpha, trim,
  normalise height, save as assets/char-*.png
- map: keep colour as-is, optimise, save as assets/showroom-map.png
"""
import glob
import os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
RAW = os.path.join(ASSETS, "_raw")

CHAR_HEIGHT = 420          # stored height for characters
CHAR_TOL = 30              # colour distance counted as background
CHAR_NAMES = ["scarlet", "crown", "cinderella", "redhood", "dorothy"]


def bg_mask(rgb, tol):
    h, w, _ = rgb.shape
    border = np.concatenate([
        rgb[0:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3),
        rgb[:, 0:4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3),
    ])
    ref = np.median(border, axis=0)
    cand = np.abs(rgb - ref).sum(axis=2) < tol
    mask = np.zeros((h, w), dtype=bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not mask[y, x]:
                mask[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not mask[y, x]:
                mask[y, x] = True
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True
                dq.append((ny, nx))
    return mask


def cutout(src, dst):
    im = Image.open(src).convert("RGB")
    rgb = np.asarray(im).astype(np.int16)
    mask = bg_mask(rgb, CHAR_TOL)
    alpha = np.where(mask, 0, 255).astype(np.uint8)
    alpha_im = Image.fromarray(alpha, "L")
    alpha_im = alpha_im.filter(ImageFilter.MinFilter(3))     # eat the white fringe
    alpha_im = alpha_im.filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert("RGBA")
    out.putalpha(alpha_im)

    a = np.asarray(alpha_im)
    ys, xs = np.where(a > 8)
    if len(ys):
        box = (max(xs.min() - 6, 0), max(ys.min() - 6, 0),
               min(xs.max() + 7, out.width), min(ys.max() + 7, out.height))
        out = out.crop(box)

    scale = CHAR_HEIGHT / out.height
    if scale < 1:
        out = out.resize((max(1, round(out.width * scale)), CHAR_HEIGHT), Image.LANCZOS)
    out.save(dst, optimize=True)
    return out.size


def main():
    for key in CHAR_NAMES:
        src = os.path.join(RAW, f"char-{key}.png")
        dst = os.path.join(ASSETS, f"char-{key}.png")
        size = cutout(src, dst)
        print(f"char-{key}: {size} -> {os.path.getsize(dst)//1024}KB")

    src = os.path.join(RAW, "showroom-map-cream.png")
    dst = os.path.join(ASSETS, "showroom-map.png")
    m = Image.open(src).convert("RGB")
    if m.width > 1600:
        m = m.resize((1600, round(m.height * 1600 / m.width)), Image.LANCZOS)
    # the clay art quantises cleanly to 256 colours and drops ~2.2MB to ~0.7MB
    m.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(dst, optimize=True)
    print(f"showroom-map: {m.size} -> {os.path.getsize(dst)//1024}KB")


if __name__ == "__main__":
    main()
