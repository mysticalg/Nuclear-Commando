#!/usr/bin/env python3
"""
Build hand-crafted pixel character sheets for Nuclear Commando.

This script focuses on the core animated characters:
- rugged commando player
- hostile trooper

The sprites are drawn on an 80x80 pixel canvas with per-pixel shading, then
upscaled 2x into the existing 160x160 sheet format so the game can reuse the
current importer and animation pipeline.
"""

from __future__ import annotations

import argparse
import math
import subprocess
import sys
from pathlib import Path
from typing import Callable, Iterable, Sequence

from PIL import Image, ImageChops, ImageDraw, ImageFilter

BASE = 80
FRAME = 160
UPSCALE = FRAME // BASE
OUTLINE = (12, 18, 26, 255)
TRANSPARENT = (0, 0, 0, 0)

Color = tuple[int, int, int, int]
Point = tuple[float, float]
RGB = tuple[int, int, int]

PLAYER_STYLE = {
    "skin_shadow": "#77462c",
    "skin_mid": "#bc794b",
    "skin_light": "#efb788",
    "shirt_shadow": "#837567",
    "shirt_mid": "#ddd5cc",
    "shirt_light": "#fff9f2",
    "strap_shadow": "#594331",
    "strap_mid": "#7a5d3d",
    "strap_light": "#a77c49",
    "band_shadow": "#921922",
    "band_mid": "#de3042",
    "band_light": "#ff7f8a",
    "hair_shadow": "#2f1c15",
    "hair_mid": "#6f3c24",
    "hair_light": "#a86d4f",
    "stubble_shadow": "#5e4738",
    "stubble_mid": "#7d5e4d",
    "stubble_light": "#9e7a63",
    "pants_camo": ["#24391f", "#41622a", "#658438", "#5f472f", "#91ae57"],
    "boot_shadow": "#141920",
    "boot_mid": "#2c3540",
    "boot_light": "#4e5f70",
    "gun_shadow": "#414956",
    "gun_mid": "#8e99ac",
    "gun_light": "#eef5ff",
    "pad_shadow": "#1e2e22",
    "pad_mid": "#394f33",
    "pad_light": "#5e7b4f",
}

