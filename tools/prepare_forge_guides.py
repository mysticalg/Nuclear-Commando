#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


BG = (246, 244, 238, 255)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare centered guide canvases for Forge img2img sprite generation.")
    parser.add_argument("--src", required=True, help="Source sprite PNG.")
    parser.add_argument("--out", required=True, help="Output guide PNG.")
    parser.add_argument("--width", type=int, required=True, help="Target canvas width.")
    parser.add_argument("--height", type=int, required=True, help="Target canvas height.")
    parser.add_argument("--kind", default="object", choices=("character", "objective", "icon", "object"))
    return parser.parse_args()


def trim_alpha(img: Image.Image) -> Image.Image:
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return img
    return img.crop(bbox)


def fit_limits(kind: str, width: int, height: int) -> tuple[int, int]:
    if kind == "character":
        return int(width * 0.68), int(height * 0.78)
    if kind == "objective":
        return int(width * 0.82), int(height * 0.64)
    if kind == "icon":
        side = int(min(width, height) * 0.56)
        return side, side
    return int(width * 0.74), int(height * 0.72)


def paste_position(kind: str, canvas_w: int, canvas_h: int, sprite_w: int, sprite_h: int) -> tuple[int, int]:
    x = (canvas_w - sprite_w) // 2
    if kind == "character":
        y = canvas_h - int(canvas_h * 0.08) - sprite_h
    elif kind == "objective":
        y = canvas_h - int(canvas_h * 0.14) - sprite_h
    else:
        y = (canvas_h - sprite_h) // 2
    return x, max(0, y)


def main() -> None:
    args = parse_args()
    src_path = Path(args.src)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    sprite = Image.open(src_path).convert("RGBA")
    sprite = trim_alpha(sprite)

    max_w, max_h = fit_limits(args.kind, args.width, args.height)
    scale = min(max_w / max(1, sprite.width), max_h / max(1, sprite.height))
    scale = max(1, int(scale))
    scaled = sprite.resize((max(1, sprite.width * scale), max(1, sprite.height * scale)), Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", (args.width, args.height), BG)
    x, y = paste_position(args.kind, args.width, args.height, scaled.width, scaled.height)
    canvas.alpha_composite(scaled, (x, y))
    canvas.save(out_path)


if __name__ == "__main__":
    main()
