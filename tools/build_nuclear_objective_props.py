#!/usr/bin/env python3
"""
Build objective and nuclear-facility prop sprite strips from imported art sheets.

This script:
- cuts manual regions from the newly added source sheets
- prefers alpha trimming whenever the source crop already has transparency
- falls back to painted-backdrop cleanup only when transparency is absent
- repacks the art into 160x160 strips used by the game
- updates the PNG sheet manifest for the live sprite pipeline
"""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageEnhance, ImageFilter

FRAME = 160
SHEET_DIR = Path("assets/sprites/sheets/png16")
MANIFEST_PATH = SHEET_DIR / "sheet_manifest.json"
OUTPUT_PREVIEW = Path("output/objective-prop-preview")


PACKS = [
    {
        "base": "objective_centrifuge",
        "file": "objective_centrifuge_sheet.png",
        "image": "assets/sprites/bee1188a-d9b0-496c-bf9f-380657c7c7ac.png",
        "region": (36, 108, 498, 446),
        "fit_w": 138,
        "fit_h": 108,
        "bottom": 148,
        "bg_distance": 32,
        "dark_threshold": 82,
        "sat_threshold": 62,
        "glow_color": (120, 255, 116),
        "variants": [
            {"brightness": 1.0, "glow": 1.0},
            {"brightness": 1.05, "glow": 1.18, "dy": -1},
        ],
    },
    {
        "base": "objective_factory",
        "file": "objective_factory_sheet.png",
        "image": "assets/sprites/bee1188a-d9b0-496c-bf9f-380657c7c7ac.png",
        "region": (24, 572, 500, 868),
        "fit_w": 136,
        "fit_h": 82,
        "bottom": 149,
        "bg_distance": 34,
        "dark_threshold": 80,
        "sat_threshold": 64,
        "glow_color": (255, 204, 88),
        "variants": [
            {"brightness": 1.0, "glow": 1.0},
            {"brightness": 1.04, "glow": 1.1, "dy": -1},
        ],
    },
    {
        "base": "objective_radar",
        "file": "objective_radar_sheet.png",
        "image": "assets/sprites/bee1188a-d9b0-496c-bf9f-380657c7c7ac.png",
        "region": (458, 520, 1072, 884),
        "fit_w": 142,
        "fit_h": 96,
        "bottom": 148,
        "bg_distance": 34,
        "dark_threshold": 84,
        "sat_threshold": 66,
        "glow_color": (255, 104, 58),
        "variants": [
            {"brightness": 1.0, "glow": 1.0},
            {"brightness": 1.08, "glow": 1.16},
        ],
    },
    {
        "base": "objective_reactor",
        "file": "objective_reactor_sheet.png",
        "image": "assets/sprites/bee1188a-d9b0-496c-bf9f-380657c7c7ac.png",
        "region": (520, 80, 1032, 492),
        "fit_w": 144,
        "fit_h": 124,
        "bottom": 150,
        "bg_distance": 36,
        "dark_threshold": 84,
        "sat_threshold": 68,
        "glow_color": (120, 255, 116),
        "variants": [
            {"brightness": 1.0, "glow": 1.0},
            {"brightness": 1.08, "glow": 1.18, "dy": -1},
            {"brightness": 1.14, "glow": 1.28},
        ],
    },
    {
        "base": "prop_cooling_plant",
        "file": "prop_cooling_plant_sheet.png",
        "image": "assets/sprites/bee1188a-d9b0-496c-bf9f-380657c7c7ac.png",
        "region": (1010, 60, 1518, 476),
        "fit_w": 146,
        "fit_h": 112,
        "bottom": 150,
        "bg_distance": 36,
        "dark_threshold": 86,
        "sat_threshold": 60,
        "variants": [
            {"brightness": 1.0},
            {"brightness": 1.03},
        ],
    },
    {
        "base": "prop_waste_barrel",
        "file": "prop_waste_barrel_sheet.png",
        "image": "assets/sprites/bee1188a-d9b0-496c-bf9f-380657c7c7ac.png",
        "region": (1120, 504, 1498, 930),
        "fit_w": 108,
        "fit_h": 116,
        "bottom": 151,
        "bg_distance": 38,
        "dark_threshold": 84,
        "sat_threshold": 68,
        "glow_color": (128, 255, 92),
        "variants": [
            {"brightness": 1.0, "glow": 1.0},
            {"brightness": 1.08, "glow": 1.14},
        ],
    },
    {
        "base": "prop_cooling_pool",
        "file": "prop_cooling_pool_sheet.png",
        "image": "assets/sprites/21a08d28-c1c3-41fd-b7aa-13a75ac8d172.png",
        "region": (1060, 18, 1528, 438),
        "fit_w": 148,
        "fit_h": 118,
        "bottom": 151,
        "bg_distance": 36,
        "dark_threshold": 94,
        "sat_threshold": 70,
        "glow_color": (88, 236, 255),
        "variants": [
            {"brightness": 1.0, "glow": 1.0},
            {"brightness": 1.04, "glow": 1.14},
        ],
    },
    {
        "base": "prop_reactor_dome",
        "file": "prop_reactor_dome_sheet.png",
        "image": "assets/sprites/21a08d28-c1c3-41fd-b7aa-13a75ac8d172.png",
        "region": (454, 24, 1060, 438),
        "fit_w": 148,
        "fit_h": 112,
        "bottom": 150,
        "bg_distance": 36,
        "dark_threshold": 96,
        "sat_threshold": 68,
        "variants": [
            {"brightness": 1.0},
        ],
    },
    {
        "base": "prop_centrifuge_stack",
        "file": "prop_centrifuge_stack_sheet.png",
        "image": "assets/sprites/21a08d28-c1c3-41fd-b7aa-13a75ac8d172.png",
        "region": (118, 56, 496, 428),
        "fit_w": 118,
        "fit_h": 118,
        "bottom": 151,
        "bg_distance": 34,
        "dark_threshold": 92,
        "sat_threshold": 62,
        "variants": [
            {"brightness": 1.0},
        ],
    },
    {
        "base": "prop_warning_sign",
        "file": "prop_warning_sign_sheet.png",
        "image": "assets/sprites/21a08d28-c1c3-41fd-b7aa-13a75ac8d172.png",
        "region": (1050, 714, 1352, 980),
        "fit_w": 90,
        "fit_h": 90,
        "bottom": 148,
        "bg_distance": 38,
        "dark_threshold": 90,
        "sat_threshold": 74,
        "glow_color": (255, 214, 82),
        "variants": [
            {"brightness": 1.0, "glow": 1.0},
            {"brightness": 1.04, "glow": 1.1},
        ],
    },
    {
        "base": "objective_factory_silo",
        "file": "objective_factory_silo_sheet.png",
        "image": "assets/sprites/73cc31e9-e773-45a7-a02c-b5b7414b01ad.png",
        "region": (1090, 54, 1496, 476),
        "trim_mode": "alpha",
        "alpha_trim_threshold": 18,
        "fit_w": 138,
        "fit_h": 118,
        "bottom": 150,
        "glow_color": (120, 255, 116),
        "variants": [
            {"glow": 1.0},
            {"glow": 1.18, "dy": -1},
        ],
    },
    {
        "base": "objective_reactor_core_alt",
        "file": "objective_reactor_core_alt_sheet.png",
        "image": "assets/sprites/73cc31e9-e773-45a7-a02c-b5b7414b01ad.png",
        "region": (548, 480, 1080, 812),
        "trim_mode": "alpha",
        "alpha_trim_threshold": 18,
        "fit_w": 144,
        "fit_h": 116,
        "bottom": 150,
        "glow_color": (108, 255, 108),
        "variants": [
            {"glow": 1.0},
            {"glow": 1.16, "dy": -1},
            {"glow": 1.24},
        ],
    },
    {
        "base": "objective_reactor_arc_alt",
        "file": "objective_reactor_arc_alt_sheet.png",
        "image": "assets/sprites/73cc31e9-e773-45a7-a02c-b5b7414b01ad.png",
        "region": (1030, 456, 1498, 856),
        "trim_mode": "alpha",
        "alpha_trim_threshold": 18,
        "fit_w": 140,
        "fit_h": 126,
        "bottom": 150,
        "glow_color": (104, 255, 134),
        "variants": [
            {"glow": 1.0},
            {"glow": 1.18, "dy": -1},
            {"glow": 1.28},
        ],
    },
    {
        "base": "prop_reactor_gate",
        "file": "prop_reactor_gate_sheet.png",
        "image": "assets/sprites/73cc31e9-e773-45a7-a02c-b5b7414b01ad.png",
        "region": (44, 70, 620, 410),
        "trim_mode": "alpha",
        "alpha_trim_threshold": 16,
        "fit_w": 148,
        "fit_h": 104,
        "bottom": 149,
        "glow_color": (255, 114, 54),
        "variants": [
            {"glow": 1.0},
            {"glow": 1.16},
        ],
    },
    {
        "base": "prop_reactor_claw",
        "file": "prop_reactor_claw_sheet.png",
        "image": "assets/sprites/73cc31e9-e773-45a7-a02c-b5b7414b01ad.png",
        "region": (628, 18, 1066, 470),
        "trim_mode": "alpha",
        "alpha_trim_threshold": 18,
        "fit_w": 138,
        "fit_h": 120,
        "bottom": 150,
        "glow_color": (255, 214, 82),
        "variants": [
            {"glow": 1.0},
            {"glow": 1.08, "dy": -2},
        ],
    },
    {
        "base": "prop_pipe_cannon",
        "file": "prop_pipe_cannon_sheet.png",
        "image": "assets/sprites/73cc31e9-e773-45a7-a02c-b5b7414b01ad.png",
        "region": (90, 474, 604, 664),
        "trim_mode": "alpha",
        "alpha_trim_threshold": 18,
        "fit_w": 146,
        "fit_h": 72,
        "bottom": 149,
        "variants": [
            {"glow": 1.0},
        ],
    },
    {
        "base": "prop_plasma_turret",
        "file": "prop_plasma_turret_sheet.png",
        "image": "assets/sprites/73cc31e9-e773-45a7-a02c-b5b7414b01ad.png",
        "region": (32, 664, 600, 956),
        "trim_mode": "alpha",
        "alpha_trim_threshold": 18,
        "fit_w": 146,
        "fit_h": 114,
        "bottom": 151,
        "glow_color": (110, 255, 108),
        "variants": [
            {"glow": 1.0},
            {"glow": 1.12},
        ],
    },
]


