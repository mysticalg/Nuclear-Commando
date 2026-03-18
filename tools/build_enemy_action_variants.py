#!/usr/bin/env python3
"""
Build trooper action sheets and palette variants from assets/sprites/enemy.png slices.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


FRAME = 160
DEFAULT_SOURCE = "output/slice-enemy-png"
DEFAULT_SHEET_DIR = "assets/sprites/sheets/png16"

ACTION_FRAMES = {
    "": [16, 17, 18, 19, 20, 21],
    "_fire": [2, 3, 4, 5, 6, 4],
    "_up": [35, 36, 37, 38, 39, 37],
    "_death": [40, 41, 42, 43, 44, 45, 46],
}

PALETTES = {
    "default": None,
    "olive": {
        "accent_light": (229, 246, 153),
        "accent_mid": (158, 198, 78),
        "accent_dark": (86, 119, 42),
        "body_light": (154, 176, 98),
        "body_mid": (90, 112, 56),
        "body_dark": (39, 57, 27),
        "metal_light": (201, 222, 197),
        "metal_mid": (116, 139, 112),
        "metal_dark": (57, 74, 55),
    },
    "crimson": {
        "accent_light": (255, 213, 189),
        "accent_mid": (231, 100, 93),
        "accent_dark": (116, 30, 46),
        "body_light": (212, 124, 118),
        "body_mid": (122, 50, 62),
        "body_dark": (57, 16, 27),
        "metal_light": (215, 198, 205),
        "metal_mid": (138, 104, 116),
        "metal_dark": (69, 44, 54),
    },
    "navy": {
        "accent_light": (187, 227, 255),
        "accent_mid": (88, 171, 240),
        "accent_dark": (41, 84, 160),
        "body_light": (135, 162, 221),
        "body_mid": (62, 88, 162),
        "body_dark": (28, 41, 95),
        "metal_light": (210, 221, 237),
        "metal_mid": (122, 141, 174),
        "metal_dark": (58, 72, 101),
    },
}

ALIGN = {
    "": {"fit_w": 112, "fit_h": 132, "bottom": 150},
    "_fire": {"fit_w": 112, "fit_h": 132, "bottom": 150},
    "_up": {"fit_w": 112, "fit_h": 138, "bottom": 150},
    "_death": {"fit_w": 132, "fit_h": 132, "bottom": 150},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build enemy action variant sheets from sliced enemy frames.")
    parser.add_argument("--source-dir", default=DEFAULT_SOURCE, help="Directory containing frame_###.png files.")
    parser.add_argument("--sheet-dir", default=DEFAULT_SHEET_DIR, help="Destination sheet directory.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing sheets.")
    return parser.parse_args()


def load_frame(source_dir: Path, index: int) -> Image.Image:
    path = source_dir / f"frame_{index:03d}.png"
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGBA")


def ramp_color(value: float, c0: tuple[int, int, int], c1: tuple[int, int, int], c2: tuple[int, int, int]) -> tuple[int, int, int]:
    if value >= 0.72:
        t = (value - 0.72) / 0.28
        base_a, base_b = c1, c0
    elif value >= 0.36:
        t = (value - 0.36) / 0.36
        base_a, base_b = c2, c1
    else:
        t = value / 0.36
        base_a, base_b = c2, c2
    return tuple(int(round(base_a[i] + (base_b[i] - base_a[i]) * max(0.0, min(1.0, t)))) for i in range(3))


def recolor_frame(src: Image.Image, palette_name: str) -> Image.Image:
    if palette_name == "default":
        return src.copy()

    palette = PALETTES[palette_name]
    out = src.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a <= 8:
                continue
            luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
            sat = max(r, g, b) - min(r, g, b)
            if luma < 0.08:
                continue
            if sat < 22:
                nr, ng, nb = ramp_color(luma, palette["metal_light"], palette["metal_mid"], palette["metal_dark"])
            elif r >= g - 4 and g > b + 8:
                if luma > 0.62:
                    nr, ng, nb = ramp_color(luma, palette["accent_light"], palette["accent_mid"], palette["accent_dark"])
                else:
                    nr, ng, nb = ramp_color(luma, palette["body_light"], palette["body_mid"], palette["body_dark"])
            else:
                nr, ng, nb = ramp_color(luma, palette["body_light"], palette["body_mid"], palette["body_dark"])
            px[x, y] = (nr, ng, nb, a)
    return out


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


def compose_strip(frames: list[Image.Image]) -> Image.Image:
    strip = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        strip.alpha_composite(frame, (i * FRAME, 0))
    return strip


def filename_for(variant: str, action: str) -> str:
    if variant == "default":
        base = "enemy_trooper"
    else:
        base = f"enemy_trooper_{variant}"
    return f"{base}{action}_sheet.png"


def main() -> None:
    args = parse_args()
    source_dir = Path(args.source_dir).resolve()
    sheet_dir = Path(args.sheet_dir).resolve()
    sheet_dir.mkdir(parents=True, exist_ok=True)

    for variant in PALETTES:
        for action, indices in ACTION_FRAMES.items():
            filename = filename_for(variant, action)
            target = sheet_dir / filename
            if target.exists() and not args.overwrite:
                raise FileExistsError(f"{target} exists. Re-run with --overwrite.")
            cfg = ALIGN[action]
            frames = []
            for index in indices:
                frame = recolor_frame(load_frame(source_dir, index), variant)
                frames.append(compose_canvas(frame, bottom=cfg["bottom"], fit_w=cfg["fit_w"], fit_h=cfg["fit_h"]))
            compose_strip(frames).save(target, format="PNG")
            print(f"Wrote {target}")


if __name__ == "__main__":
    main()