TROOPER_STYLE = {
    "skin_shadow": "#6a4531",
    "skin_mid": "#a77252",
    "skin_light": "#d7a177",
    "shirt_shadow": "#462432",
    "shirt_mid": "#7e4558",
    "shirt_light": "#b76475",
    "strap_shadow": "#3d3122",
    "strap_mid": "#5c4931",
    "strap_light": "#7f6640",
    "band_shadow": "#3f3449",
    "band_mid": "#61556f",
    "band_light": "#9385a5",
    "hair_shadow": "#241b1c",
    "hair_mid": "#433033",
    "hair_light": "#675155",
    "stubble_shadow": "#473932",
    "stubble_mid": "#645149",
    "stubble_light": "#856c61",
    "pants_camo": ["#42141f", "#65313e", "#845262", "#311019", "#95636d"],
    "boot_shadow": "#14161d",
    "boot_mid": "#252c36",
    "boot_light": "#4d5663",
    "gun_shadow": "#3c424c",
    "gun_mid": "#7c8797",
    "gun_light": "#e4ebf5",
    "pad_shadow": "#2e1620",
    "pad_mid": "#4a2532",
    "pad_light": "#764450",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate richer pixel character sheets.")
    parser.add_argument("--sheet-dir", default="assets/sprites/sheets/png16", help="Output sheet directory.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing sheet PNGs.")
    parser.add_argument("--run-import", action="store_true", help="Run import_png_sprite_sheets.py after generating.")
    return parser.parse_args()


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def rgb(hex_color: str) -> RGB:
    value = hex_color.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def mix(a: RGB, b: RGB, t: float) -> RGB:
    t = clamp(t, 0.0, 1.0)
    return (
        int(round(a[0] + (b[0] - a[0]) * t)),
        int(round(a[1] + (b[1] - a[1]) * t)),
        int(round(a[2] + (b[2] - a[2]) * t)),
    )


def adjust(rgb_color: RGB, mul: float = 1.0, add: float = 0.0) -> RGB:
    return (
        int(clamp(rgb_color[0] * mul + add, 0, 255)),
        int(clamp(rgb_color[1] * mul + add, 0, 255)),
        int(clamp(rgb_color[2] * mul + add, 0, 255)),
    )


def hash_noise(x: int, y: int, seed: int) -> float:
    value = (x * 0x1F123BB5) ^ (y * 0xABC98388) ^ (seed * 0x9E3779B1)
    value ^= (value >> 15)
    value *= 0x2C1B3C6D
    value ^= (value >> 12)
    value *= 0x297A2D39
    value ^= (value >> 15)
    return (value & 0xFFFFFFFF) / 0xFFFFFFFF


def new_frame() -> Image.Image:
    return Image.new("RGBA", (BASE, BASE), TRANSPARENT)


def mask_image() -> Image.Image:
    return Image.new("L", (BASE, BASE), 0)


def paint_mask(
    target: Image.Image,
    mask: Image.Image,
    shader: Callable[[int, int], Color],
    outline: Color | None = OUTLINE,
) -> None:
    px = target.load()
    mx = mask.load()
    bbox = mask.getbbox()
    if not bbox:
        return
    for y in range(bbox[1], bbox[3]):
        for x in range(bbox[0], bbox[2]):
            if mx[x, y]:
                px[x, y] = shader(x, y)
    if outline:
        expanded = mask.filter(ImageFilter.MaxFilter(3))
        ex = expanded.load()
        for y in range(bbox[1] - 1, bbox[3] + 1):
            if y < 0 or y >= BASE:
                continue
            for x in range(bbox[0] - 1, bbox[2] + 1):
                if x < 0 or x >= BASE:
                    continue
                if ex[x, y] and not mx[x, y]:
                    px[x, y] = outline


def polygon_mask(points: Sequence[Point]) -> Image.Image:
    img = mask_image()
    d = ImageDraw.Draw(img)
    d.polygon(points, fill=255)
    return img


def ellipse_mask(box: tuple[float, float, float, float]) -> Image.Image:
    img = mask_image()
    d = ImageDraw.Draw(img)
    d.ellipse(box, fill=255)
    return img


def rect_mask(box: tuple[float, float, float, float]) -> Image.Image:
    img = mask_image()
    d = ImageDraw.Draw(img)
    d.rectangle(box, fill=255)
    return img


def fill_polygon(target: Image.Image, points: Sequence[Point], shader: Callable[[int, int], Color], outline: Color | None = OUTLINE) -> None:
    paint_mask(target, polygon_mask(points), shader, outline)


def fill_ellipse(target: Image.Image, box: tuple[float, float, float, float], shader: Callable[[int, int], Color], outline: Color | None = OUTLINE) -> None:
    paint_mask(target, ellipse_mask(box), shader, outline)


def fill_rect(target: Image.Image, box: tuple[float, float, float, float], shader: Callable[[int, int], Color], outline: Color | None = OUTLINE) -> None:
    paint_mask(target, rect_mask(box), shader, outline)


def place_pixels(target: Image.Image, points: Iterable[tuple[int, int]], color: Color) -> None:
    px = target.load()
    for x, y in points:
        if 0 <= x < BASE and 0 <= y < BASE:
            px[x, y] = color


def shader_ramp(
    shadow_hex: str,
    mid_hex: str,
    light_hex: str,
    seed: int,
    noise_strength: float = 0.08,
    extra: Callable[[int, int], float] | None = None,
) -> Callable[[int, int], Color]:
    shadow = rgb(shadow_hex)
    mid = rgb(mid_hex)
    light = rgb(light_hex)

    def shade(x: int, y: int) -> Color:
        nx = x / (BASE - 1)
        ny = y / (BASE - 1)
        lightness = 0.42 + (1.0 - ny) * 0.26 + (1.0 - nx) * 0.12
        if extra:
            lightness += extra(x, y)
        lightness += (hash_noise(x, y, seed) - 0.5) * noise_strength
        lightness = clamp(lightness, 0.0, 1.0)
        if lightness < 0.56:
            col = mix(shadow, mid, lightness / 0.56)
        else:
            col = mix(mid, light, (lightness - 0.56) / 0.44)
        sparkle = hash_noise(x + 7, y + 13, seed + 101)
        if sparkle > 0.9:
            col = adjust(col, 1.06, 4)
        return (*col, 255)

    return shade


def camo_shader(colors: Sequence[str], seed: int) -> Callable[[int, int], Color]:
    swatches = [rgb(c) for c in colors]

    def shade(x: int, y: int) -> Color:
        patch = hash_noise(x // 5, y // 5, seed)
        if patch < 0.18:
            base = swatches[0]
        elif patch < 0.36:
            base = swatches[1]
        elif patch < 0.56:
            base = swatches[2]
        elif patch < 0.77:
            base = swatches[3]
        else:
            base = swatches[4]
        nx = x / (BASE - 1)
        ny = y / (BASE - 1)
        lightness = 0.34 + (1.0 - ny) * 0.22 + (1.0 - nx) * 0.08
        lightness += (hash_noise(x, y, seed + 31) - 0.5) * 0.1
        dark = adjust(base, 0.55, -4)
        mid = base
        bright = adjust(base, 1.15, 6)
        if lightness < 0.58:
            col = mix(dark, mid, lightness / 0.58)
        else:
            col = mix(mid, bright, (lightness - 0.58) / 0.42)
        if hash_noise(x * 2, y * 2, seed + 71) > 0.84:
            col = mix(col, adjust(base, 1.22, 10), 0.35)
        return (*col, 255)

    return shade


def metal_shader(shadow_hex: str, mid_hex: str, light_hex: str, seed: int) -> Callable[[int, int], Color]:
    shadow = rgb(shadow_hex)
    mid = rgb(mid_hex)
    light = rgb(light_hex)

    def shade(x: int, y: int) -> Color:
        nx = x / (BASE - 1)
        ny = y / (BASE - 1)
        spec = max(0.0, 1.0 - abs(ny - 0.48) * 3.2)
        lightness = 0.38 + (1.0 - ny) * 0.18 + spec * 0.16
        lightness += (hash_noise(x, y, seed) - 0.5) * 0.06
        if lightness < 0.54:
            col = mix(shadow, mid, lightness / 0.54)
        else:
            col = mix(mid, light, (lightness - 0.54) / 0.46)
        if hash_noise(x + 11, y, seed + 9) > 0.93:
            col = adjust(col, 1.09, 6)
        return (*col, 255)

    return shade


def solve_joint(a: Point, b: Point, bend: float) -> Point:
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dist = max(0.001, math.hypot(dx, dy))
    mx = (a[0] + b[0]) * 0.5
    my = (a[1] + b[1]) * 0.5
    nx = -dy / dist
    ny = dx / dist
    return (mx + nx * bend, my + ny * bend)


def segment_poly(a: Point, b: Point, wa: float, wb: float) -> list[Point]:
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dist = max(0.001, math.hypot(dx, dy))
    nx = -dy / dist
    ny = dx / dist
    return [
        (a[0] + nx * wa * 0.5, a[1] + ny * wa * 0.5),
        (a[0] - nx * wa * 0.5, a[1] - ny * wa * 0.5),
        (b[0] - nx * wb * 0.5, b[1] - ny * wb * 0.5),
        (b[0] + nx * wb * 0.5, b[1] + ny * wb * 0.5),
    ]


def boot_poly(ankle: Point, foot: Point, thickness: float = 7.0) -> list[Point]:
    dx = foot[0] - ankle[0]
    dy = foot[1] - ankle[1]
    dist = max(0.001, math.hypot(dx, dy))
    ux = dx / dist
    uy = dy / dist
    nx = -uy
    ny = ux
    heel = (ankle[0] - ux * 2.5, ankle[1] - uy * 2.5)
    toe = (foot[0] + ux * 4.0, foot[1] + uy * 1.2)
    return [
        (heel[0] + nx * (thickness * 0.48), heel[1] + ny * (thickness * 0.48) - 1.5),
        (heel[0] - nx * (thickness * 0.52), heel[1] - ny * (thickness * 0.52) + 1.5),
        (toe[0] - nx * (thickness * 0.36), toe[1] - ny * (thickness * 0.36) + 3.0),
        (toe[0] + nx * (thickness * 0.45), toe[1] + ny * (thickness * 0.45) - 1.0),
    ]


def rifle_polys(origin: Point, target: Point) -> dict[str, list[Point]]:
    body = segment_poly(origin, target, 6.0, 4.0)
    dx = target[0] - origin[0]
    dy = target[1] - origin[1]
    dist = max(0.001, math.hypot(dx, dy))
    ux = dx / dist
    uy = dy / dist
    nx = -uy
    ny = ux
    stock = [
        (origin[0] - ux * 4 + nx * 2.5, origin[1] - uy * 4 + ny * 2.5),
        (origin[0] - ux * 7 - nx * 1.5, origin[1] - uy * 7 - ny * 1.5),
        (origin[0] - ux * 3 - nx * 3.0, origin[1] - uy * 3 - ny * 3.0),
        (origin[0] + nx * 2.0, origin[1] + ny * 2.0),
    ]
    barrel_start = (target[0] - ux * 7.0, target[1] - uy * 7.0)
    barrel_end = (target[0] + ux * 8.0, target[1] + uy * 8.0)
    barrel = segment_poly(barrel_start, barrel_end, 2.2, 1.2)
    mag = [
        (origin[0] + ux * 5.0 + nx * 0.8, origin[1] + uy * 5.0 + ny * 0.8),
        (origin[0] + ux * 6.5 - nx * 1.3, origin[1] + uy * 6.5 - ny * 1.3),
        (origin[0] + ux * 3.5 - nx * 5.4, origin[1] + uy * 3.5 - ny * 5.4),
        (origin[0] + ux * 1.8 - nx * 3.6, origin[1] + uy * 1.8 - ny * 3.6),
    ]
    sight = segment_poly(
        (origin[0] + ux * 7.0 + nx * 2.2, origin[1] + uy * 7.0 + ny * 2.2),
        (origin[0] + ux * 14.5 + nx * 2.2, origin[1] + uy * 14.5 + ny * 2.2),
        1.2,
        1.2,
    )
    return {"stock": stock, "body": body, "mag": mag, "barrel": barrel, "sight": sight}


def add_bounds_anchor(img: Image.Image) -> None:
    px = img.load()
    for point in ((14, 8), (65, 77)):
        px[point[0], point[1]] = (0, 0, 0, 1)


def add_bounds_anchor_final(img: Image.Image) -> None:
    px = img.load()
    for point in ((28, 16), (130, 154)):
        px[point[0], point[1]] = (0, 0, 0, 1)


def upscale(img: Image.Image) -> Image.Image:
    return img.resize((FRAME, FRAME), Image.Resampling.NEAREST)


def make_pose(
    bob: float,
    lean: float,
    front_foot: Point,
    rear_foot: Point,
    front_hand: Point,
    rear_hand: Point,
    gun_origin: Point,
    gun_angle: float,
    head_nod: float = 0.0,
    crouch: bool = False,
    jump: bool = False,
) -> dict[str, object]:
    return {
        "bob": bob,
        "lean": lean,
        "front_foot": front_foot,
        "rear_foot": rear_foot,
        "front_hand": front_hand,
        "rear_hand": rear_hand,
        "gun_origin": gun_origin,
        "gun_angle": gun_angle,
        "head_nod": head_nod,
        "crouch": crouch,
        "jump": jump,
    }


def player_idle_pose(i: int) -> dict[str, object]:
    bob = -math.sin((i / 6.0) * math.pi * 2.0) * 0.8
    shift = math.sin((i / 6.0) * math.pi * 2.0) * 0.9
    return make_pose(
        bob=bob,
        lean=0.6,
        front_foot=(45.0 + shift * 0.6, 71.5),
        rear_foot=(35.0 - shift * 0.2, 71.5),
        front_hand=(57.0, 35.5 + shift * 0.4),
        rear_hand=(47.0, 35.6 - shift * 0.3),
        gun_origin=(44.4, 35.1 + shift * 0.3),
        gun_angle=-0.03 + shift * 0.01,
        head_nod=shift * 0.3,
    )


def player_run_pose(i: int) -> dict[str, object]:
    t = (i / 8.0) * math.pi * 2.0
    swing = math.sin(t)
    swing2 = math.sin(t + math.pi)
    bob = -abs(math.sin(t)) * 1.9
    return make_pose(
        bob=bob,
        lean=2.0,
        front_foot=(46.0 + swing * 9.5, 71.0 - max(0.0, -swing) * 3.0),
        rear_foot=(34.0 + swing2 * 8.5, 71.0 - max(0.0, -swing2) * 3.0),
        front_hand=(58.0, 35.0 + swing * 0.8),
        rear_hand=(46.5, 36.0 - swing * 1.2),
        gun_origin=(45.4, 34.8 + swing * 0.5),
        gun_angle=-0.06 + swing * 0.03,
        head_nod=swing * 0.6,
    )


def player_jump_pose(i: int) -> dict[str, object]:
    return make_pose(
        bob=-4.2 + i * 0.6,
        lean=2.4,
        front_foot=(48.5 + i * 1.2, 60.5 - i * 1.0),
        rear_foot=(32.5 - i * 1.0, 61.5 + i * 0.6),
        front_hand=(56.2, 32.4 - i * 0.4),
        rear_hand=(46.1, 33.5 - i * 0.5),
        gun_origin=(46.3, 31.9 - i * 0.2),
        gun_angle=-0.08,
        jump=True,
    )


def player_crouch_pose(i: int) -> dict[str, object]:
    sway = math.sin((i / 2.0) * math.pi) * 0.5
    return make_pose(
        bob=5.0,
        lean=1.0,
        front_foot=(45.0, 71.5),
        rear_foot=(34.5, 71.0),
        front_hand=(58.0, 41.5 + sway),
        rear_hand=(47.0, 42.2 - sway),
        gun_origin=(45.0, 41.1 + sway),
        gun_angle=0.0,
        head_nod=sway * 0.3,
        crouch=True,
    )


def trooper_walk_pose(i: int) -> dict[str, object]:
    t = (i / 6.0) * math.pi * 2.0
    swing = math.sin(t)
    swing2 = math.sin(t + math.pi)
    bob = -abs(math.sin(t)) * 1.2
    return make_pose(
        bob=bob,
        lean=1.0,
        front_foot=(45.0 + swing * 7.0, 71.5 - max(0.0, -swing) * 2.5),
        rear_foot=(35.0 + swing2 * 6.2, 71.5 - max(0.0, -swing2) * 2.5),
        front_hand=(56.0, 36.0 + swing * 0.7),
        rear_hand=(46.2, 36.6 - swing * 0.8),
        gun_origin=(44.9, 35.8 + swing * 0.4),
        gun_angle=-0.03 + swing * 0.01,
        head_nod=swing * 0.2,
    )


def pose_variant(pose: dict[str, object], **updates: object) -> dict[str, object]:
    variant = dict(pose)
    variant.update(updates)
    return variant


def player_idle_up_pose(i: int) -> dict[str, object]:
    base = player_idle_pose(i)
    sway = math.sin((i / 6.0) * math.pi * 2.0) * 0.4
    return pose_variant(
        base,
        front_hand=(52.0, 30.0 + sway),
        rear_hand=(43.5, 33.5 - sway * 0.2),
        gun_origin=(46.8, 31.8 + sway * 0.2),
        gun_angle=-1.23,
        head_nod=float(base["head_nod"]) - 0.2,
    )


def player_idle_diag_pose(i: int) -> dict[str, object]:
    base = player_idle_pose(i)
    sway = math.sin((i / 6.0) * math.pi * 2.0) * 0.5
    return pose_variant(
        base,
        front_hand=(55.0, 31.7 + sway * 0.4),
        rear_hand=(45.4, 34.0 - sway * 0.3),
        gun_origin=(46.0, 32.8 + sway * 0.2),
        gun_angle=-0.74,
    )


def player_run_up_pose(i: int) -> dict[str, object]:
    base = player_run_pose(i)
    swing = math.sin((i / 8.0) * math.pi * 2.0)
    return pose_variant(
        base,
        front_hand=(53.0, 29.4 + swing * 0.5),
        rear_hand=(43.5, 33.1 - swing * 0.4),
        gun_origin=(46.8, 31.1 + swing * 0.2),
        gun_angle=-1.08,
        head_nod=float(base["head_nod"]) - 0.15,
    )


def player_run_diag_pose(i: int) -> dict[str, object]:
    base = player_run_pose(i)
    swing = math.sin((i / 8.0) * math.pi * 2.0)
    return pose_variant(
        base,
        front_hand=(56.1, 31.5 + swing * 0.6),
        rear_hand=(45.8, 34.1 - swing * 0.6),
        gun_origin=(46.3, 32.4 + swing * 0.2),
        gun_angle=-0.68,
    )


def player_air_forward_pose(i: int) -> dict[str, object]:
    t = (i / 4.0) * math.pi * 2.0
    return make_pose(
        bob=-6.0 + math.sin(t) * 0.5,
        lean=2.9,
        front_foot=(48.4 + math.sin(t) * 2.2, 60.5 - math.cos(t) * 1.6),
        rear_foot=(31.6 - math.sin(t) * 1.8, 63.0 + math.cos(t) * 1.4),
        front_hand=(55.8, 31.2 + math.sin(t) * 0.4),
        rear_hand=(46.2, 33.6 - math.sin(t) * 0.3),
        gun_origin=(46.1, 31.9 + math.sin(t) * 0.2),
        gun_angle=-0.1,
        head_nod=-0.35,
        jump=True,
    )


def player_air_up_pose(i: int) -> dict[str, object]:
    base = player_air_forward_pose(i)
    t = (i / 4.0) * math.pi * 2.0
    return pose_variant(
        base,
        front_hand=(51.6, 28.4 + math.sin(t) * 0.4),
        rear_hand=(43.0, 32.4 - math.sin(t) * 0.2),
        gun_origin=(46.0, 30.1 + math.sin(t) * 0.2),
        gun_angle=-1.18,
    )


def player_air_diag_pose(i: int) -> dict[str, object]:
    base = player_air_forward_pose(i)
    t = (i / 4.0) * math.pi * 2.0
    return pose_variant(
        base,
        front_hand=(54.8, 30.0 + math.sin(t) * 0.4),
        rear_hand=(45.2, 33.0 - math.sin(t) * 0.2),
        gun_origin=(46.0, 31.2 + math.sin(t) * 0.2),
        gun_angle=-0.72,
    )


def player_somersault_pose() -> dict[str, object]:
    return make_pose(
        bob=-5.5,
        lean=1.8,
        front_foot=(47.2, 60.5),
        rear_foot=(34.2, 58.0),
        front_hand=(50.0, 36.2),
        rear_hand=(42.4, 37.4),
        gun_origin=(43.8, 37.0),
        gun_angle=0.25,
        head_nod=-0.2,
        jump=True,
    )


def head_profile(base_x: float, base_y: float, nod: float = 0.0) -> list[Point]:
    return [
        (base_x - 5.5, base_y + 1.5),
        (base_x - 1.5, base_y - 0.4 + nod),
        (base_x + 4.8, base_y + 0.4 + nod),
        (base_x + 7.6, base_y + 3.0 + nod),
        (base_x + 8.4, base_y + 6.4 + nod),
        (base_x + 6.8, base_y + 9.8 + nod),
        (base_x + 2.0, base_y + 12.4 + nod),
        (base_x - 2.8, base_y + 12.8 + nod),
        (base_x - 6.0, base_y + 9.6 + nod),
        (base_x - 6.7, base_y + 5.2 + nod),
    ]


def torso_poly(lean: float, bob: float, crouch: bool = False) -> list[Point]:
    top = 29.0 + bob + (3.0 if crouch else 0.0)
    return [
        (32.0 + lean, top),
        (42.5 + lean, top - 0.9),
        (47.8 + lean, top + 10.6),
        (46.0 + lean, top + 23.5),
        (35.2 + lean, top + 25.4),
        (29.4 + lean, top + 13.2),
    ]


def roll_frame(style: dict[str, str], frame: int, player: bool, anchor: bool = True) -> Image.Image:
    img = new_frame()
    cx = 40.0 + (frame - 1.5) * 1.0
    cy = 49.5 - math.sin((frame / 4.0) * math.pi * 2.0) * 1.0
    body = ellipse_mask((cx - 18, cy - 10, cx + 18, cy + 10))
    body = ImageChops.add(body, ellipse_mask((cx - 11, cy - 8, cx + 7, cy + 7)))
    leg_body = ellipse_mask((cx - 10, cy - 6, cx + 16, cy + 9))
    body = ImageChops.add(body, leg_body)
    shirt = shader_ramp(style["shirt_shadow"], style["shirt_mid"], style["shirt_light"], 221 + frame, 0.07)
    pants = camo_shader(style["pants_camo"], 331 + frame)
    paint_mask(img, body, shirt, OUTLINE)
    fill_ellipse(img, (cx - 15, cy - 7, cx + 12, cy + 8), pants)
    fill_ellipse(img, (cx - 8, cy - 11, cx + 6, cy + 3), shader_ramp(style["skin_shadow"], style["skin_mid"], style["skin_light"], 411 + frame, 0.06))
    fill_polygon(
        img,
        [(cx - 7, cy - 10), (cx + 6, cy - 13), (cx + 11, cy - 10), (cx - 1, cy - 6)],
        shader_ramp(style["band_shadow"], style["band_mid"], style["band_light"], 511 + frame, 0.06),
    )
    rifle = rifle_polys((cx + 6, cy - 1), (cx + 22, cy - 1))
    fill_polygon(img, rifle["stock"], metal_shader(style["gun_shadow"], style["gun_mid"], style["gun_light"], 601 + frame))
    fill_polygon(img, rifle["body"], metal_shader(style["gun_shadow"], style["gun_mid"], style["gun_light"], 611 + frame))
    fill_polygon(img, rifle["mag"], metal_shader(style["gun_shadow"], style["gun_mid"], style["gun_light"], 621 + frame))
    fill_polygon(img, rifle["barrel"], metal_shader(style["gun_shadow"], style["gun_mid"], style["gun_light"], 631 + frame))
    place_pixels(img, [(int(cx - 2), int(cy - 2)), (int(cx + 1), int(cy - 1))], OUTLINE)
    if anchor:
        add_bounds_anchor(img)
    return upscale(img)


def draw_humanoid(style: dict[str, str], pose: dict[str, object], player: bool, anchor: bool = True) -> Image.Image:
    img = new_frame()
    bob = float(pose["bob"])
    lean = float(pose["lean"])
    head_nod = float(pose["head_nod"])
    crouch = bool(pose["crouch"])
    jump = bool(pose["jump"])
    head_x = 37.0 + lean
    head_y = 13.5 + bob + (4.0 if crouch else 0.0)
    neck_y = 26.2 + bob + (4.0 if crouch else 0.0)
    shoulder_back = (36.8 + lean, 33.8 + bob + (5.0 if crouch else 0.0))
    shoulder_front = (41.0 + lean, 33.3 + bob + (5.0 if crouch else 0.0))
    hip_back = (35.8 + lean, 49.8 + bob + (6.5 if crouch else 0.0))
    hip_front = (39.6 + lean, 49.4 + bob + (6.5 if crouch else 0.0))
    front_foot = pose["front_foot"]
    rear_foot = pose["rear_foot"]
    front_hand = pose["front_hand"]
    rear_hand = pose["rear_hand"]
    front_knee = solve_joint(hip_front, front_foot, 6.0 if front_foot[0] >= hip_front[0] else 4.5)
    rear_knee = solve_joint(hip_back, rear_foot, -5.5 if rear_foot[0] < hip_back[0] else -3.5)
    front_elbow = solve_joint(shoulder_front, front_hand, 3.3 if player else 2.8)
    rear_elbow = solve_joint(shoulder_back, rear_hand, -3.2 if player else -2.6)

    skin = shader_ramp(style["skin_shadow"], style["skin_mid"], style["skin_light"], 101 if player else 201, 0.07)
    shirt = shader_ramp(style["shirt_shadow"], style["shirt_mid"], style["shirt_light"], 131 if player else 231, 0.08)
    strap = shader_ramp(style["strap_shadow"], style["strap_mid"], style["strap_light"], 151 if player else 251, 0.08)
    band = shader_ramp(style["band_shadow"], style["band_mid"], style["band_light"], 171 if player else 271, 0.08)
    hair = shader_ramp(style["hair_shadow"], style["hair_mid"], style["hair_light"], 181 if player else 281, 0.06)
    stubble = shader_ramp(style["stubble_shadow"], style["stubble_mid"], style["stubble_light"], 191 if player else 291, 0.04)
    pants = camo_shader(style["pants_camo"], 301 if player else 401)
    boots = shader_ramp(style["boot_shadow"], style["boot_mid"], style["boot_light"], 321 if player else 421, 0.06)
    pads = shader_ramp(style["pad_shadow"], style["pad_mid"], style["pad_light"], 341 if player else 441, 0.06)
    metal = metal_shader(style["gun_shadow"], style["gun_mid"], style["gun_light"], 361 if player else 461)

    far_leg_thigh = segment_poly(hip_back, rear_knee, 7.4, 6.0)
    far_leg_shin = segment_poly(rear_knee, rear_foot, 6.0, 5.2)
    near_leg_thigh = segment_poly(hip_front, front_knee, 8.0, 6.4)
    near_leg_shin = segment_poly(front_knee, front_foot, 6.4, 5.4)
    fill_polygon(img, far_leg_thigh, pants)
    fill_polygon(img, far_leg_shin, pants)
    fill_polygon(img, boot_poly(rear_foot, (rear_foot[0] + 6.0, rear_foot[1] - 0.3), 7.0), boots)
    fill_polygon(img, near_leg_thigh, pants)
    fill_polygon(img, near_leg_shin, pants)
    fill_polygon(img, boot_poly(front_foot, (front_foot[0] + 7.4, front_foot[1] - 0.4), 7.8), boots)

    if player:
        fill_polygon(img, [(38.2 + lean, 57.0 + bob), (44.0 + lean, 58.0 + bob), (43.0 + lean, 63.0 + bob), (37.6 + lean, 61.4 + bob)], pads)
        fill_polygon(img, [(31.6 + lean, 56.0 + bob), (36.8 + lean, 56.8 + bob), (36.2 + lean, 61.4 + bob), (30.8 + lean, 60.5 + bob)], pads)

    fill_polygon(img, torso_poly(lean, bob, crouch), shirt)
    fill_polygon(img, [(31.8 + lean, 30.2 + bob + (4.0 if crouch else 0.0)), (35.0 + lean, 28.3 + bob), (39.0 + lean, 52.5 + bob + (2.0 if crouch else 0.0)), (35.2 + lean, 53.0 + bob + (2.0 if crouch else 0.0))], strap)
    fill_rect(img, (36.2 + lean, neck_y, 39.8 + lean, neck_y + 5.0), skin)

    fill_polygon(img, segment_poly(shoulder_back, rear_elbow, 6.6, 5.4), shirt if player else strap)
    fill_polygon(img, segment_poly(rear_elbow, rear_hand, 5.2, 4.2), skin if player else shirt)

    gun_origin = pose["gun_origin"]
    gun_angle = float(pose["gun_angle"])
    rifle_origin = (float(gun_origin[0]), float(gun_origin[1]) + bob)
    rifle_target = (
        rifle_origin[0] + math.cos(gun_angle) * 23.0,
        rifle_origin[1] + math.sin(gun_angle) * 23.0,
    )
    rifle = rifle_polys(rifle_origin, rifle_target)
    fill_polygon(img, rifle["stock"], metal)
    fill_polygon(img, rifle["body"], metal)
    fill_polygon(img, rifle["mag"], metal)
    fill_polygon(img, rifle["barrel"], metal)
    fill_polygon(img, rifle["sight"], metal, None)

    fill_polygon(img, segment_poly(shoulder_front, front_elbow, 6.8, 5.6), skin if player else shirt)
    fill_polygon(img, segment_poly(front_elbow, front_hand, 5.5, 4.4), skin if player else strap)
    fill_ellipse(img, (front_hand[0] - 1.6, front_hand[1] - 1.6, front_hand[0] + 1.8, front_hand[1] + 1.8), skin)
    fill_ellipse(img, (rear_hand[0] - 1.3, rear_hand[1] - 1.3, rear_hand[0] + 1.5, rear_hand[1] + 1.5), skin if player else shirt)

    fill_polygon(img, head_profile(head_x, head_y, head_nod), skin)
    if player:
        fill_polygon(
            img,
            [(head_x - 5.8, head_y + 1.8), (head_x - 0.4, head_y - 0.8), (head_x + 6.0, head_y + 0.2), (head_x + 5.4, head_y + 3.0), (head_x - 0.5, head_y + 3.2), (head_x - 5.8, head_y + 3.0)],
            band,
        )
        fill_polygon(
            img,
            [(head_x - 2.0, head_y - 1.4), (head_x + 3.2, head_y - 2.0), (head_x + 7.0, head_y - 0.2), (head_x + 6.2, head_y + 1.2), (head_x + 0.5, head_y + 1.2), (head_x - 3.0, head_y + 0.8)],
            hair,
        )
        fill_polygon(img, [(head_x - 1.0, head_y + 2.0), (head_x - 6.4, head_y + 4.0), (head_x - 5.6, head_y + 5.8), (head_x - 0.3, head_y + 4.1)], band)
        fill_polygon(img, [(head_x + 4.9, head_y + 2.7), (head_x + 8.8, head_y + 4.4), (head_x + 7.7, head_y + 5.8), (head_x + 4.6, head_y + 4.5)], hair, None)
    else:
        fill_polygon(
            img,
            [(head_x - 6.0, head_y + 0.8), (head_x - 1.0, head_y - 2.0), (head_x + 4.0, head_y - 1.0), (head_x + 7.5, head_y + 1.8), (head_x + 7.0, head_y + 4.8), (head_x - 1.4, head_y + 4.4), (head_x - 5.8, head_y + 3.6)],
            band,
        )
        fill_polygon(
            img,
            [(head_x - 5.0, head_y + 3.4), (head_x - 7.8, head_y + 8.6), (head_x - 4.4, head_y + 10.8), (head_x - 0.8, head_y + 6.2)],
            band,
        )
        fill_polygon(
            img,
            [(head_x - 3.2, head_y + 10.5), (head_x + 3.8, head_y + 9.2), (head_x + 6.2, head_y + 13.8), (head_x - 1.6, head_y + 14.4)],
            shirt,
        )

    fill_polygon(
        img,
        [(head_x + 0.3, head_y + 7.6), (head_x + 4.5, head_y + 7.3), (head_x + 4.1, head_y + 10.8), (head_x + 0.1, head_y + 11.0)],
        stubble if player else hair,
        None,
    )

    px = img.load()
    brow_y = int(round(head_y + 4.7))
    eye_y = int(round(head_y + 5.6))
    for point in ((int(round(head_x + 3.0)), brow_y), (int(round(head_x + 4.0)), brow_y - 1)):
        px[point[0], point[1]] = OUTLINE
    px[int(round(head_x + 4.0)), eye_y] = OUTLINE
    px[int(round(head_x + 5.0)), eye_y] = (236, 242, 246, 255)
    px[int(round(head_x + 5.8)), max(0, eye_y - 1)] = (255, 255, 255, 255)
    px[int(round(head_x + 5.0)), int(round(head_y + 8.7))] = OUTLINE
    if player and not jump:
        px[int(round(head_x + 1.0)), int(round(head_y + 11.0))] = OUTLINE
        px[int(round(head_x + 2.0)), int(round(head_y + 11.2))] = OUTLINE
        px[int(round(head_x + 0.0)), int(round(head_y + 11.6))] = (89, 61, 44, 255)
        px[int(round(head_x + 1.0)), int(round(head_y + 12.0))] = (112, 78, 55, 255)

    if player:
        fill_polygon(img, [(43.0 + lean, 34.4 + bob), (47.6 + lean, 35.2 + bob), (46.7 + lean, 40.0 + bob), (42.4 + lean, 39.1 + bob)], strap, None)
        place_pixels(img, [(int(round(43.0 + lean)), int(round(31.0 + bob))), (int(round(44.0 + lean)), int(round(32.0 + bob)))], (255, 245, 220, 255))
    else:
        fill_polygon(img, [(42.6 + lean, 35.0 + bob), (47.6 + lean, 35.8 + bob), (46.9 + lean, 40.5 + bob), (42.2 + lean, 39.4 + bob)], strap, None)

    if anchor:
        add_bounds_anchor(img)
    return upscale(img)


def somersault_jump_frame(style: dict[str, str], frame: int) -> Image.Image:
    base = draw_humanoid(style, player_somersault_pose(), True, anchor=False)
    angle = -22 + frame * 66
    rotated = base.rotate(angle, resample=Image.Resampling.NEAREST, center=(78, 78), fillcolor=TRANSPARENT)
    rotated = ImageChops.offset(rotated, 0, -6 + int(round(math.sin((frame / 6.0) * math.pi * 2.0) * 2)))
    add_bounds_anchor_final(rotated)
    return rotated


def compose_strip(frames: Sequence[Image.Image]) -> Image.Image:
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), TRANSPARENT)
    for idx, frame in enumerate(frames):
        sheet.alpha_composite(frame, (idx * FRAME, 0))
    return sheet