def clamp_u8(value: float) -> int:
    return max(0, min(255, int(round(value))))


def luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = rgb
    return 0.299 * r + 0.587 * g + 0.114 * b


def saturation(rgb: tuple[int, int, int]) -> int:
    return max(rgb) - min(rgb)


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def edge_reference_colors(img: Image.Image) -> list[tuple[int, int, int]]:
    w, h = img.size
    sample_points = [
        (0, 0),
        (w // 2, 0),
        (w - 1, 0),
        (0, h // 2),
        (w - 1, h // 2),
        (0, h - 1),
        (w // 2, h - 1),
        (w - 1, h - 1),
    ]
    refs = []
    px = img.load()
    for sx, sy in sample_points:
        r, g, b, _ = px[sx, sy]
        refs.append((r, g, b))
    return refs


def remove_border_background(
    img: Image.Image,
    *,
    bg_distance: float = 36,
    dark_threshold: float = 88,
    sat_threshold: float = 64,
    extra_distance: float | None = None,
) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    refs = edge_reference_colors(rgba)
    extra_distance = extra_distance if extra_distance is not None else bg_distance * 1.6
    px = rgba.load()
    visited = [[False] * h for _ in range(w)]
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        rgb = (r, g, b)
        dist = min(color_distance(rgb, ref) for ref in refs)
        lum = luminance(rgb)
        sat = saturation(rgb)
        return dist <= bg_distance or (lum <= dark_threshold and sat <= sat_threshold and dist <= extra_distance)

    for x in range(w):
        for y in (0, h - 1):
            if not visited[x][y] and is_background(x, y):
                visited[x][y] = True
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not visited[x][y] and is_background(x, y):
                visited[x][y] = True
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or visited[nx][ny]:
                continue
            if is_background(nx, ny):
                visited[nx][ny] = True
                queue.append((nx, ny))

    bbox = rgba.getbbox()
    if not bbox:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    return rgba.crop(bbox)


def trim_alpha_bounds(img: Image.Image, threshold: int = 8) -> Image.Image:
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    mask = alpha.point(lambda a: 255 if a > threshold else 0)
    w, h = rgba.size
    px = mask.load()
    visited = [[False] * h for _ in range(w)]
    components: list[tuple[int, tuple[int, int, int, int], list[tuple[int, int]]]] = []

    for y in range(h):
        for x in range(w):
            if visited[x][y]:
                continue
            visited[x][y] = True
            if px[x, y] == 0:
                continue
            q: deque[tuple[int, int]] = deque([(x, y)])
            points: list[tuple[int, int]] = []
            minx = maxx = x
            miny = maxy = y
            while q:
                cx, cy = q.popleft()
                points.append((cx, cy))
                if cx < minx:
                    minx = cx
                if cy < miny:
                    miny = cy
                if cx > maxx:
                    maxx = cx
                if cy > maxy:
                    maxy = cy
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h or visited[nx][ny]:
                        continue
                    visited[nx][ny] = True
                    if px[nx, ny] != 0:
                        q.append((nx, ny))
            components.append((len(points), (minx, miny, maxx + 1, maxy + 1), points))

    if not components:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))

    largest = max(size for size, _, _ in components)
    keep_threshold = max(48, int(largest * 0.012))
    keep_components = [component for component in components if component[0] >= keep_threshold]
    clean = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    src = rgba.load()
    dst = clean.load()
    minx = w
    miny = h
    maxx = 0
    maxy = 0
    for _, bbox, points in keep_components:
        bx0, by0, bx1, by1 = bbox
        if bx0 < minx:
            minx = bx0
        if by0 < miny:
            miny = by0
        if bx1 > maxx:
            maxx = bx1
        if by1 > maxy:
            maxy = by1
        for px_x, px_y in points:
            dst[px_x, px_y] = src[px_x, px_y]

    if minx >= maxx or miny >= maxy:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    return clean.crop((minx, miny, maxx, maxy))


def has_meaningful_alpha(img: Image.Image, threshold: int = 8) -> bool:
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    lo, hi = alpha.getextrema()
    if lo >= threshold or hi <= threshold:
        return False
    w, h = rgba.size
    border_points = [
        (0, 0),
        (w // 2, 0),
        (w - 1, 0),
        (0, h // 2),
        (w - 1, h // 2),
        (0, h - 1),
        (w // 2, h - 1),
        (w - 1, h - 1),
    ]
    border_transparent = sum(1 for point in border_points if alpha.getpixel(point) <= threshold)
    if border_transparent >= 4:
        return True
    transparent = 0
    sample_count = 0
    step_x = max(1, w // 64)
    step_y = max(1, h // 64)
    for y in range(0, h, step_y):
      for x in range(0, w, step_x):
        sample_count += 1
        if alpha.getpixel((x, y)) <= threshold:
          transparent += 1
    return sample_count > 0 and (transparent / sample_count) >= 0.08


def apply_variant(img: Image.Image, variant: dict, pack: dict) -> Image.Image:
    result = img.convert("RGBA")
    brightness = variant.get("brightness", 1.0)
    if abs(brightness - 1.0) > 1e-3:
        alpha = result.getchannel("A")
        rgb = Image.merge("RGB", result.split()[:3])
        rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
        result = Image.merge("RGBA", (*rgb.split(), alpha))

    glow_mul = variant.get("glow", 1.0)
    glow_color = pack.get("glow_color")
    if glow_color and glow_mul > 1.0:
        alpha = result.getchannel("A").filter(ImageFilter.GaussianBlur(radius=8))
        intensity = max(0.0, glow_mul - 1.0)
        glow_alpha = alpha.point(lambda a: clamp_u8(a * 0.34 * intensity))
        glow = Image.new("RGBA", result.size, (*glow_color, 0))
        glow.putalpha(glow_alpha)
        result = Image.alpha_composite(glow, result)
    return result


def fit_into_frame(img: Image.Image, pack: dict, variant: dict) -> Image.Image:
    scale = min(pack["fit_w"] / img.width, pack["fit_h"] / img.height)
    scaled_w = max(1, int(round(img.width * scale)))
    scaled_h = max(1, int(round(img.height * scale)))
    sprite = img.resize((scaled_w, scaled_h), Image.LANCZOS)
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    dx = int(round((FRAME - scaled_w) * 0.5))
    dy = pack["bottom"] - scaled_h + int(variant.get("dy", 0))
    frame.alpha_composite(sprite, (dx, dy))
    return frame


def build_sheet(frames: Iterable[Image.Image]) -> Image.Image:
    frames = list(frames)
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME, 0))
    return sheet


def write_contact_sheet(frames: list[Image.Image], path: Path) -> None:
    cols = min(4, max(1, len(frames)))
    rows = (len(frames) + cols - 1) // cols
    contact = Image.new("RGBA", (cols * FRAME, rows * FRAME), (11, 15, 22, 255))
    for index, frame in enumerate(frames):
        x = (index % cols) * FRAME
        y = (index // cols) * FRAME
        contact.alpha_composite(frame, (x, y))
    path.parent.mkdir(parents=True, exist_ok=True)
    contact.save(path)


def update_manifest(packs: list[dict]) -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    sheets = [entry for entry in manifest.get("sheets", []) if entry.get("base") not in {pack["base"] for pack in packs}]
    for pack in packs:
        sheets.append(
            {
                "base": pack["base"],
                "file": pack["file"],
                "frames": len(pack["variants"]),
                "frame_w": FRAME,
                "frame_h": FRAME,
            }
        )
    manifest["sheets"] = sorted(sheets, key=lambda entry: entry["base"])
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")


def build_pack(pack: dict, overwrite: bool = False) -> None:
    src = Image.open(pack["image"]).convert("RGBA")
    crop = src.crop(pack["region"])
    trim_mode = pack.get("trim_mode", "auto")
    use_alpha_trim = trim_mode == "alpha" or (trim_mode == "auto" and has_meaningful_alpha(crop, threshold=pack.get("alpha_trim_threshold", 8)))
    if use_alpha_trim:
        trimmed = trim_alpha_bounds(crop, threshold=pack.get("alpha_trim_threshold", 8))
    else:
        trimmed = remove_border_background(
            crop,
            bg_distance=pack.get("bg_distance", 36),
            dark_threshold=pack.get("dark_threshold", 88),
            sat_threshold=pack.get("sat_threshold", 64),
            extra_distance=pack.get("extra_distance"),
        )

    frames = []
    for variant in pack["variants"]:
        frame_source = apply_variant(trimmed, variant, pack)
        frames.append(fit_into_frame(frame_source, pack, variant))

    out_path = SHEET_DIR / pack["file"]
    if out_path.exists() and not overwrite:
        raise FileExistsError(f"{out_path} exists (use --overwrite)")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    build_sheet(frames).save(out_path)
    write_contact_sheet(frames, OUTPUT_PREVIEW / pack["file"])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    for pack in PACKS:
        build_pack(pack, overwrite=args.overwrite)
    update_manifest(PACKS)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
