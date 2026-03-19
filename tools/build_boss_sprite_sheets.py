#!/usr/bin/env python3
"""
Build boss/miniboss sprite strips from the imported boss atlas pages.

There are two input types:
- Clean black-background multi-boss source art, which slices cleanly.
- Showcase atlas pages, which need panel-aware manual crop regions.

The output is a set of 160x160 PNG strips that feed the existing
`import_png_sprite_sheets.py` pipeline.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image

FRAME = 160
SLICE_SOURCE_IMAGE = "assets/sprites/b18a73cc-f03f-4167-afef-fcb5df893387.png"
SLICE_OUT = "output/slice-b18-boss-source"
DEFAULT_SHEET_DIR = "assets/sprites/sheets/png16"
DEFAULT_SHEET_MANIFEST = "assets/sprites/sheets/png16/sheet_manifest.json"

SLICE_PACKS = [
    {
        "base": "enemy_mech_crawler_idle",
        "file": "enemy_mech_crawler_idle_sheet.png",
        "indices": [13, 14, 13, 14],
        "fit_w": 134,
        "fit_h": 94,
        "bottom": 150,
    },
    {
        "base": "enemy_mech_crawler_walk",
        "file": "enemy_mech_crawler_walk_sheet.png",
        "indices": [13, 14, 13, 14],
        "fit_w": 134,
        "fit_h": 94,
        "bottom": 150,
    },
    {
        "base": "enemy_mech_crawler_attack",
        "file": "enemy_mech_crawler_attack_sheet.png",
        "indices": [12, 14, 12, 14],
        "fit_w": 138,
        "fit_h": 102,
        "bottom": 150,
    },
    {
        "base": "enemy_boss_giantskull_idle",
        "file": "enemy_boss_giantskull_idle_sheet.png",
        "indices": [0, 0],
        "fit_w": 146,
        "fit_h": 116,
        "bottom": 150,
    },
    {
        "base": "enemy_boss_giantskull_walk",
        "file": "enemy_boss_giantskull_walk_sheet.png",
        "indices": [0, 2, 0, 2],
        "fit_w": 146,
        "fit_h": 116,
        "bottom": 150,
    },
    {
        "base": "enemy_boss_giantskull_attack",
        "file": "enemy_boss_giantskull_attack_sheet.png",
        "indices": [2, 2],
        "fit_w": 150,
        "fit_h": 118,
        "bottom": 150,
    },
    {
        "base": "enemy_boss_cyberbrute_idle",
        "file": "enemy_boss_cyberbrute_idle_sheet.png",
        "indices": [50, 51],
        "fit_w": 128,
        "fit_h": 136,
        "bottom": 152,
    },
    {
        "base": "enemy_boss_cyberbrute_walk",
        "file": "enemy_boss_cyberbrute_walk_sheet.png",
        "indices": [50, 51, 50, 51],
        "fit_w": 128,
        "fit_h": 136,
        "bottom": 152,
    },
    {
        "base": "enemy_boss_cyberbrute_attack",
        "file": "enemy_boss_cyberbrute_attack_sheet.png",
        "indices": [51, 50],
        "fit_w": 132,
        "fit_h": 138,
        "bottom": 152,
    },
    {
        "base": "enemy_boss_demonspider_idle",
        "file": "enemy_boss_demonspider_idle_sheet.png",
        "indices": [34, 35],
        "fit_w": 148,
        "fit_h": 110,
        "bottom": 150,
    },
    {
        "base": "enemy_boss_demonspider_walk",
        "file": "enemy_boss_demonspider_walk_sheet.png",
        "indices": [34, 35, 34, 35],
        "fit_w": 148,
        "fit_h": 110,
        "bottom": 150,
    },
    {
        "base": "enemy_boss_demonspider_attack",
        "file": "enemy_boss_demonspider_attack_sheet.png",
        "indices": [35, 34],
        "fit_w": 150,
        "fit_h": 112,
        "bottom": 150,
    },
]

MANUAL_PACKS = [
    {
        "base": "enemy_boss_ironskull_idle",
        "file": "enemy_boss_ironskull_idle_sheet.png",
        "image": "assets/sprites/2c75dceb-7d63-4a59-a2d7-c3b1e27ebf8b.png",
        "region": [15, 145, 425, 245],
        "cells": 4,
        "fit_w": 132,
        "fit_h": 140,
        "bottom": 152,
        "bg_xy": [2, 2],
        "bg_distance": 22,
        "global_bg_distance": 18,
    },
    {
        "base": "enemy_boss_ironskull_walk",
        "file": "enemy_boss_ironskull_walk_sheet.png",
        "image": "assets/sprites/2c75dceb-7d63-4a59-a2d7-c3b1e27ebf8b.png",
        "region": [438, 145, 1078, 245],
        "cells": 6,
        "fit_w": 132,
        "fit_h": 142,
        "bottom": 152,
        "bg_xy": [2, 2],
        "bg_distance": 22,
        "global_bg_distance": 18,
    },
    {
        "base": "enemy_boss_ironskull_attack",
        "file": "enemy_boss_ironskull_attack_sheet.png",
        "image": "assets/sprites/2c75dceb-7d63-4a59-a2d7-c3b1e27ebf8b.png",
        "region": [600, 304, 1215, 392],
        "cells": 6,
        "fit_w": 140,
        "fit_h": 142,
        "bottom": 152,
        "bg_xy": [2, 2],
        "bg_distance": 22,
        "global_bg_distance": 18,
    },
    {
        "base": "enemy_boss_skulltank_idle",
        "file": "enemy_boss_skulltank_idle_sheet.png",
        "image": "assets/sprites/4151960d-4421-4b5f-8b77-7b412d7eaadd.png",
        "region": [100, 214, 424, 340],
        "cells": 2,
        "fit_w": 146,
        "fit_h": 104,
        "bottom": 150,
        "bg_xy": [3, 3],
        "bg_distance": 32,
        "dark_threshold": 55,
        "trim": [0, 8, 0, 0],
    },
    {
        "base": "enemy_boss_skulltank_walk",
        "file": "enemy_boss_skulltank_walk_sheet.png",
        "image": "assets/sprites/4151960d-4421-4b5f-8b77-7b412d7eaadd.png",
        "region": [520, 214, 931, 340],
        "cells": 4,
        "fit_w": 146,
        "fit_h": 104,
        "bottom": 150,
        "bg_xy": [3, 3],
        "bg_distance": 32,
        "dark_threshold": 55,
        "trim": [0, 8, 0, 0],
    },
    {
        "base": "enemy_boss_skulltank_attack",
        "file": "enemy_boss_skulltank_attack_sheet.png",
        "image": "assets/sprites/4151960d-4421-4b5f-8b77-7b412d7eaadd.png",
        "region": [1080, 214, 1418, 340],
        "cells": 3,
        "fit_w": 148,
        "fit_h": 106,
        "bottom": 150,
        "bg_xy": [3, 3],
        "bg_distance": 32,
        "dark_threshold": 55,
        "trim": [0, 8, 0, 0],
    },
    {
        "base": "enemy_mech_walker_idle",
        "file": "enemy_mech_walker_idle_sheet.png",
        "image": "assets/sprites/9fcdce5d-b98f-4796-aa34-dbbd378bd053.png",
        "region": [40, 560, 705, 650],
        "cells": 4,
        "select": [0, 1],
        "fit_w": 146,
        "fit_h": 90,
        "bottom": 150,
        "bg_xy": [3, 3],
        "bg_distance": 28,
        "dark_threshold": 62,
        "trim": [0, 5, 0, 0],
    },
    {
        "base": "enemy_mech_walker_walk",
        "file": "enemy_mech_walker_walk_sheet.png",
        "image": "assets/sprites/9fcdce5d-b98f-4796-aa34-dbbd378bd053.png",
        "region": [40, 560, 705, 650],
        "cells": 4,
        "fit_w": 146,
        "fit_h": 90,
        "bottom": 150,
        "bg_xy": [3, 3],
        "bg_distance": 28,
        "dark_threshold": 62,
        "trim": [0, 5, 0, 0],
    },
    {
        "base": "enemy_mech_walker_attack",
        "file": "enemy_mech_walker_attack_sheet.png",
        "image": "assets/sprites/9fcdce5d-b98f-4796-aa34-dbbd378bd053.png",
        "region": [40, 665, 705, 760],
        "cells": 4,
        "fit_w": 148,
        "fit_h": 92,
        "bottom": 150,
        "bg_xy": [3, 3],
        "bg_distance": 28,
        "dark_threshold": 62,
        "trim": [0, 5, 0, 0],
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build boss/miniboss strips from the imported atlas pages.")
    parser.add_argument("--sheet-dir", default=DEFAULT_SHEET_DIR, help="Output strip directory.")
    parser.add_argument("--sheet-manifest", default=DEFAULT_SHEET_MANIFEST, help="Sheet manifest JSON to update.")
    parser.add_argument("--slice-out", default=SLICE_OUT, help="Directory for sliced clean-source frames.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing strips and regenerate slices.")
    return parser.parse_args()


def run_slice(source: Path, out_dir: Path, overwrite: bool) -> None:
    if overwrite and out_dir.exists():
        for child in out_dir.iterdir():
            if child.is_file():
                child.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)
    frame0 = out_dir / "frame_000.png"
    if frame0.exists():
        return
    subprocess.run(
        [
            "python",
            "tools/slice_external_sprite_sheet.py",
            "--source",
            str(source),
            "--out",
            str(out_dir),
            "--bg-mode",
            "sample",
            "--bg-distance",
            "24",
            "--grow",
            "1",
            "--pad",
            "2",
            "--min-area",
            "24",
            "--row-tolerance",
            "18",
        ],
        check=True,
    )


def fit_frame(src: Image.Image, fit_w: int, fit_h: int) -> Image.Image:
    scale = min(fit_w / max(1, src.width), fit_h / max(1, src.height))
    size = (max(1, int(round(src.width * scale))), max(1, int(round(src.height * scale))))
    return src.resize(size, Image.Resampling.NEAREST)


def compose_canvas(src: Image.Image, bottom: int, fit_w: int, fit_h: int) -> Image.Image:
    canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    fitted = fit_frame(src, fit_w, fit_h)
    x = (FRAME - fitted.width) // 2
    y = bottom - fitted.height
    canvas.alpha_composite(fitted, (x, y))
    return canvas


def compose_strip(frames: Iterable[Image.Image]) -> Image.Image:
    items = list(frames)
    strip = Image.new("RGBA", (FRAME * len(items), FRAME), (0, 0, 0, 0))
    for idx, frame in enumerate(items):
        strip.alpha_composite(frame, (idx * FRAME, 0))
    return strip


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def color_distance(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    return math.sqrt(sum((int(a[i]) - int(b[i])) ** 2 for i in range(3)))


def flood_remove_background(
    src: Image.Image,
    sample_xy: tuple[int, int],
    bg_distance: float,
    dark_threshold: int | None = None,
    global_bg_distance: float | None = None,
) -> Image.Image:
    img = src.convert("RGBA")
    px = img.load()
    w, h = img.size
    bg = px[min(sample_xy[0], w - 1), min(sample_xy[1], h - 1)]

    def is_background(pixel: tuple[int, int, int, int]) -> bool:
        if dark_threshold is not None:
            lum = (int(pixel[0]) + int(pixel[1]) + int(pixel[2])) / 3
            if lum <= dark_threshold:
                return True
        return color_distance(pixel, bg) <= bg_distance

    queue: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or (x, y) in seen:
            continue
        seen.add((x, y))
        pixel = px[x, y]
        if not is_background(pixel):
            continue
        px[x, y] = (0, 0, 0, 0)
        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))
    if global_bg_distance is not None:
        for y in range(h):
            for x in range(w):
                pixel = px[x, y]
                if pixel[3] and color_distance(pixel, bg) <= global_bg_distance:
                    px[x, y] = (0, 0, 0, 0)
    return img


def crop_alpha_bounds(src: Image.Image, pad: int = 2) -> Image.Image:
    bbox = src.getchannel("A").getbbox()
    if not bbox:
        return src
    left, top, right, bottom = bbox
    return src.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(src.width, right + pad),
            min(src.height, bottom + pad),
        )
    )


def trim_image(src: Image.Image, trim: Iterable[int] | None) -> Image.Image:
    if not trim:
        return src
    left, top, right, bottom = [int(v) for v in trim]
    return src.crop(
        (
            max(0, left),
            max(0, top),
            max(left + 1, src.width - right),
            max(top + 1, src.height - bottom),
        )
    )


def extract_manual_frames(cfg: dict) -> list[Image.Image]:
    image = Path(cfg["image"]).resolve()
    region = tuple(int(v) for v in cfg["region"])
    cols = int(cfg["cells"])
    sample_xy = tuple(int(v) for v in cfg.get("bg_xy", [2, 2]))
    bg_distance = float(cfg.get("bg_distance", 24))
    dark_threshold = cfg.get("dark_threshold")
    global_bg_distance = cfg.get("global_bg_distance")
    selection = [int(v) for v in cfg.get("select", range(cols))]
    trim = cfg.get("trim")

    with Image.open(image).convert("RGBA") as src:
        panel = src.crop(region)
        cell_w = panel.width / cols
        extracted: list[Image.Image] = []
        for idx in selection:
            left = int(round(idx * cell_w))
            right = int(round((idx + 1) * cell_w))
            cell = panel.crop((left, 0, right, panel.height))
            cell = flood_remove_background(cell, sample_xy, bg_distance, dark_threshold, global_bg_distance)
            cell = crop_alpha_bounds(cell, pad=2)
            cell = trim_image(cell, trim)
            extracted.append(cell)
        return extracted


def update_sheet_manifest(path: Path) -> None:
    manifest = load_json(path) or {
        "version": 1,
        "format": "png-sheet-strip",
        "frame_size": [FRAME, FRAME],
        "sheets": [],
    }
    existing = {entry["base"]: entry for entry in manifest.get("sheets", [])}
    for cfg in [*SLICE_PACKS, *MANUAL_PACKS]:
        frames = len(cfg.get("indices", cfg.get("select", range(int(cfg.get("cells", 0))))))
        if "indices" in cfg:
            frames = len(cfg["indices"])
        elif "select" in cfg:
            frames = len(cfg["select"])
        else:
            frames = int(cfg["cells"])
        existing[cfg["base"]] = {
            "base": cfg["base"],
            "file": cfg["file"],
            "frames": frames,
            "frame_w": FRAME,
            "frame_h": FRAME,
        }
    manifest["sheets"] = [existing[key] for key in sorted(existing.keys())]
    save_json(path, manifest)


def build_slice_pack(cfg: dict, slice_dir: Path, sheet_dir: Path, overwrite: bool) -> None:
    target = sheet_dir / cfg["file"]
    if target.exists() and not overwrite:
        raise FileExistsError(f"{target} exists. Re-run with --overwrite.")
    frames: list[Image.Image] = []
    for idx in cfg["indices"]:
        frame_path = slice_dir / f"frame_{idx:03d}.png"
        with Image.open(frame_path).convert("RGBA") as src:
            frames.append(compose_canvas(src, int(cfg["bottom"]), int(cfg["fit_w"]), int(cfg["fit_h"])))
    compose_strip(frames).save(target, format="PNG")
    print(f"Wrote {target}")


def build_manual_pack(cfg: dict, sheet_dir: Path, overwrite: bool) -> None:
    target = sheet_dir / cfg["file"]
    if target.exists() and not overwrite:
        raise FileExistsError(f"{target} exists. Re-run with --overwrite.")
    frames = [
        compose_canvas(frame, int(cfg["bottom"]), int(cfg["fit_w"]), int(cfg["fit_h"]))
        for frame in extract_manual_frames(cfg)
    ]
    compose_strip(frames).save(target, format="PNG")
    print(f"Wrote {target}")


def main() -> None:
    args = parse_args()
    slice_source = Path(SLICE_SOURCE_IMAGE).resolve()
    slice_out = Path(args.slice_out).resolve()
    sheet_dir = Path(args.sheet_dir).resolve()
    manifest_path = Path(args.sheet_manifest).resolve()
    sheet_dir.mkdir(parents=True, exist_ok=True)

    run_slice(slice_source, slice_out, args.overwrite)

    for cfg in SLICE_PACKS:
        build_slice_pack(cfg, slice_out, sheet_dir, args.overwrite)
    for cfg in MANUAL_PACKS:
        build_manual_pack(cfg, sheet_dir, args.overwrite)

    update_sheet_manifest(manifest_path)
    print(f"Updated sheet manifest: {manifest_path}")


if __name__ == "__main__":
    main()
