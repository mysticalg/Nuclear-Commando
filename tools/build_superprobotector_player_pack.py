#!/usr/bin/env python3
"""
Repack sliced frames from superprobotectorsheet1.png into the game's player sheet layout.

Frame notes from the extracted contact sheet:
- 0-15: standing, aiming, crouch, prone, roll
- 16-39: contiguous run / aim-up / aim-diagonal loops
- 52-61: airborne aiming
- 62-81: climb / ladder poses (catalogued for future ladder support)
- 82-87: leap / tumble / landing / prone
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

from PIL import Image

FRAME = 160
DEFAULT_SOURCE = "output/slice-superprobotector-png"
DEFAULT_SHEET_DIR = "assets/sprites/sheets/png16"

PACK_MAP = {
    "player_idle_sheet.png": [0, 1, 0, 1, 0, 1],
    "player_idle_up_sheet.png": [2, 3, 2, 3, 2, 3],
    "player_idle_diag_sheet.png": [4, 5, 4, 5, 4, 5],
    "player_run_sheet.png": [16, 17, 18, 19, 20, 21, 18, 19],
    "player_run_up_sheet.png": [22, 23, 24, 25, 26, 27, 24, 25],
    "player_run_diag_sheet.png": [34, 35, 36, 37, 38, 39, 36, 37],
    "player_jump_sheet.png": [82, 83, 84, 85, 86, 85],
    "player_air_forward_sheet.png": [60, 61, 60, 61],
    "player_air_up_sheet.png": [58, 59, 58, 59],
    "player_air_diag_sheet.png": [52, 53, 56, 57],
    "player_crouch_sheet.png": [8, 9],
    "player_roll_sheet.png": [12, 13, 14, 15],
    "player_climb_sheet.png": [65, 66, 67, 68, 69, 70],
}

ALIGN_OVERRIDES = {
    "player_idle_sheet.png": {"fit_h": 132, "bottom": 150},
    "player_idle_up_sheet.png": {"fit_h": 132, "bottom": 150},
    "player_idle_diag_sheet.png": {"fit_h": 132, "bottom": 150},
    "player_run_sheet.png": {"fit_h": 132, "bottom": 150},
    "player_run_up_sheet.png": {"fit_h": 132, "bottom": 150},
    "player_run_diag_sheet.png": {"fit_h": 132, "bottom": 150},
    "player_crouch_sheet.png": {"fit_h": 114, "bottom": 150},
    "player_roll_sheet.png": {"fit_h": 92, "bottom": 132},
    "player_jump_sheet.png": {"fit_h": 126, "bottom": 142},
    "player_air_forward_sheet.png": {"fit_h": 126, "bottom": 142},
    "player_air_up_sheet.png": {"fit_h": 126, "bottom": 142},
    "player_air_diag_sheet.png": {"fit_h": 126, "bottom": 142},
    "player_climb_sheet.png": {"fit_h": 136, "bottom": 150},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build player sheets from sliced Super Probotector frames.")
    parser.add_argument("--source-dir", default=DEFAULT_SOURCE, help="Directory containing frame_###.png files.")
    parser.add_argument("--sheet-dir", default=DEFAULT_SHEET_DIR, help="Destination sheet directory.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing sheets.")
    return parser.parse_args()


def load_frame(source_dir: Path, index: int) -> Image.Image:
    path = source_dir / f"frame_{index:03d}.png"
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGBA")


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
    frames = list(frames)
    strip = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        strip.alpha_composite(frame, (i * FRAME, 0))
    return strip


def main() -> None:
    args = parse_args()
    source_dir = Path(args.source_dir).resolve()
    sheet_dir = Path(args.sheet_dir).resolve()
    sheet_dir.mkdir(parents=True, exist_ok=True)

    for filename, indices in PACK_MAP.items():
        target = sheet_dir / filename
        if target.exists() and not args.overwrite:
            raise FileExistsError(f"{target} exists. Re-run with --overwrite.")
        cfg = ALIGN_OVERRIDES.get(filename, {"fit_h": 132, "bottom": 150})
        frames = []
        for index in indices:
            frame = load_frame(source_dir, index)
            frames.append(compose_canvas(frame, bottom=cfg["bottom"], fit_w=112, fit_h=cfg["fit_h"]))
        compose_strip(frames).save(target, format="PNG")
        print(f"Wrote {target}")


if __name__ == "__main__":
    main()
