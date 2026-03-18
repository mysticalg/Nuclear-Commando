#!/usr/bin/env python3
"""
Generate a SNES-style PNG sprite sheet pack, slice frames, and update manifest.json.

This provides a true PNG sheet workflow:
1) Generate editable sheet PNGs in assets/sprites/sheets/png16
2) Slice sheets into per-frame PNGs in assets/sprites/png16_frames
3) Merge keys into assets/sprites/manifest.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

from PIL import Image, ImageDraw

Color = Tuple[int, int, int, int]
Point = Tuple[int, int]

SCALE = 0.625  # 256 -> 160
FRAME_SIZE = 160


PALETTE = {
    "outline": "#0b1320",
    "playerSuit": "#325eb7",
    "playerSuitDark": "#233f7d",
    "playerSuitLight": "#4f7fd9",
    "playerArmor": "#2a3a58",
    "playerLeg": "#1f2d49",
    "playerBoot": "#101a2a",
    "playerSkin": "#e5edf8",
    "playerSkinShade": "#c4d0de",
    "playerBand": "#d74453",
    "playerGun": "#d3deee",
    "playerGunDark": "#7485a4",
    "eye": "#142033",
    "visor": "#87e4ff",
    "enemyBody": "#cc4d72",
    "enemyBodyDark": "#8a2c48",
    "enemyArmor": "#712a3d",
    "enemyLeg": "#3c1523",
    "enemyBand": "#a4314a",
    "enemyVisor": "#ffd7a1",
    "enemyMech": "#bd5f3f",
    "enemyMechDark": "#6d3527",
    "enemyMechLight": "#df8765",
    "droneBody": "#c58f50",
    "droneDark": "#5f3f27",
    "droneLight": "#ebbf7a",
    "turretBody": "#9853a2",
    "turretDark": "#4f2b59",
    "turretLight": "#be7cc9",
    "objectiveMetal": "#778eb6",
    "objectiveMetalDark": "#495c80",
    "objectiveDark": "#232d3f",
    "objectiveGlow": "#69ddff",
    "objectiveCore": "#f19858",
    "pickupMed": "#67cc86",
    "pickupMedDark": "#1a4f38",
    "pickupSpread": "#f6cf4d",
    "pickupLaser": "#61e7ff",
    "pickupFlame": "#ef8744",
    "fxFlash": "#ffe782",
    "fxFlashHot": "#fff7de",
    "fxExplosion": "#eb8355",
    "fxExplosionCore": "#ffd474",
    "fxSmoke": "#5b4339",
}


def s(v: float) -> int:
    return int(round(v * SCALE))


def rgba(hex_color: str, alpha: int = 255) -> Color:
    if hex_color in PALETTE:
        hex_color = PALETTE[hex_color]
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        raise ValueError(f"Expected 6-char hex, got {hex_color!r}")
    return (int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16), alpha)


def im() -> Image.Image:
    return Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))


def rect(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str | Color) -> None:
    if w <= 0 or h <= 0:
        return
    fill = rgba(color) if isinstance(color, str) else color
    draw.rectangle((x, y, x + w - 1, y + h - 1), fill=fill)


def circle(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: str | Color) -> None:
    if r <= 0:
        return
    fill = rgba(color) if isinstance(color, str) else color
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)


def ellipse(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, color: str | Color) -> None:
    if rx <= 0 or ry <= 0:
        return
    fill = rgba(color) if isinstance(color, str) else color
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=fill)


def poly(draw: ImageDraw.ImageDraw, points: Sequence[Point], color: str | Color) -> None:
    fill = rgba(color) if isinstance(color, str) else color
    draw.polygon(points, fill=fill)


def checker(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    w: int,
    h: int,
    color: str,
    step: int = 3,
    phase: int = 0,
) -> None:
    for yy in range(y, y + h, step):
        for xx in range(x, x + w, step):
            gx = (xx - x) // step
            gy = (yy - y) // step
            if ((gx + gy + phase) & 1) == 0:
                rect(draw, xx, yy, max(1, step - 1), max(1, step - 1), color)


def rivet_row(draw: ImageDraw.ImageDraw, x: int, y: int, count: int, spacing: int, color: str, r: int = 1) -> None:
    for i in range(count):
        circle(draw, x + i * spacing, y, r, color)


def panel_rows(
    draw: ImageDraw.ImageDraw, x: int, y: int, w: int, rows: int, spacing: int, color: str, thickness: int = 1
) -> None:
    for i in range(rows):
        rect(draw, x, y + i * spacing, w, thickness, color)


def bevel(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, base: str, light: str, dark: str, border: str) -> None:
    rect(draw, x, y, w, h, border)
    rect(draw, x + 1, y + 1, max(1, w - 2), max(1, h - 2), base)
    rect(draw, x + 1, y + 1, max(1, w - 2), 1, light)
    rect(draw, x + 1, y + 1, 1, max(1, h - 2), light)
    rect(draw, x + 1, y + h - 2, max(1, w - 2), 1, dark)
    rect(draw, x + w - 2, y + 1, 1, max(1, h - 2), dark)


def draw_player_standing(cfg: Dict[str, int]) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    bob = s(cfg.get("bob", 0))
    leg_l = s(cfg.get("legL", 0))
    leg_r = s(cfg.get("legR", 0))
    arm_l = s(cfg.get("armL", 0))
    arm_r = s(cfg.get("armR", 0))
    gun_kick = s(cfg.get("gunKick", 0))
    lean = s(cfg.get("lean", 0))

    torso_y = s(94) + bob
    head_y = s(68) + bob
    leg_y_l = s(176) + leg_l + bob
    leg_y_r = s(176) + leg_r + bob
    gun_y = s(170) + gun_kick + bob

    bevel(d, s(82) + lean, torso_y - s(2), s(96), s(100), "playerSuit", "playerSuitLight", "playerSuitDark", "outline")
    rect(d, s(90) + lean, torso_y + s(8), s(80), s(24), "playerSuitLight")
    checker(d, s(92) + lean, torso_y + s(10), s(76), s(20), "playerSuit", step=max(2, s(3)), phase=1)
    panel_rows(d, s(96) + lean, torso_y + s(40), s(68), 4, s(6), "playerSuitDark")
    rect(d, s(98) + lean, torso_y + s(64), s(64), s(10), "playerArmor")
    rect(d, s(102) + lean, torso_y + s(72), s(56), s(8), "playerSuitDark")
    rivet_row(d, s(104) + lean, torso_y + s(78), 5, s(12), "playerSuitLight", max(1, s(1.2)))
    bevel(d, s(98) + lean, head_y, s(64), s(38), "playerSkin", "#f5fbff", "playerSkinShade", "outline")
    rect(d, s(92) + lean, head_y - s(8), s(76), s(10), "playerBand")
    rect(d, s(98) + lean, head_y - s(10), s(64), s(2), "outline")
    rect(d, s(96) + lean, head_y + s(8), s(68), s(3), "outline")
    rivet_row(d, s(102) + lean, head_y + s(2), 6, s(10), "playerSuitLight", max(1, s(1.1)))
    bevel(
        d,
        s(74) + lean,
        torso_y + s(10) + arm_l,
        s(16),
        s(64),
        "playerArmor",
        "playerSuitLight",
        "playerSuitDark",
        "outline",
    )
    bevel(
        d,
        s(170) + lean,
        torso_y + s(10) + arm_r,
        s(16),
        s(64),
        "playerArmor",
        "playerSuitLight",
        "playerSuitDark",
        "outline",
    )
    rect(d, s(76) + lean, torso_y + s(18) + arm_l, s(12), s(6), "playerSuitLight")
    rect(d, s(172) + lean, torso_y + s(18) + arm_r, s(12), s(6), "playerSuitLight")
    rect(d, s(76) + lean, torso_y + s(34) + arm_l, s(12), s(6), "playerSuitDark")
    rect(d, s(172) + lean, torso_y + s(34) + arm_r, s(12), s(6), "playerSuitDark")
    bevel(d, s(86) + lean, leg_y_l, s(34), s(66), "playerLeg", "playerSuitLight", "playerBoot", "outline")
    bevel(d, s(136) + lean, leg_y_r, s(34), s(66), "playerLeg", "playerSuitLight", "playerBoot", "outline")
    checker(d, s(90) + lean, leg_y_l + s(4), s(26), s(44), "playerSuitDark", step=max(2, s(3)), phase=0)
    checker(d, s(140) + lean, leg_y_r + s(4), s(26), s(44), "playerSuitDark", step=max(2, s(3)), phase=1)
    panel_rows(d, s(92) + lean, leg_y_l + s(12), s(22), 4, s(9), "playerBoot")
    panel_rows(d, s(142) + lean, leg_y_r + s(12), s(22), 4, s(9), "playerBoot")
    bevel(d, s(78) + lean, s(238), s(52), s(14), "playerBoot", "playerSuitDark", "outline", "outline")
    bevel(d, s(132) + lean, s(238), s(52), s(14), "playerBoot", "playerSuitDark", "outline", "outline")
    rivet_row(d, s(82) + lean, s(244), 8, s(6), "playerArmor", max(1, s(1.0)))
    rivet_row(d, s(136) + lean, s(244), 8, s(6), "playerArmor", max(1, s(1.0)))
    bevel(d, s(154) + lean, gun_y, s(60), s(12), "playerGun", "#f1f7ff", "playerGunDark", "outline")
    rect(d, s(156) + lean, gun_y + s(2), s(56), s(4), "playerGunDark")
    rect(d, s(202) + lean, gun_y + s(2), s(26), s(8), "playerGunDark")
    rivet_row(d, s(162) + lean, gun_y + s(4), 4, s(12), "playerSuitLight", max(1, s(1.0)))
    rect(d, s(108) + lean, head_y + s(16), s(14), s(6), "eye")
    rect(d, s(138) + lean, head_y + s(16), s(14), s(6), "eye")
    rect(d, s(122) + lean, head_y + s(20), s(14), s(4), "visor")
    return img


def draw_player_jump(cfg: Dict[str, int]) -> Image.Image:
    base = draw_player_standing(
        {"bob": cfg.get("bob", 0), "legL": 10, "legR": 10, "armL": -4, "armR": -8, "gunKick": -6, "lean": 0}
    )
    d = ImageDraw.Draw(base)
    bob = s(cfg.get("bob", 0))
    spread = s(cfg.get("spread", 0))
    rect(d, s(92), s(204) + bob, s(30), s(34), "playerLeg")
    rect(d, s(138), s(196) + bob + spread, s(30), s(34), "playerLeg")
    rect(d, s(92), s(228) + bob, s(28), s(10), "playerBoot")
    rect(d, s(140), s(224) + bob + spread, s(28), s(10), "playerBoot")
    return base


def draw_player_crouch(cfg: Dict[str, int]) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    bob = s(cfg.get("bob", 0))
    recoil = s(cfg.get("recoil", 0))
    bevel(d, s(76), s(128) + bob, s(104), s(62), "playerSuit", "playerSuitLight", "playerSuitDark", "outline")
    rect(d, s(84), s(138) + bob, s(88), s(18), "playerSuitLight")
    rect(d, s(86), s(160) + bob, s(84), s(10), "playerSuitDark")
    bevel(d, s(100), s(102) + bob, s(58), s(32), "playerSkin", "#f5fbff", "playerSkinShade", "outline")
    rect(d, s(92), s(94) + bob, s(74), s(9), "playerBand")
    bevel(d, s(74), s(140) + bob + recoil, s(18), s(42), "playerArmor", "playerSuitLight", "playerSuitDark", "outline")
    bevel(d, s(170), s(140) + bob + recoil, s(18), s(42), "playerArmor", "playerSuitLight", "playerSuitDark", "outline")
    bevel(d, s(84), s(186) + bob, s(82), s(40), "playerLeg", "playerSuitLight", "playerBoot", "outline")
    bevel(d, s(80), s(226) + bob, s(52), s(18), "playerBoot", "playerSuitDark", "outline", "outline")
    bevel(d, s(126), s(226) + bob, s(52), s(18), "playerBoot", "playerSuitDark", "outline", "outline")
    bevel(d, s(158), s(166) + bob + recoil, s(68), s(10), "playerGun", "#f1f7ff", "playerGunDark", "outline")
    rect(d, s(210), s(167) + bob + recoil, s(20), s(7), "playerGunDark")
    rect(d, s(108), s(118) + bob, s(14), s(5), "eye")
    rect(d, s(136), s(118) + bob, s(14), s(5), "eye")
    rect(d, s(122), s(122) + bob, s(14), s(4), "visor")
    return img


def draw_player_roll(idx: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    centers = [
        {"x": 128, "y": 180},
        {"x": 132, "y": 176},
        {"x": 128, "y": 172},
        {"x": 124, "y": 176},
    ]
    c = centers[idx % len(centers)]
    x = s(c["x"])
    y = s(c["y"])
    ellipse(d, x, y, s(84), s(46), "playerLeg")
    ellipse(d, x, y, s(66), s(34), "playerSuit")
    ellipse(d, x + s(8), y - s(8), s(30), s(20), "playerSkin")
    ellipse(d, x + s(8), y + s(2), s(30), s(10), "playerSkinShade")
    poly(
        d,
        [
            (x - s(32), y - s(28)),
            (x + s(38), y - s(22)),
            (x + s(30), y - s(12)),
            (x - s(36), y - s(18)),
        ],
        "playerBand",
    )
    bevel(d, x + s(40), y - s(10), s(42), s(10), "playerGun", "#f1f7ff", "playerGunDark", "outline")
    rect(d, x + s(72), y - s(9), s(18), s(6), "playerGunDark")
    rect(d, x + s(10), y - s(12), s(10), s(4), "eye")
    rect(d, x + s(2), y + s(4), s(30), s(6), "playerSuitDark")
    return img

def draw_trooper(cfg: Dict[str, int]) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    bob = s(cfg.get("bob", 0))
    leg_l = s(cfg.get("legL", 0))
    leg_r = s(cfg.get("legR", 0))
    gun_kick = s(cfg.get("gunKick", 0))
    bevel(d, s(78), s(90) + bob, s(100), s(102), "enemyBody", "#de6f90", "enemyBodyDark", "outline")
    rect(d, s(86), s(100) + bob, s(84), s(18), "enemyBodyDark")
    checker(d, s(88), s(102) + bob, s(80), s(14), "enemyBody", step=max(2, s(3)), phase=1)
    panel_rows(d, s(94), s(122) + bob, s(68), 4, s(8), "enemyBodyDark")
    bevel(d, s(98), s(64) + bob, s(60), s(36), "playerSkin", "#f6fbff", "playerSkinShade", "outline")
    rect(d, s(94), s(58) + bob, s(68), s(8), "enemyBand")
    rivet_row(d, s(102), s(60) + bob, 5, s(12), "enemyBodyDark", max(1, s(1.0)))
    bevel(d, s(74), s(104) + bob, s(18), s(66), "enemyArmor", "enemyBody", "enemyBodyDark", "outline")
    bevel(d, s(172), s(104) + bob, s(18), s(66), "enemyArmor", "enemyBody", "enemyBodyDark", "outline")
    bevel(d, s(90), s(182) + leg_l + bob, s(34), s(62), "enemyLeg", "enemyBody", "enemyArmor", "outline")
    bevel(d, s(132), s(182) + leg_r + bob, s(34), s(62), "enemyLeg", "enemyBody", "enemyArmor", "outline")
    checker(d, s(94), s(186) + leg_l + bob, s(26), s(42), "enemyArmor", step=max(2, s(3)), phase=0)
    checker(d, s(136), s(186) + leg_r + bob, s(26), s(42), "enemyArmor", step=max(2, s(3)), phase=1)
    bevel(d, s(86), s(238), s(50), s(14), "enemyArmor", "enemyBody", "outline", "outline")
    bevel(d, s(128), s(238), s(50), s(14), "enemyArmor", "enemyBody", "outline", "outline")
    rivet_row(d, s(90), s(244), 6, s(6), "enemyArmor", max(1, s(1.0)))
    rivet_row(d, s(132), s(244), 6, s(6), "enemyArmor", max(1, s(1.0)))
    bevel(d, s(148), s(152) + gun_kick + bob, s(64), s(12), "playerGun", "#f0f5ff", "playerGunDark", "outline")
    rect(d, s(202), s(154) + gun_kick + bob, s(20), s(8), "playerGunDark")
    rect(d, s(116), s(82) + bob, s(24), s(6), "enemyVisor")
    return img


def draw_drone(rotor_state: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    rotor_y = [86, 82, 90, 84][rotor_state % 4]
    wing_w = [30, 38, 22, 34][rotor_state % 4]
    ellipse(d, s(128), s(130), s(88), s(46), "outline")
    ellipse(d, s(128), s(130), s(82), s(42), "droneBody")
    rect(d, s(56), s(122), s(144), s(12), "droneDark")
    rect(d, s(84), s(96), s(88), s(22), "droneLight")
    rect(d, s(68), s(rotor_y), s(wing_w), s(6), "playerGun")
    rect(d, s(188 - wing_w), s(rotor_y), s(wing_w), s(6), "playerGun")
    rect(d, s(62), s(140), s(132), s(12), "droneDark")
    rect(d, s(114), s(154), s(28), s(14), "enemyBodyDark")
    circle(d, s(92), s(130), s(8), "objectiveGlow")
    circle(d, s(164), s(130), s(8), "objectiveGlow")
    return img


def draw_turret(recoil: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    bevel(d, s(68), s(126), s(120), s(94), "turretBody", "turretLight", "turretDark", "outline")
    bevel(d, s(86), s(98), s(84), s(40), "turretDark", "turretLight", "outline", "outline")
    bevel(d, s(164 + recoil), s(112), s(58), s(12), "playerGun", "#f1f7ff", "playerGunDark", "outline")
    rect(d, s(208 + recoil), s(114), s(18), s(8), "playerGunDark")
    rect(d, s(92), s(216), s(76), s(24), "turretDark")
    rect(d, s(112), s(108), s(34), s(10), "objectiveGlow")
    circle(d, s(126), s(176), s(8), "outline")
    return img


def draw_mech(cfg: Dict[str, int]) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    leg_l = s(cfg.get("legL", 0))
    leg_r = s(cfg.get("legR", 0))
    bob = s(cfg.get("bob", 0))
    bevel(d, s(66), s(74) + bob, s(124), s(122), "enemyMech", "enemyMechLight", "enemyMechDark", "outline")
    rect(d, s(76), s(86) + bob, s(104), s(18), "enemyMechLight")
    checker(d, s(80), s(88) + bob, s(96), s(14), "enemyMech", step=max(2, s(3)), phase=1)
    panel_rows(d, s(82), s(112) + bob, s(92), 5, s(7), "enemyMechDark")
    rect(d, s(92), s(98) + bob, s(72), s(48), "enemyMechDark")
    rect(d, s(96), s(104) + bob, s(64), s(8), "enemyMech")
    rect(d, s(96), s(116) + bob, s(64), s(4), "enemyMechLight")
    rivet_row(d, s(98), s(130) + bob, 6, s(10), "enemyMechLight", max(1, s(1.1)))
    bevel(d, s(54), s(94) + bob, s(20), s(84), "enemyMechDark", "enemyMechLight", "enemyMechDark", "outline")
    bevel(d, s(186), s(94) + bob, s(20), s(84), "enemyMechDark", "enemyMechLight", "enemyMechDark", "outline")
    bevel(d, s(74), s(194) + leg_l + bob, s(44), s(54), "enemyMechDark", "enemyMechLight", "outline", "outline")
    bevel(d, s(138), s(194) + leg_r + bob, s(44), s(54), "enemyMechDark", "enemyMechLight", "outline", "outline")
    checker(d, s(78), s(198) + leg_l + bob, s(36), s(38), "enemyMech", step=max(2, s(3)), phase=0)
    checker(d, s(142), s(198) + leg_r + bob, s(36), s(38), "enemyMech", step=max(2, s(3)), phase=1)
    bevel(d, s(184), s(126) + bob, s(44), s(16), "playerGun", "#f1f7ff", "playerGunDark", "outline")
    rect(d, s(214), s(128) + bob, s(16), s(10), "playerGunDark")
    rect(d, s(114), s(118) + bob, s(10), s(6), "eye")
    rect(d, s(142), s(118) + bob, s(10), s(6), "eye")
    rect(d, s(122), s(124) + bob, s(22), s(4), "objectiveGlow")
    return img


def draw_objective_centrifuge(pulse: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    glow = s(16 + pulse * 4)
    bevel(d, s(54), s(40), s(148), s(188), "objectiveMetal", "#9cb4d6", "objectiveMetalDark", "outline")
    rect(d, s(62), s(50), s(132), s(14), "objectiveMetalDark")
    bevel(d, s(82), s(68), s(92), s(132), "#d3deea", "#e9f3ff", "#91a2be", "objectiveMetalDark")
    rect(d, s(92), s(74), s(72), s(8), "objectiveMetalDark")
    checker(d, s(84), s(76), s(88), s(120), "objectiveMetal", step=max(2, s(4)), phase=0)
    panel_rows(d, s(86), s(84), s(84), 10, s(10), "objectiveMetalDark")
    rect(d, s(116), s(80), s(24), s(108), "objectiveDark")
    rivet_row(d, s(98), s(84), 3, s(20), "objectiveMetalDark", max(1, s(1.1)))
    rivet_row(d, s(154), s(84), 3, s(20), "objectiveMetalDark", max(1, s(1.1)))
    circle(d, s(128), s(128), glow, rgba(PALETTE["objectiveGlow"], 180))
    circle(d, s(128), s(128), s(8 + pulse * 2), "#dcfbff")
    return img


def draw_objective_factory(pulse: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    bevel(d, s(40), s(82), s(176), s(148), "objectiveMetal", "#9eb4cf", "objectiveMetalDark", "outline")
    rect(d, s(50), s(92), s(156), s(14), "objectiveMetalDark")
    rect(d, s(66), s(58), s(42), s(36), "objectiveDark")
    rect(d, s(118), s(50), s(38), s(44), "objectiveDark")
    rect(d, s(168), s(62), s(32), s(32), "objectiveDark")
    rect(d, s(58), s(110), s(140), s(24), "#d5dfeb")
    rect(d, s(58), s(146), s(140), s(24), "#cad6e4")
    rect(d, s(58), s(182), s(140), s(24), "#becbda")
    rect(d, s(184), s(38), s(18), s(26), "objectiveMetalDark")
    rect(d, s(184), s(22), s(12), s(16), "objectiveCore")
    alpha = int(120 + pulse * 60)
    ellipse(d, s(190), s(18), s(14), s(9), rgba(PALETTE["objectiveCore"], alpha))
    return img


def draw_objective_reactor(pulse: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    glow = s(42 + pulse * 10)
    bevel(d, s(48), s(26), s(160), s(206), "objectiveDark", "#2f3f58", "#141b24", "outline")
    bevel(d, s(76), s(54), s(104), s(148), "objectiveMetal", "#a6bad6", "objectiveMetalDark", "outline")
    rect(d, s(80), s(60), s(96), s(10), "objectiveMetalDark")
    checker(d, s(82), s(72), s(92), s(124), "objectiveMetalDark", step=max(2, s(4)), phase=1)
    panel_rows(d, s(84), s(82), s(88), 8, s(12), "objectiveMetal")
    rivet_row(d, s(88), s(66), 8, s(10), "objectiveMetal", max(1, s(1.0)))
    circle(d, s(128), s(128), glow, rgba(PALETTE["objectiveGlow"], 158))
    circle(d, s(128), s(128), s(22 + pulse * 3), "#ecfcff")
    rect(d, s(86), s(20), s(84), s(10), "objectiveCore")
    rect(d, s(110), s(6), s(36), s(14), "objectiveCore")
    return img


def draw_objective_radar(pulse: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    beam_x = s(164 + pulse * 12)
    bevel(d, s(66), s(128), s(124), s(112), "objectiveMetal", "#a5b9d7", "objectiveMetalDark", "outline")
    rect(d, s(80), s(220), s(96), s(18), "objectiveDark")
    circle(d, s(128), s(98), s(54), "#dde8f5")
    circle(d, s(128), s(98), s(48), "objectiveDark")
    circle(d, s(128), s(98), s(40), "#273241")
    poly(d, [(s(128), s(98)), (beam_x, s(86)), (beam_x, s(110))], "objectiveGlow")
    circle(d, s(128), s(98), s(10), "#edfaff")
    return img

def draw_pickup(kind: str, pulse: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    glow_alpha = int(70 + pulse * 50)
    if kind == "med":
        bevel(d, s(68), s(68), s(120), s(120), "pickupMed", "#9dffc3", "pickupMedDark", "outline")
        rect(d, s(112), s(90), s(32), s(76), "pickupMedDark")
        rect(d, s(90), s(112), s(76), s(32), "pickupMedDark")
        checker(d, s(76), s(76), s(104), s(104), "pickupMedDark", step=max(2, s(4)))
        circle(d, s(128), s(128), s(44), rgba(PALETTE["pickupMed"], glow_alpha))
        return img
    if kind == "spread":
        bevel(d, s(68), s(68), s(120), s(120), "pickupSpread", "#fff29a", "#a58629", "outline")
        rect(d, s(86), s(86), s(84), s(84), "#212838")
        checker(d, s(90), s(90), s(76), s(76), "#1a2638", step=max(2, s(4)), phase=1)
        rect(d, s(96), s(112), s(64), s(12), "pickupSpread")
        rect(d, s(96), s(132), s(64), s(12), "pickupSpread")
        rect(d, s(108), s(96), s(40), s(10), "pickupSpread")
        circle(d, s(128), s(128), s(44), rgba(PALETTE["pickupSpread"], glow_alpha))
        return img
    if kind == "laser":
        bevel(d, s(68), s(68), s(120), s(120), "pickupLaser", "#ccfbff", "#2688a4", "outline")
        rect(d, s(86), s(86), s(84), s(84), "#212838")
        checker(d, s(90), s(90), s(76), s(76), "#182334", step=max(2, s(4)))
        rect(d, s(106), s(96), s(44), s(64), "pickupLaser")
        rect(d, s(96), s(128), s(64), s(10), "#b6f7ff")
        rect(d, s(112), s(86), s(32), s(8), "#dffcff")
        circle(d, s(128), s(128), s(44), rgba(PALETTE["pickupLaser"], glow_alpha))
        return img
    bevel(d, s(68), s(68), s(120), s(120), "pickupFlame", "#ffb37f", "#8f3f1a", "outline")
    rect(d, s(86), s(86), s(84), s(84), "#212838")
    checker(d, s(90), s(90), s(76), s(76), "#1f2838", step=max(2, s(4)), phase=1)
    poly(
        d,
        [(s(128), s(94)), (s(152), s(130)), (s(140), s(166)), (s(116), s(166)), (s(104), s(130))],
        "pickupFlame",
    )
    poly(
        d,
        [(s(128), s(104)), (s(142), s(130)), (s(134), s(154)), (s(122), s(154)), (s(114), s(130))],
        "#ffd79f",
    )
    circle(d, s(128), s(128), s(44), rgba(PALETTE["pickupFlame"], glow_alpha))
    return img


def draw_muzzle(idx: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    stars = [
        [(128, 70), (142, 104), (184, 106), (150, 128), (164, 170), (128, 146), (92, 170), (106, 128), (72, 106), (114, 104)],
        [(128, 58), (146, 102), (198, 108), (156, 136), (170, 194), (128, 160), (86, 194), (100, 136), (58, 108), (110, 102)],
        [(128, 76), (140, 108), (170, 110), (146, 128), (156, 162), (128, 144), (100, 162), (110, 128), (86, 110), (116, 108)],
    ][idx % 3]
    glow = [30, 40, 24][idx % 3]
    core = [14, 20, 10][idx % 3]
    circle(d, s(128), s(128), s(glow), rgba(PALETTE["fxFlash"], 130))
    poly(d, [(s(x), s(y)) for x, y in stars], "fxFlash")
    circle(d, s(128), s(128), s(core), "fxFlashHot")
    return img


def draw_explosion(idx: int) -> Image.Image:
    img = im()
    d = ImageDraw.Draw(img)
    rings = [
        {"outer": 28, "mid": 16, "core": 8, "alpha": 0.90},
        {"outer": 42, "mid": 24, "core": 12, "alpha": 0.85},
        {"outer": 58, "mid": 34, "core": 18, "alpha": 0.80},
        {"outer": 70, "mid": 44, "core": 24, "alpha": 0.72},
        {"outer": 78, "mid": 52, "core": 28, "alpha": 0.64},
        {"outer": 84, "mid": 58, "core": 30, "alpha": 0.52},
    ]
    ring = rings[max(0, min(len(rings) - 1, idx))]
    circle(d, s(128), s(128), s(ring["outer"]), rgba(PALETTE["fxExplosion"], int(255 * ring["alpha"])))
    circle(d, s(128), s(128), s(ring["mid"]), rgba(PALETTE["fxExplosionCore"], int(255 * min(1.0, ring["alpha"] + 0.08))))
    circle(d, s(86), s(94), s(20), rgba(PALETTE["fxSmoke"], 140))
    circle(d, s(170), s(102), s(16), rgba(PALETTE["fxSmoke"], 120))
    circle(d, s(98), s(168), s(22), rgba(PALETTE["fxSmoke"], 130))
    circle(d, s(160), s(170), s(18), rgba(PALETTE["fxSmoke"], 115))
    poly(
        d,
        [(s(128), s(72)), (s(142), s(106)), (s(178), s(108)), (s(148), s(130)), (s(158), s(164)), (s(128), s(144)), (s(98), s(164)), (s(108), s(130)), (s(78), s(108)), (s(114), s(106))],
        rgba("#fff4cc", 220),
    )
    circle(d, s(128), s(128), s(ring["core"]), rgba("#fff8d2", 235))
    return img


def build_sets() -> Dict[str, List[Image.Image]]:
    return {
        "player_idle": [
            draw_player_standing({"bob": 0, "legL": 2, "legR": 0}),
            draw_player_standing({"bob": -1, "legL": 1, "legR": 1, "gunKick": -1}),
            draw_player_standing({"bob": 0, "legL": 0, "legR": 2}),
            draw_player_standing({"bob": 1, "legL": 1, "legR": 0, "gunKick": 1}),
            draw_player_standing({"bob": 0, "legL": 2, "legR": 1, "armL": -1, "armR": 1}),
            draw_player_standing({"bob": -1, "legL": 1, "legR": 2, "gunKick": -1}),
        ],
        "player_run": [
            draw_player_standing({"bob": 0, "legL": -8, "legR": 10, "armL": -4, "armR": 6, "gunKick": -2, "lean": 0}),
            draw_player_standing({"bob": -1, "legL": -4, "legR": 6, "armL": -2, "armR": 4, "gunKick": -1, "lean": 1}),
            draw_player_standing({"bob": -2, "legL": 2, "legR": 0, "armL": 0, "armR": 2, "gunKick": 0, "lean": 2}),
            draw_player_standing({"bob": -1, "legL": 8, "legR": -6, "armL": 5, "armR": -3, "gunKick": 1, "lean": 1}),
            draw_player_standing({"bob": 0, "legL": 2, "legR": -2, "armL": 2, "armR": -1, "gunKick": 0, "lean": 0}),
            draw_player_standing({"bob": 1, "legL": -4, "legR": 4, "armL": -1, "armR": 1, "gunKick": -1, "lean": -1}),
            draw_player_standing({"bob": 1, "legL": -9, "legR": 9, "armL": -4, "armR": 6, "gunKick": -2, "lean": -1}),
            draw_player_standing({"bob": 0, "legL": -6, "legR": 6, "armL": -2, "armR": 4, "gunKick": -1, "lean": -1}),
        ],
        "player_jump": [draw_player_jump({"bob": -6, "spread": -2}), draw_player_jump({"bob": -3, "spread": 2})],
        "player_crouch": [draw_player_crouch({"bob": 0, "recoil": 0}), draw_player_crouch({"bob": -1, "recoil": -2})],
        "player_roll": [draw_player_roll(0), draw_player_roll(1), draw_player_roll(2), draw_player_roll(3)],
        "enemy_trooper": [
            draw_trooper({"legL": -6, "legR": 8, "gunKick": -2}),
            draw_trooper({"legL": -2, "legR": 4, "gunKick": -1, "bob": -1}),
            draw_trooper({"legL": 6, "legR": -4, "gunKick": 1}),
            draw_trooper({"legL": 2, "legR": -2, "gunKick": 0, "bob": 1}),
            draw_trooper({"legL": -4, "legR": 6, "gunKick": -1}),
            draw_trooper({"legL": 0, "legR": 2, "gunKick": 0, "bob": -1}),
        ],
        "enemy_drone": [draw_drone(0), draw_drone(1), draw_drone(2), draw_drone(3)],
        "enemy_turret": [draw_turret(0), draw_turret(-10), draw_turret(-4)],
        "enemy_mech": [
            draw_mech({"legL": -8, "legR": 8}),
            draw_mech({"legL": -2, "legR": 4, "bob": -1}),
            draw_mech({"legL": 8, "legR": -6}),
            draw_mech({"legL": 2, "legR": -2, "bob": 1}),
            draw_mech({"legL": -6, "legR": 6, "bob": 0}),
            draw_mech({"legL": -1, "legR": 3, "bob": -1}),
        ],
        "objective_centrifuge": [draw_objective_centrifuge(0), draw_objective_centrifuge(1)],
        "objective_factory": [draw_objective_factory(0), draw_objective_factory(1)],
        "objective_reactor": [draw_objective_reactor(0), draw_objective_reactor(1), draw_objective_reactor(2)],
        "objective_radar": [draw_objective_radar(0), draw_objective_radar(1)],
        "pickup_med": [draw_pickup("med", 0), draw_pickup("med", 1), draw_pickup("med", 2)],
        "pickup_spread": [draw_pickup("spread", 0), draw_pickup("spread", 1), draw_pickup("spread", 2)],
        "pickup_laser": [draw_pickup("laser", 0), draw_pickup("laser", 1), draw_pickup("laser", 2)],
        "pickup_flame": [draw_pickup("flame", 0), draw_pickup("flame", 1), draw_pickup("flame", 2)],
        "fx_muzzle_flash": [draw_muzzle(0), draw_muzzle(1), draw_muzzle(2)],
        "fx_explosion": [
            draw_explosion(0),
            draw_explosion(1),
            draw_explosion(2),
            draw_explosion(3),
            draw_explosion(4),
            draw_explosion(5),
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate PNG sprite sheets + frame atlas.")
    parser.add_argument("--sheet-dir", default="assets/sprites/sheets/png16", help="Output directory for sheet PNGs.")
    parser.add_argument(
        "--sheet-manifest",
        default="assets/sprites/sheets/png16/sheet_manifest.json",
        help="Output sheet manifest JSON.",
    )
    parser.add_argument("--frames-dir", default="assets/sprites/png16_frames", help="Output directory for frame PNGs.")
    parser.add_argument("--manifest", default="assets/sprites/manifest.json", help="Game sprite manifest to merge keys into.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing sheet/frame files.")
    parser.add_argument("--no-import", action="store_true", help="Generate sheets only (skip slicing + manifest merge).")
    return parser.parse_args()


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def write_manifest_bundle(path: Path, payload: dict) -> None:
    sorted_manifest = dict(sorted(payload.items(), key=lambda item: item[0]))
    write_json(path, sorted_manifest)
    js_path = path.with_suffix(".js")
    js_path.write_text(
        f"window.NUCLEAR_COMMANDO_SPRITE_MANIFEST = {json.dumps(sorted_manifest, indent=2)};\n",
        encoding="utf-8",
    )


def build_sheets(sets: Dict[str, List[Image.Image]], sheet_dir: Path, overwrite: bool) -> List[dict]:
    sheet_dir.mkdir(parents=True, exist_ok=True)
    entries: List[dict] = []
    for base, frames in sets.items():
        if not frames:
            continue
        fw, fh = frames[0].size
        sheet = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
        for idx, frame in enumerate(frames):
            sheet.paste(frame, (idx * fw, 0), frame)
        filename = f"{base}_sheet.png"
        target = sheet_dir / filename
        if overwrite or not target.exists():
            sheet.save(target, format="PNG")
        entries.append({"base": base, "file": filename, "frames": len(frames), "frame_w": fw, "frame_h": fh})
    return entries


def slice_and_merge(sheet_dir: Path, entries: Sequence[dict], frames_dir: Path, manifest_path: Path, overwrite: bool) -> Tuple[int, int]:
    frames_dir.mkdir(parents=True, exist_ok=True)
    game_manifest = load_json(manifest_path)
    rel_base = frames_dir.relative_to(manifest_path.parent).as_posix()
    written = 0
    skipped = 0

    for entry in entries:
        base = entry["base"]
        sheet_path = sheet_dir / entry["file"]
        frame_w = int(entry["frame_w"])
        frame_h = int(entry["frame_h"])
        frame_count = int(entry["frames"])
        sheet_img = Image.open(sheet_path).convert("RGBA")

        for idx in range(frame_count):
            key = f"{base}_{idx}_hd"
            frame_name = f"{key}.png"
            frame_path = frames_dir / frame_name
            if frame_path.exists() and not overwrite:
                skipped += 1
            else:
                x0 = idx * frame_w
                frame_img = sheet_img.crop((x0, 0, x0 + frame_w, frame_h))
                frame_img.save(frame_path, format="PNG")
                written += 1
            game_manifest[key] = f"{rel_base}/{frame_name}"
        game_manifest[f"{base}_hd"] = f"{rel_base}/{base}_0_hd.png"

    write_manifest_bundle(manifest_path, game_manifest)
    return written, skipped


def main() -> None:
    args = parse_args()
    sheet_dir = Path(args.sheet_dir).resolve()
    sheet_manifest_path = Path(args.sheet_manifest).resolve()
    frames_dir = Path(args.frames_dir).resolve()
    manifest_path = Path(args.manifest).resolve()

    sets = build_sets()
    entries = build_sheets(sets, sheet_dir, overwrite=args.overwrite)

    sheet_manifest = {
        "version": 1,
        "format": "png-sheet-strip",
        "frame_size": [FRAME_SIZE, FRAME_SIZE],
        "sheets": entries,
    }
    write_json(sheet_manifest_path, sheet_manifest)

    print(f"Sheet directory: {sheet_dir}")
    print(f"Sheet manifest: {sheet_manifest_path}")
    print(f"Sheets written: {len(entries)}")

    if not args.no_import:
        written, skipped = slice_and_merge(sheet_dir, entries, frames_dir, manifest_path, overwrite=args.overwrite)
        print(f"Frame output: {frames_dir}")
        print(f"Frames written: {written}")
        print(f"Frames skipped: {skipped}")
        print(f"Manifest updated: {manifest_path}")
    else:
        print("Import step skipped (--no-import).")


if __name__ == "__main__":
    main()