def save_sheet(path: Path, frames: Sequence[Image.Image], overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(f"{path} exists. Re-run with --overwrite.")
    path.parent.mkdir(parents=True, exist_ok=True)
    compose_strip(frames).save(path, format="PNG")


def count_unique_colors(path: Path) -> int:
    img = Image.open(path).convert("RGBA")
    colors = img.getcolors(maxcolors=img.width * img.height * 4) or []
    return sum(1 for _, pixel in colors if pixel[3])


def main() -> None:
    args = parse_args()
    sheet_dir = Path(args.sheet_dir).resolve()

    player_idle = [draw_humanoid(PLAYER_STYLE, player_idle_pose(i), True) for i in range(6)]
    player_idle_up = [draw_humanoid(PLAYER_STYLE, player_idle_up_pose(i), True) for i in range(6)]
    player_idle_diag = [draw_humanoid(PLAYER_STYLE, player_idle_diag_pose(i), True) for i in range(6)]
    player_run = [draw_humanoid(PLAYER_STYLE, player_run_pose(i), True) for i in range(8)]
    player_run_up = [draw_humanoid(PLAYER_STYLE, player_run_up_pose(i), True) for i in range(8)]
    player_run_diag = [draw_humanoid(PLAYER_STYLE, player_run_diag_pose(i), True) for i in range(8)]
    player_jump = [somersault_jump_frame(PLAYER_STYLE, i) for i in range(6)]
    player_air_forward = [draw_humanoid(PLAYER_STYLE, player_air_forward_pose(i), True) for i in range(4)]
    player_air_up = [draw_humanoid(PLAYER_STYLE, player_air_up_pose(i), True) for i in range(4)]
    player_air_diag = [draw_humanoid(PLAYER_STYLE, player_air_diag_pose(i), True) for i in range(4)]
    player_crouch = [draw_humanoid(PLAYER_STYLE, player_crouch_pose(i), True) for i in range(2)]
    player_roll = [roll_frame(PLAYER_STYLE, i, True) for i in range(4)]
    trooper_walk = [draw_humanoid(TROOPER_STYLE, trooper_walk_pose(i), False) for i in range(6)]

    outputs = {
        "player_idle_sheet.png": player_idle,
        "player_idle_up_sheet.png": player_idle_up,
        "player_idle_diag_sheet.png": player_idle_diag,
        "player_run_sheet.png": player_run,
        "player_run_up_sheet.png": player_run_up,
        "player_run_diag_sheet.png": player_run_diag,
        "player_jump_sheet.png": player_jump,
        "player_air_forward_sheet.png": player_air_forward,
        "player_air_up_sheet.png": player_air_up,
        "player_air_diag_sheet.png": player_air_diag,
        "player_crouch_sheet.png": player_crouch,
        "player_roll_sheet.png": player_roll,
        "enemy_trooper_sheet.png": trooper_walk,
    }

    for filename, frames in outputs.items():
        save_sheet(sheet_dir / filename, frames, args.overwrite)

    print("Generated sheets:")
    for filename in outputs:
        path = sheet_dir / filename
        print(f"- {path}")
        print(f"  unique colors: {count_unique_colors(path)}")

    if args.run_import:
        repo_root = Path(__file__).resolve().parents[1]
        importer = repo_root / "tools" / "import_png_sprite_sheets.py"
        cmd = [sys.executable, str(importer), "--overwrite"]
        subprocess.run(cmd, cwd=repo_root, check=True)


if __name__ == "__main__":
    main()
