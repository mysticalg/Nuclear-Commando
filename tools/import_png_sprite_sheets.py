#!/usr/bin/env python3
"""
Slice PNG sprite sheets into per-frame PNGs and merge keys into manifest.json.

Usage:
  python tools/import_png_sprite_sheets.py
  python tools/import_png_sprite_sheets.py --overwrite
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import PNG sprite sheets into frame sprites.")
    parser.add_argument(
        "--sheet-dir",
        default="assets/sprites/sheets/png16",
        help="Directory containing sprite sheet PNGs.",
    )
    parser.add_argument(
        "--sheet-manifest",
        default="assets/sprites/sheets/png16/sheet_manifest.json",
        help="Sheet manifest JSON with frame metadata.",
    )
    parser.add_argument(
        "--out",
        default="assets/sprites/png16_frames",
        help="Output directory for sliced frame PNG files.",
    )
    parser.add_argument(
        "--manifest",
        default="assets/sprites/manifest.json",
        help="Game sprite manifest to merge keys into.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing frame files.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def write_manifest_bundle(path: Path, payload: dict) -> None:
    sorted_manifest = dict(sorted(payload.items(), key=lambda item: item[0]))
    save_json(path, sorted_manifest)
    js_path = path.with_suffix(".js")
    js_path.write_text(
        f"window.NUCLEAR_COMMANDO_SPRITE_MANIFEST = {json.dumps(sorted_manifest, indent=2)};\n",
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    sheet_dir = Path(args.sheet_dir).resolve()
    sheet_manifest_path = Path(args.sheet_manifest).resolve()
    out_dir = Path(args.out).resolve()
    manifest_path = Path(args.manifest).resolve()

    sheet_manifest = load_json(sheet_manifest_path)
    sheets = sheet_manifest.get("sheets", [])
    if not sheets:
        raise SystemExit(f"No sheet entries found in {sheet_manifest_path}")

    out_dir.mkdir(parents=True, exist_ok=True)
    game_manifest = load_json(manifest_path)
    rel_base = out_dir.relative_to(manifest_path.parent).as_posix()

    written = 0
    skipped = 0

    for entry in sheets:
        base = entry["base"]
        filename = entry["file"]
        frame_w = int(entry["frame_w"])
        frame_h = int(entry["frame_h"])
        frames = int(entry["frames"])
        source = sheet_dir / filename
        if not source.exists():
            raise FileNotFoundError(f"Sheet missing: {source}")

        sheet_img = Image.open(source).convert("RGBA")
        for idx in range(frames):
            key = f"{base}_{idx}_hd"
            frame_name = f"{key}.png"
            frame_path = out_dir / frame_name
            if frame_path.exists() and not args.overwrite:
                skipped += 1
            else:
                x0 = idx * frame_w
                crop = sheet_img.crop((x0, 0, x0 + frame_w, frame_h))
                crop.save(frame_path, format="PNG")
                written += 1
            game_manifest[key] = f"{rel_base}/{frame_name}"

        # Base key resolves to first frame for compatibility.
        game_manifest[f"{base}_hd"] = f"{rel_base}/{base}_0_hd.png"

    write_manifest_bundle(manifest_path, game_manifest)

    print(f"Sheet manifest: {sheet_manifest_path}")
    print(f"Sheets processed: {len(sheets)}")
    print(f"Frames written: {written}")
    print(f"Frames skipped: {skipped}")
    print(f"Output directory: {out_dir}")
    print(f"Manifest updated: {manifest_path}")


if __name__ == "__main__":
    main()
