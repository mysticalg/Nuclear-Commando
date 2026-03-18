#!/usr/bin/env python3
"""
Slice a sprite sheet with dark/transparent background into individual frame PNGs.

Useful for imported retro sheets where frames are already arranged on rows but
not yet cut into separate files.
"""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Slice a sprite sheet into individual sprite frames.")
    parser.add_argument("--source", required=True, help="Path to the source sprite sheet image.")
    parser.add_argument("--out", required=True, help="Output directory for extracted frames.")
    parser.add_argument("--bg-threshold", type=int, default=12, help="RGB threshold below which pixels are treated as background.")
    parser.add_argument("--bg-mode", choices=["dark", "sample"], default="sample", help="Background detection mode.")
    parser.add_argument("--bg-distance", type=int, default=36, help="Max RGB distance from sampled background color to treat as background.")
    parser.add_argument("--grow", type=int, default=1, help="Dilate the foreground mask by this many pixels before component detection.")
    parser.add_argument("--pad", type=int, default=2, help="Padding to add around each extracted frame.")
    parser.add_argument("--min-area", type=int, default=24, help="Minimum bounding-box area to keep.")
    parser.add_argument("--row-tolerance", type=int, default=18, help="Vertical tolerance for grouping frames into rows.")
    return parser.parse_args()


def corner_background_color(src: Image.Image) -> tuple[int, int, int]:
    w, h = src.size
    samples = [
        src.getpixel((0, 0)),
        src.getpixel((w - 1, 0)),
        src.getpixel((0, h - 1)),
        src.getpixel((w - 1, h - 1)),
    ]
    rgb_samples = [(r, g, b) for r, g, b, _ in samples]
    counts: dict[tuple[int, int, int], int] = {}
    for sample in rgb_samples:
        counts[sample] = counts.get(sample, 0) + 1
    return max(counts.items(), key=lambda item: item[1])[0]


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def load_source(path: Path, bg_threshold: int, bg_mode: str, bg_distance: int) -> tuple[Image.Image, Image.Image]:
    src = Image.open(path).convert("RGBA")
    mask = Image.new("L", src.size, 0)
    src_px = src.load()
    mask_px = mask.load()
    w, h = src.size
    bg_color = corner_background_color(src)
    for y in range(h):
        for x in range(w):
            r, g, b, a = src_px[x, y]
            if a <= 8:
                continue
            if bg_mode == "dark":
                if max(r, g, b) <= bg_threshold and (r + g + b) <= bg_threshold * 3:
                    continue
            else:
                if color_distance((r, g, b), bg_color) <= bg_distance:
                    continue
            mask_px[x, y] = 255
    return src, mask


def dilate(mask: Image.Image, grow: int) -> Image.Image:
    result = mask
    for _ in range(max(0, grow)):
        result = result.filter(ImageFilter.MaxFilter(3))
    return result


def connected_boxes(mask: Image.Image, min_area: int) -> list[tuple[int, int, int, int]]:
    w, h = mask.size
    px = mask.load()
    seen = [[False] * w for _ in range(h)]
    boxes: list[tuple[int, int, int, int]] = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or not px[x, y]:
                continue
            q: deque[tuple[int, int]] = deque([(x, y)])
            seen[y][x] = True
            min_x = max_x = x
            min_y = max_y = y
            while q:
                cx, cy = q.popleft()
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny]:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if (max_x - min_x + 1) * (max_y - min_y + 1) >= min_area:
                boxes.append((min_x, min_y, max_x + 1, max_y + 1))
    return boxes


def expand_box(box: tuple[int, int, int, int], pad: int, size: tuple[int, int]) -> tuple[int, int, int, int]:
    w, h = size
    x0, y0, x1, y1 = box
    return (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad))


def row_grouped(boxes: Iterable[tuple[int, int, int, int]], tolerance: int) -> list[dict]:
    ordered = sorted(boxes, key=lambda b: (b[1], b[0]))
    rows: list[dict] = []
    for box in ordered:
        cy = (box[1] + box[3]) * 0.5
        target = None
        for row in rows:
            if abs(cy - row["center_y"]) <= tolerance:
                target = row
                break
        if not target:
            target = {"center_y": cy, "boxes": []}
            rows.append(target)
        target["boxes"].append(box)
        target["center_y"] = sum((b[1] + b[3]) * 0.5 for b in target["boxes"]) / len(target["boxes"])
    for row in rows:
        row["boxes"].sort(key=lambda b: b[0])
    rows.sort(key=lambda row: row["center_y"])
    return rows


def save_transparent_crop(src: Image.Image, base_mask: Image.Image, box: tuple[int, int, int, int], dest: Path) -> None:
    crop = src.crop(box).copy()
    crop_mask = base_mask.crop(box)
    crop_px = crop.load()
    mask_px = crop_mask.load()
    w, h = crop.size
    for y in range(h):
        for x in range(w):
            if not mask_px[x, y]:
                crop_px[x, y] = (0, 0, 0, 0)
    crop.save(dest, format="PNG")


def build_contact_sheet(frames: list[Path], out_path: Path) -> None:
    if not frames:
        return
    images = [Image.open(path).convert("RGBA") for path in frames]
    max_w = max(im.width for im in images)
    max_h = max(im.height for im in images)
    cols = min(8, max(1, int(len(images) ** 0.5) + 1))
    rows = (len(images) + cols - 1) // cols
    tile_w = max_w + 24
    tile_h = max_h + 28
    sheet = Image.new("RGBA", (cols * tile_w, rows * tile_h), (8, 10, 16, 255))
    draw = ImageDraw.Draw(sheet)
    for idx, im in enumerate(images):
        col = idx % cols
        row = idx // cols
        x = col * tile_w + 10 + (max_w - im.width) // 2
        y = row * tile_h + 8 + (max_h - im.height) // 2
        sheet.alpha_composite(im, (x, y))
        draw.text((col * tile_w + 6, row * tile_h + tile_h - 16), str(idx), fill=(240, 240, 240, 255))
    sheet.save(out_path, format="PNG")


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    src, base_mask = load_source(source, args.bg_threshold, args.bg_mode, args.bg_distance)
    work_mask = dilate(base_mask, args.grow)
    boxes = [expand_box(box, args.pad, src.size) for box in connected_boxes(work_mask, args.min_area)]
    rows = row_grouped(boxes, args.row_tolerance)

    manifest = {
        "source": str(source),
        "size": list(src.size),
        "frame_count": sum(len(row["boxes"]) for row in rows),
        "rows": [],
    }
    saved: list[Path] = []
    frame_index = 0
    for row_index, row in enumerate(rows):
        row_entry = {"row": row_index, "frames": []}
        for col_index, box in enumerate(row["boxes"]):
            frame_name = f"frame_{frame_index:03d}.png"
            dest = out_dir / frame_name
            save_transparent_crop(src, base_mask, box, dest)
            row_entry["frames"].append({
                "index": frame_index,
                "row_index": row_index,
                "column_index": col_index,
                "file": frame_name,
                "box": list(box),
            })
            saved.append(dest)
            frame_index += 1
        manifest["rows"].append(row_entry)

    manifest_path = out_dir / "frames.json"
    manifest_path.write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")
    build_contact_sheet(saved, out_dir / "contact_sheet.png")

    print(f"Source: {source}")
    print(f"Frames detected: {manifest['frame_count']}")
    print(f"Rows detected: {len(manifest['rows'])}")
    print(f"Output: {out_dir}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
