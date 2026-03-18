#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from statistics import median

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean up generated Forge sprite PNGs.")
    parser.add_argument("--dir", default="assets/sprites/generated_forge", help="Directory containing PNGs to postprocess.")
    parser.add_argument("--threshold", type=int, default=90, help="Border-background color distance threshold.")
    parser.add_argument("--min-area", type=int, default=48, help="Minimum component area to consider.")
    return parser.parse_args()


def border_color(img: Image.Image) -> tuple[int, int, int]:
    px = img.load()
    w, h = img.size
    samples = []
    for x in range(w):
        samples.append(px[x, 0][:3])
        samples.append(px[x, h - 1][:3])
    for y in range(h):
        samples.append(px[0, y][:3])
        samples.append(px[w - 1, y][:3])
    rs = [c[0] for c in samples]
    gs = [c[1] for c in samples]
    bs = [c[2] for c in samples]
    return (int(median(rs)), int(median(gs)), int(median(bs)))


def dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def infer_kind(file_name: str) -> str:
    if file_name.startswith("player_") or file_name.startswith("enemy_trooper") or file_name.startswith("enemy_mech"):
        return "character"
    if file_name.startswith("objective_"):
        return "objective"
    if file_name.startswith("pickup_") or file_name.startswith("fx_"):
        return "icon"
    return "object"


def build_background_mask(img: Image.Image, bg: tuple[int, int, int], threshold: int) -> bytearray:
    px = img.load()
    w, h = img.size
    mask = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def eligible(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a <= 8:
            return True
        return dist((r, g, b), bg) <= threshold

    def mark(x: int, y: int) -> None:
        idx = y * w + x
        if mask[idx]:
            return
        if not eligible(x, y):
            return
        mask[idx] = 1
        q.append((x, y))

    for x in range(w):
        mark(x, 0)
        mark(x, h - 1)
    for y in range(h):
        mark(0, y)
        mark(w - 1, y)

    while q:
        x, y = q.popleft()
        if x > 0:
            mark(x - 1, y)
        if x + 1 < w:
            mark(x + 1, y)
        if y > 0:
            mark(x, y - 1)
        if y + 1 < h:
            mark(x, y + 1)

    return mask


def component_score(comp: dict, w: int, h: int, kind: str) -> float:
    cx = (comp["minx"] + comp["maxx"]) * 0.5
    cy = (comp["miny"] + comp["maxy"]) * 0.5
    dx = abs(cx - (w * 0.5)) / max(1.0, w * 0.5)
    dy = abs(cy - (h * 0.5)) / max(1.0, h * 0.5)
    bw = max(1, comp["maxx"] - comp["minx"] + 1)
    bh = max(1, comp["maxy"] - comp["miny"] + 1)
    aspect = bh / bw
    center = max(0.25, 1.55 - (dx * 0.95 + dy * 1.25))
    shape = 1.0
    if kind == "character":
        shape += min(1.3, max(0.0, aspect - 0.7)) * 0.55
    elif kind == "objective":
        shape += 0.35 if 0.45 <= aspect <= 1.65 else 0.0
    elif kind == "icon":
        shape += 0.4 if 0.65 <= aspect <= 1.4 else 0.0
        center *= 1.2
    return comp["area"] * center * shape


def intersects(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    return not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1])


def choose_components(img: Image.Image, bg_mask: bytearray, min_area: int, kind: str) -> list[dict]:
    px = img.load()
    w, h = img.size
    seen = bytearray(w * h)
    components: list[dict] = []

    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if seen[idx] or bg_mask[idx]:
                continue
            if px[x, y][3] <= 12:
                seen[idx] = 1
                continue

            q: deque[tuple[int, int]] = deque([(x, y)])
            seen[idx] = 1
            pixels: list[tuple[int, int]] = []
            minx = maxx = x
            miny = maxy = y

            while q:
                cx, cy = q.popleft()
                pixels.append((cx, cy))
                minx = min(minx, cx)
                miny = min(miny, cy)
                maxx = max(maxx, cx)
                maxy = max(maxy, cy)

                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nidx = ny * w + nx
                    if seen[nidx] or bg_mask[nidx]:
                        continue
                    if px[nx, ny][3] <= 12:
                        seen[nidx] = 1
                        continue
                    seen[nidx] = 1
                    q.append((nx, ny))

            if len(pixels) >= min_area:
                components.append({
                    "pixels": pixels,
                    "area": len(pixels),
                    "minx": minx,
                    "miny": miny,
                    "maxx": maxx,
                    "maxy": maxy,
                })

    if not components:
        return []

    best = max(components, key=lambda comp: component_score(comp, w, h, kind))
    pad_ratio = 0.07 if kind == "character" else 0.11
    pad = int(max(best["maxx"] - best["minx"], best["maxy"] - best["miny"]) * pad_ratio) + 4
    focus = (
        max(0, best["minx"] - pad),
        max(0, best["miny"] - pad),
        min(w - 1, best["maxx"] + pad),
        min(h - 1, best["maxy"] + pad),
    )

    picked = []
    for comp in components:
        bbox = (comp["minx"], comp["miny"], comp["maxx"], comp["maxy"])
        center = ((comp["minx"] + comp["maxx"]) * 0.5, (comp["miny"] + comp["maxy"]) * 0.5)
        center_inside = focus[0] <= center[0] <= focus[2] and focus[1] <= center[1] <= focus[3]
        large_enough = comp["area"] >= max(min_area, int(best["area"] * 0.035))
        if large_enough and (intersects(bbox, focus) or center_inside):
            picked.append(comp)

    return picked or [best]


def render_crop(img: Image.Image, components: list[dict]) -> Image.Image:
    minx = min(comp["minx"] for comp in components)
    miny = min(comp["miny"] for comp in components)
    maxx = max(comp["maxx"] for comp in components)
    maxy = max(comp["maxy"] for comp in components)
    margin = 4
    minx = max(0, minx - margin)
    miny = max(0, miny - margin)
    maxx = min(img.width - 1, maxx + margin)
    maxy = min(img.height - 1, maxy + margin)

    out = Image.new("RGBA", (maxx - minx + 1, maxy - miny + 1), (0, 0, 0, 0))
    src = img.load()
    dst = out.load()

    for comp in components:
        for x, y in comp["pixels"]:
            dx = x - minx
            dy = y - miny
            dst[dx, dy] = src[x, y]

    return out


def process_file(file_path: Path, threshold: int, min_area: int) -> bool:
    img = Image.open(file_path).convert("RGBA")
    kind = infer_kind(file_path.stem)
    bg = border_color(img)
    bg_mask = build_background_mask(img, bg, threshold)
    components = choose_components(img, bg_mask, min_area, kind)
    if not components:
        return False
    crop = render_crop(img, components)
    crop.save(file_path)
    return True


def main() -> None:
    args = parse_args()
    root = Path(args.dir)
    files = sorted(p for p in root.glob("*.png") if p.is_file())
    processed = 0
    skipped = 0
    for file_path in files:
        if process_file(file_path, args.threshold, args.min_area):
            processed += 1
        else:
            skipped += 1
    print(f"Postprocessed: {processed}")
    print(f"Skipped: {skipped}")


if __name__ == "__main__":
    main()
