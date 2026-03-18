#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { writeManifestBundle } from "./write_sprite_manifest_bundle.mjs";

const SNES16 = {
  outline: "#0b1320",
  playerSuit: "#325eb7",
  playerSuitDark: "#233f7d",
  playerSuitLight: "#4f7fd9",
  playerArmor: "#2a3a58",
  playerLeg: "#1f2d49",
  playerBoot: "#101a2a",
  playerSkin: "#e5edf8",
  playerSkinShade: "#c4d0de",
  playerBand: "#d74453",
  playerGun: "#d3deee",
  playerGunDark: "#7485a4",
  eye: "#142033",
  visor: "#87e4ff",
  enemyBody: "#cc4d72",
  enemyBodyDark: "#8a2c48",
  enemyArmor: "#712a3d",
  enemyLeg: "#3c1523",
  enemyBand: "#a4314a",
  enemyVisor: "#ffd7a1",
  enemyMech: "#bd5f3f",
  enemyMechDark: "#6d3527",
  enemyMechLight: "#df8765",
  droneBody: "#c58f50",
  droneDark: "#5f3f27",
  droneLight: "#ebbf7a",
  turretBody: "#9853a2",
  turretDark: "#4f2b59",
  turretLight: "#be7cc9",
  objectiveMetal: "#778eb6",
  objectiveMetalDark: "#495c80",
  objectiveDark: "#232d3f",
  objectiveGlow: "#69ddff",
  objectiveCore: "#f19858",
  pickupMed: "#67cc86",
  pickupMedDark: "#1a4f38",
  pickupSpread: "#f6cf4d",
  pickupLaser: "#61e7ff",
  pickupFlame: "#ef8744",
  fxFlash: "#ffe782",
  fxFlashHot: "#fff7de",
  fxExplosion: "#eb8355",
  fxExplosionCore: "#ffd474",
  fxSmoke: "#5b4339",
};

const STYLE_PRESETS = {
  snes16: { ...SNES16 },
  military: {
    ...SNES16,
    playerSuit: "#3d69c8",
    playerSuitDark: "#2e4c93",
    playerSuitLight: "#5d8ee0",
    playerBand: "#f24f4f",
    enemyBody: "#d6586f",
    enemyBodyDark: "#8a3346",
    turretBody: "#b55f8a",
    turretLight: "#d483aa",
    objectiveMetal: "#7d93ad",
    objectiveMetalDark: "#596d87",
  },
  gritty: {
    ...SNES16,
    playerSuit: "#54626b",
    playerSuitDark: "#374049",
    playerSuitLight: "#6d7d87",
    playerBand: "#9b4f4f",
    playerGun: "#a8b2bf",
    playerGunDark: "#62707c",
    enemyBody: "#87555a",
    enemyBodyDark: "#593338",
    enemyArmor: "#4a2a2e",
    enemyLeg: "#2b1719",
    enemyBand: "#6f3538",
    enemyMech: "#a0735f",
    enemyMechDark: "#55382f",
    enemyMechLight: "#be8c73",
    droneBody: "#8f744f",
    droneLight: "#c09f72",
    turretBody: "#766177",
    turretDark: "#423544",
    turretLight: "#99859a",
    objectiveMetal: "#707d8e",
    objectiveMetalDark: "#4b5460",
    objectiveGlow: "#91afba",
    objectiveCore: "#ca7c4e",
    pickupMed: "#5ba17a",
    pickupSpread: "#bfa042",
    pickupLaser: "#5ab2c2",
    pickupFlame: "#bc6f3d",
    fxExplosion: "#cc7954",
    fxExplosionCore: "#deb46a",
  },
  neon: {
    ...SNES16,
    playerSuit: "#2d67ff",
    playerSuitDark: "#143695",
    playerSuitLight: "#4f8fff",
    playerBand: "#ff3c70",
    playerGun: "#dbebff",
    playerGunDark: "#73a7ff",
    enemyBody: "#ef4f9a",
    enemyBodyDark: "#7f1f50",
    enemyArmor: "#5f1940",
    enemyLeg: "#381327",
    enemyBand: "#ff6ca8",
    enemyMech: "#ff7f4f",
    enemyMechDark: "#7e3120",
    enemyMechLight: "#ffac85",
    droneBody: "#ffc95a",
    droneDark: "#6f4a18",
    droneLight: "#ffe091",
    turretBody: "#dc66f4",
    turretDark: "#5d2d74",
    turretLight: "#f397ff",
    objectiveMetal: "#738cff",
    objectiveMetalDark: "#3f4aa4",
    objectiveDark: "#1b1f4f",
    objectiveGlow: "#51f2ff",
    objectiveCore: "#ffa356",
    pickupMed: "#63f7a0",
    pickupSpread: "#ffe664",
    pickupLaser: "#63f1ff",
    pickupFlame: "#ff9854",
    fxExplosion: "#ff9266",
    fxExplosionCore: "#ffe77b",
  },
};

function parseArgs(argv) {
  const args = {
    out: "assets/sprites/local_svg",
    manifest: "assets/sprites/manifest.json",
    style: "snes16",
    overwrite: false,
    listStyles: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--out" && next) {
      args.out = next;
      i += 1;
    } else if (arg === "--manifest" && next) {
      args.manifest = next;
      i += 1;
    } else if (arg === "--style" && next) {
      args.style = next.toLowerCase();
      i += 1;
    } else if (arg === "--overwrite") {
      args.overwrite = true;
    } else if (arg === "--list-styles") {
      args.listStyles = true;
    }
  }

  return args;
}

function svgDoc(parts) {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 256 256\" shape-rendering=\"crispEdges\">",
    ...parts,
    "</svg>",
    "",
  ].join("\n");
}

function rect(x, y, w, h, fill, extra = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra} />`;
}

function circle(cx, cy, r, fill, extra = "") {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra} />`;
}

function ellipse(cx, cy, rx, ry, fill, extra = "") {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${extra} />`;
}

function polygon(points, fill, extra = "") {
  return `<polygon points="${points}" fill="${fill}"${extra} />`;
}

function checker(x, y, w, h, color, step = 4, phase = 0) {
  const out = [];
  for (let yy = y; yy < y + h; yy += step) {
    for (let xx = x; xx < x + w; xx += step) {
      const gx = Math.floor((xx - x) / step);
      const gy = Math.floor((yy - y) / step);
      if (((gx + gy + phase) & 1) === 0) {
        out.push(rect(xx, yy, Math.max(1, step - 2), Math.max(1, step - 2), color));
      }
    }
  }
  return out;
}

function rivetRow(x, y, count, spacing, color, r = 1.5) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(circle(x + i * spacing, y, r, color));
  }
  return out;
}

function panelRows(x, y, w, rows, spacing, color, thickness = 1) {
  const out = [];
  for (let i = 0; i < rows; i += 1) {
    out.push(rect(x, y + i * spacing, w, thickness, color));
  }
  return out;
}

function bevelRect(x, y, w, h, base, light, dark, border = null) {
  const outline = border || dark;
  const ix = x + 1;
  const iy = y + 1;
  const iw = Math.max(1, w - 2);
  const ih = Math.max(1, h - 2);
  return [
    rect(x, y, w, h, outline),
    rect(ix, iy, iw, ih, base),
    rect(ix, iy, iw, 1, light),
    rect(ix, iy, 1, ih, light),
    rect(ix, y + h - 2, iw, 1, dark),
    rect(x + w - 2, iy, 1, ih, dark),
  ];
}

function playerStandingFrame(p, cfg = {}) {
  const bob = cfg.bob || 0;
  const legL = cfg.legL || 0;
  const legR = cfg.legR || 0;
  const armL = cfg.armL || 0;
  const armR = cfg.armR || 0;
  const gunKick = cfg.gunKick || 0;
  const lean = cfg.lean || 0;
  const torsoY = 94 + bob;
  const headY = 68 + bob;
  const legYL = 176 + legL + bob;
  const legYR = 176 + legR + bob;
  const gunY = 170 + gunKick + bob;

  return [
    ...bevelRect(82 + lean, torsoY - 2, 96, 100, p.playerSuit, p.playerSuitLight, p.playerSuitDark, p.outline),
    rect(90 + lean, torsoY + 8, 80, 24, p.playerSuitLight),
    ...checker(92 + lean, torsoY + 10, 76, 20, p.playerSuit, 3, 1),
    ...panelRows(96 + lean, torsoY + 40, 68, 4, 6, p.playerSuitDark),
    rect(98 + lean, torsoY + 64, 64, 10, p.playerArmor),
    rect(102 + lean, torsoY + 72, 56, 8, p.playerSuitDark),
    ...rivetRow(104 + lean, torsoY + 78, 5, 12, p.playerSuitLight, 1.1),
    ...bevelRect(98 + lean, headY, 64, 38, p.playerSkin, "#f5fbff", p.playerSkinShade, p.outline),
    rect(92 + lean, headY - 8, 76, 10, p.playerBand),
    rect(98 + lean, headY - 10, 64, 2, p.outline),
    rect(96 + lean, headY + 8, 68, 3, p.outline),
    ...rivetRow(102 + lean, headY + 2, 6, 10, p.playerSuitLight, 1.2),
    ...bevelRect(74 + lean, torsoY + 10 + armL, 16, 64, p.playerArmor, p.playerSuitLight, p.playerSuitDark, p.outline),
    ...bevelRect(170 + lean, torsoY + 10 + armR, 16, 64, p.playerArmor, p.playerSuitLight, p.playerSuitDark, p.outline),
    rect(76 + lean, torsoY + 18 + armL, 12, 6, p.playerSuitLight),
    rect(172 + lean, torsoY + 18 + armR, 12, 6, p.playerSuitLight),
    rect(76 + lean, torsoY + 34 + armL, 12, 6, p.playerSuitDark),
    rect(172 + lean, torsoY + 34 + armR, 12, 6, p.playerSuitDark),
    rect(72 + lean, torsoY + 10 + armL, 20, 8, p.outline),
    rect(168 + lean, torsoY + 10 + armR, 20, 8, p.outline),
    ...bevelRect(86 + lean, legYL, 34, 66, p.playerLeg, p.playerSuitLight, p.playerBoot, p.outline),
    ...bevelRect(136 + lean, legYR, 34, 66, p.playerLeg, p.playerSuitLight, p.playerBoot, p.outline),
    ...checker(90 + lean, legYL + 4, 26, 44, p.playerSuitDark, 3, 0),
    ...checker(140 + lean, legYR + 4, 26, 44, p.playerSuitDark, 3, 1),
    ...panelRows(92 + lean, legYL + 12, 22, 4, 9, p.playerBoot),
    ...panelRows(142 + lean, legYR + 12, 22, 4, 9, p.playerBoot),
    rect(90 + lean, legYL + 24, 26, 8, p.playerSuitDark),
    rect(140 + lean, legYR + 24, 26, 8, p.playerSuitDark),
    ...bevelRect(78 + lean, 238, 52, 14, p.playerBoot, p.playerSuitDark, p.outline, p.outline),
    ...bevelRect(132 + lean, 238, 52, 14, p.playerBoot, p.playerSuitDark, p.outline, p.outline),
    ...rivetRow(82 + lean, 244, 8, 6, p.playerArmor, 1.1),
    ...rivetRow(136 + lean, 244, 8, 6, p.playerArmor, 1.1),
    ...bevelRect(154 + lean, gunY, 60, 12, p.playerGun, "#f1f7ff", p.playerGunDark, p.outline),
    rect(156 + lean, gunY + 2, 56, 4, p.playerGunDark),
    rect(202 + lean, gunY + 2, 26, 8, p.playerGunDark),
    rect(154 + lean, gunY + 10, 54, 2, p.outline),
    ...rivetRow(162 + lean, gunY + 4, 4, 12, p.playerSuitLight, 1),
    rect(108 + lean, headY + 16, 14, 6, p.eye),
    rect(138 + lean, headY + 16, 14, 6, p.eye),
    rect(122 + lean, headY + 20, 14, 4, p.visor),
    rect(114 + lean, headY + 16, 2, 6, p.playerSkinShade),
    rect(144 + lean, headY + 16, 2, 6, p.playerSkinShade),
  ];
}

function playerJumpFrame(p, cfg = {}) {
  const bob = cfg.bob || 0;
  const spread = cfg.spread || 0;
  return [
    ...playerStandingFrame(p, { bob, legL: 10, legR: 10, armL: -4, armR: -8, gunKick: -6 }),
    rect(92, 204 + bob, 30, 34, p.playerLeg),
    rect(138, 196 + bob + spread, 30, 34, p.playerLeg),
    rect(92, 228 + bob, 28, 10, p.playerBoot),
    rect(140, 224 + bob + spread, 28, 10, p.playerBoot),
  ];
}

function playerCrouchFrame(p, cfg = {}) {
  const bob = cfg.bob || 0;
  const recoil = cfg.recoil || 0;
  return [
    rect(76, 128 + bob, 104, 62, p.outline),
    rect(80, 132 + bob, 96, 56, p.playerSuit),
    rect(84, 138 + bob, 88, 18, p.playerSuitLight),
    rect(86, 160 + bob, 84, 10, p.playerSuitDark),
    rect(100, 102 + bob, 58, 32, p.playerSkin),
    rect(100, 122 + bob, 58, 12, p.playerSkinShade),
    rect(92, 94 + bob, 74, 9, p.playerBand),
    rect(74, 140 + bob + recoil, 18, 42, p.playerArmor),
    rect(170, 140 + bob + recoil, 18, 42, p.playerArmor),
    rect(84, 186 + bob, 82, 40, p.playerLeg),
    rect(80, 226 + bob, 52, 18, p.playerBoot),
    rect(126, 226 + bob, 52, 18, p.playerBoot),
    rect(158, 166 + bob + recoil, 68, 10, p.playerGun),
    rect(210, 167 + bob + recoil, 20, 7, p.playerGunDark),
    rect(108, 118 + bob, 14, 5, p.eye),
    rect(136, 118 + bob, 14, 5, p.eye),
    rect(122, 122 + bob, 14, 4, p.visor),
  ];
}

function playerRollFrame(p, idx) {
  const centers = [
    { x: 128, y: 180, rot: -10 },
    { x: 132, y: 176, rot: -24 },
    { x: 128, y: 172, rot: -38 },
    { x: 124, y: 176, rot: -20 },
  ];
  const s = centers[idx % centers.length];
  return [
    ellipse(s.x, s.y, 84, 46, p.playerLeg),
    ellipse(s.x, s.y, 66, 34, p.playerSuit),
    ellipse(s.x + 8, s.y - 8, 30, 20, p.playerSkin),
    ellipse(s.x + 8, s.y + 2, 30, 10, p.playerSkinShade),
    rect(s.x - 34, s.y - 28, 72, 8, p.playerBand, ` transform="rotate(${s.rot} ${s.x} ${s.y - 24})"`),
    rect(s.x + 40, s.y - 10, 42, 10, p.playerGun),
    rect(s.x + 72, s.y - 9, 18, 6, p.playerGunDark),
    rect(s.x + 10, s.y - 12, 10, 4, p.eye),
    rect(s.x + 2, s.y + 4, 30, 6, p.playerSuitDark),
  ];
}

function trooperFrame(p, cfg = {}) {
  const bob = cfg.bob || 0;
  const legL = cfg.legL || 0;
  const legR = cfg.legR || 0;
  const gunKick = cfg.gunKick || 0;
  return [
    ...bevelRect(78, 90 + bob, 100, 102, p.enemyBody, "#de6f90", p.enemyBodyDark, p.outline),
    rect(86, 100 + bob, 84, 18, p.enemyBodyDark),
    ...checker(88, 102 + bob, 80, 14, p.enemyBody, 3, 1),
    ...panelRows(94, 122 + bob, 68, 4, 8, p.enemyBodyDark),
    ...bevelRect(98, 64 + bob, 60, 36, p.playerSkin, "#f6fbff", p.playerSkinShade, p.outline),
    rect(94, 58 + bob, 68, 8, p.enemyBand),
    rect(96, 64 + bob, 64, 2, p.outline),
    ...rivetRow(102, 60 + bob, 5, 12, p.enemyBodyDark, 1.2),
    ...bevelRect(74, 104 + bob, 18, 66, p.enemyArmor, p.enemyBody, p.enemyBodyDark, p.outline),
    ...bevelRect(172, 104 + bob, 18, 66, p.enemyArmor, p.enemyBody, p.enemyBodyDark, p.outline),
    rect(76, 118 + bob, 14, 6, p.enemyBodyDark),
    rect(174, 118 + bob, 14, 6, p.enemyBodyDark),
    rect(76, 136 + bob, 14, 6, p.enemyBodyDark),
    rect(174, 136 + bob, 14, 6, p.enemyBodyDark),
    ...bevelRect(90, 182 + legL + bob, 34, 62, p.enemyLeg, p.enemyBody, p.enemyArmor, p.outline),
    ...bevelRect(132, 182 + legR + bob, 34, 62, p.enemyLeg, p.enemyBody, p.enemyArmor, p.outline),
    ...checker(94, 186 + legL + bob, 26, 42, p.enemyArmor, 3, 0),
    ...checker(136, 186 + legR + bob, 26, 42, p.enemyArmor, 3, 1),
    ...bevelRect(86, 238, 50, 14, p.enemyArmor, p.enemyBody, p.outline, p.outline),
    ...bevelRect(128, 238, 50, 14, p.enemyArmor, p.enemyBody, p.outline, p.outline),
    ...rivetRow(90, 244, 6, 6, p.enemyArmor, 1),
    ...rivetRow(132, 244, 6, 6, p.enemyArmor, 1),
    ...bevelRect(148, 152 + gunKick + bob, 64, 12, p.playerGun, "#f0f5ff", p.playerGunDark, p.outline),
    rect(202, 154 + gunKick + bob, 20, 8, p.playerGunDark),
    rect(150, 160 + gunKick + bob, 58, 2, p.outline),
    rect(154, 154 + gunKick + bob, 10, 2, p.playerSuitLight),
    rect(116, 82 + bob, 24, 6, p.enemyVisor),
    rect(108, 92 + bob, 12, 2, p.enemyBodyDark),
    rect(136, 92 + bob, 12, 2, p.enemyBodyDark),
  ];
}

function droneFrame(p, rotorState = 0) {
  const rotorY = [86, 82, 90][rotorState % 3];
  const wingW = [30, 38, 22][rotorState % 3];
  return [
    ellipse(128, 130, 88, 46, p.outline),
    ellipse(128, 130, 82, 42, p.droneBody),
    rect(56, 122, 144, 12, p.droneDark),
    rect(84, 96, 88, 22, p.droneLight),
    rect(68, rotorY, wingW, 6, p.playerGun),
    rect(188 - wingW, rotorY, wingW, 6, p.playerGun),
    rect(62, 140, 132, 12, p.droneDark),
    rect(114, 154, 28, 14, p.enemyBodyDark),
    circle(92, 130, 8, p.objectiveGlow),
    circle(164, 130, 8, p.objectiveGlow),
  ];
}

function turretFrame(p, recoil = 0) {
  return [
    rect(68, 126, 120, 94, p.outline),
    rect(72, 130, 112, 86, p.turretBody),
    rect(86, 98, 84, 40, p.turretDark),
    rect(90, 104, 76, 12, p.turretLight),
    rect(164 + recoil, 112, 58, 12, p.playerGun),
    rect(208 + recoil, 114, 18, 8, p.playerGunDark),
    rect(92, 216, 76, 24, p.turretDark),
    rect(112, 108, 34, 10, p.objectiveGlow),
    circle(126, 176, 8, p.outline),
  ];
}

function mechFrame(p, cfg = {}) {
  const legL = cfg.legL || 0;
  const legR = cfg.legR || 0;
  const bob = cfg.bob || 0;
  return [
    ...bevelRect(66, 74 + bob, 124, 122, p.enemyMech, p.enemyMechLight, p.enemyMechDark, p.outline),
    rect(76, 86 + bob, 104, 18, p.enemyMechLight),
    ...checker(80, 88 + bob, 96, 14, p.enemyMech, 3, 1),
    ...panelRows(82, 112 + bob, 92, 5, 7, p.enemyMechDark),
    rect(92, 98 + bob, 72, 48, p.enemyMechDark),
    rect(96, 104 + bob, 64, 8, p.enemyMech),
    rect(96, 116 + bob, 64, 4, p.enemyMechLight),
    ...rivetRow(98, 130 + bob, 6, 10, p.enemyMechLight, 1.2),
    ...bevelRect(54, 94 + bob, 20, 84, p.enemyMechDark, p.enemyMechLight, p.enemyMechDark, p.outline),
    ...bevelRect(186, 94 + bob, 20, 84, p.enemyMechDark, p.enemyMechLight, p.enemyMechDark, p.outline),
    rect(56, 108 + bob, 16, 8, p.enemyMechLight),
    rect(188, 108 + bob, 16, 8, p.enemyMechLight),
    rect(56, 128 + bob, 16, 8, p.enemyMechLight),
    rect(188, 128 + bob, 16, 8, p.enemyMechLight),
    ...bevelRect(74, 194 + legL + bob, 44, 54, p.enemyMechDark, p.enemyMechLight, p.outline, p.outline),
    ...bevelRect(138, 194 + legR + bob, 44, 54, p.enemyMechDark, p.enemyMechLight, p.outline, p.outline),
    ...checker(78, 198 + legL + bob, 36, 38, p.enemyMech, 3, 0),
    ...checker(142, 198 + legR + bob, 36, 38, p.enemyMech, 3, 1),
    ...bevelRect(184, 126 + bob, 44, 16, p.playerGun, "#f1f7ff", p.playerGunDark, p.outline),
    rect(214, 128 + bob, 16, 10, p.playerGunDark),
    rect(86, 70 + bob, 84, 8, p.enemyMechLight),
    rect(88, 72 + bob, 80, 2, p.outline),
    rect(114, 118 + bob, 10, 6, p.eye),
    rect(142, 118 + bob, 10, 6, p.eye),
    rect(122, 124 + bob, 22, 4, p.objectiveGlow),
  ];
}

function objectiveCentrifugeFrame(p, pulse = 0) {
  const glow = 16 + pulse * 4;
  return [
    ...bevelRect(54, 40, 148, 188, p.objectiveMetal, "#9cb4d6", p.objectiveMetalDark, p.outline),
    rect(62, 50, 132, 14, p.objectiveMetalDark),
    rect(82, 68, 92, 132, "#d3deea"),
    rect(92, 74, 72, 8, p.objectiveMetalDark),
    ...checker(84, 76, 88, 120, p.objectiveMetal, 4, 0),
    ...panelRows(86, 84, 84, 10, 10, p.objectiveMetalDark),
    rect(116, 80, 24, 108, p.objectiveDark),
    ...rivetRow(98, 84, 3, 20, p.objectiveMetalDark, 1.2),
    ...rivetRow(154, 84, 3, 20, p.objectiveMetalDark, 1.2),
    rect(62, 208, 132, 20, p.objectiveDark),
    circle(128, 128, glow, p.objectiveGlow, " opacity=\"0.76\""),
    circle(128, 128, 8 + pulse * 2, "#dcfbff"),
  ];
}

function objectiveFactoryFrame(p, pulse = 0) {
  const smokeAlpha = 0.32 + pulse * 0.22;
  return [
    ...bevelRect(40, 82, 176, 148, p.objectiveMetal, "#9eb4cf", p.objectiveMetalDark, p.outline),
    rect(50, 92, 156, 14, p.objectiveMetalDark),
    rect(66, 58, 42, 36, p.objectiveDark),
    rect(118, 50, 38, 44, p.objectiveDark),
    rect(168, 62, 32, 32, p.objectiveDark),
    rect(58, 110, 140, 24, "#d5dfeb"),
    rect(58, 146, 140, 24, "#cad6e4"),
    rect(58, 182, 140, 24, "#becbda"),
    rect(184, 38, 18, 26, p.objectiveMetalDark),
    rect(184, 22, 12, 16, p.objectiveCore),
    ellipse(190, 18, 14, 9, p.objectiveCore, ` opacity="${smokeAlpha.toFixed(2)}"`),
  ];
}

function objectiveReactorFrame(p, pulse = 0) {
  const glow = 42 + pulse * 10;
  return [
    ...bevelRect(48, 26, 160, 206, p.objectiveDark, "#2f3f58", "#141b24", p.outline),
    rect(76, 54, 104, 148, p.objectiveMetal),
    rect(80, 60, 96, 10, p.objectiveMetalDark),
    ...checker(82, 72, 92, 124, p.objectiveMetalDark, 4, 1),
    ...panelRows(84, 82, 88, 8, 12, p.objectiveMetal),
    ...rivetRow(88, 66, 8, 10, p.objectiveMetal, 1.1),
    circle(128, 128, glow, p.objectiveGlow, " opacity=\"0.62\""),
    circle(128, 128, 22 + pulse * 3, "#ecfcff"),
    rect(52, 214, 152, 18, "#1b222c"),
    rect(86, 20, 84, 10, p.objectiveCore),
    rect(110, 6, 36, 14, p.objectiveCore),
  ];
}

function objectiveRadarFrame(p, pulse = 0) {
  const beamX = 164 + pulse * 12;
  return [
    rect(66, 128, 124, 112, p.outline),
    rect(70, 132, 116, 94, p.objectiveMetal),
    rect(80, 220, 96, 18, p.objectiveDark),
    circle(128, 98, 54, "#dde8f5"),
    circle(128, 98, 48, p.objectiveDark),
    circle(128, 98, 40, "#273241"),
    polygon(`128,98 ${beamX},86 ${beamX},110`, p.objectiveGlow),
    circle(128, 98, 10, "#edfaff"),
  ];
}

function pickupFrame(kind, p, pulse = 0) {
  const glowAlpha = (0.26 + pulse * 0.2).toFixed(2);
  if (kind === "med") {
    return [
      ...bevelRect(68, 68, 120, 120, p.pickupMed, "#9dffc3", p.pickupMedDark, p.outline),
      rect(112, 90, 32, 76, p.pickupMedDark),
      rect(90, 112, 76, 32, p.pickupMedDark),
      ...checker(76, 76, 104, 104, p.pickupMedDark, 4, 0),
      rect(84, 84, 88, 8, "#d8ffe6"),
      rect(84, 160, 88, 8, "#4e9f6b"),
      ...rivetRow(88, 172, 7, 12, p.pickupMedDark, 1),
      circle(128, 128, 44, p.pickupMed, ` opacity="${glowAlpha}"`),
    ];
  }
  if (kind === "spread") {
    return [
      ...bevelRect(68, 68, 120, 120, p.pickupSpread, "#fff29a", "#a58629", p.outline),
      rect(86, 86, 84, 84, "#212838"),
      ...checker(90, 90, 76, 76, "#1a2638", 4, 1),
      rect(96, 112, 64, 12, p.pickupSpread),
      rect(96, 132, 64, 12, p.pickupSpread),
      rect(108, 96, 40, 10, p.pickupSpread),
      ...rivetRow(100, 150, 5, 12, p.pickupSpread, 1),
      circle(128, 128, 44, p.pickupSpread, ` opacity="${glowAlpha}"`),
    ];
  }
  if (kind === "laser") {
    return [
      ...bevelRect(68, 68, 120, 120, p.pickupLaser, "#ccfbff", "#2688a4", p.outline),
      rect(86, 86, 84, 84, "#212838"),
      ...checker(90, 90, 76, 76, "#182334", 4, 0),
      rect(106, 96, 44, 64, p.pickupLaser),
      rect(96, 128, 64, 10, "#b6f7ff"),
      rect(112, 86, 32, 8, "#dffcff"),
      ...rivetRow(104, 152, 5, 12, p.pickupLaser, 1),
      circle(128, 128, 44, p.pickupLaser, ` opacity="${glowAlpha}"`),
    ];
  }
  return [
    ...bevelRect(68, 68, 120, 120, p.pickupFlame, "#ffb37f", "#8f3f1a", p.outline),
    rect(86, 86, 84, 84, "#212838"),
    ...checker(90, 90, 76, 76, "#1f2838", 4, 1),
    polygon("128,94 152,130 140,166 116,166 104,130", p.pickupFlame),
    polygon("128,104 142,130 134,154 122,154 114,130", "#ffd79f"),
    rect(112, 166, 32, 8, "#53301c"),
    ...rivetRow(106, 150, 5, 12, p.pickupFlame, 1),
    circle(128, 128, 44, p.pickupFlame, ` opacity="${glowAlpha}"`),
  ];
}

function muzzleFrame(p, idx) {
  const star = [
    "128,70 142,104 184,106 150,128 164,170 128,146 92,170 106,128 72,106 114,104",
    "128,58 146,102 198,108 156,136 170,194 128,160 86,194 100,136 58,108 110,102",
    "128,76 140,108 170,110 146,128 156,162 128,144 100,162 110,128 86,110 116,108",
  ][idx % 3];
  const glow = [30, 40, 24][idx % 3];
  const core = [14, 20, 10][idx % 3];
  return [
    circle(128, 128, glow, p.fxFlash, " opacity=\"0.5\""),
    polygon(star, p.fxFlash),
    circle(128, 128, core, p.fxFlashHot),
  ];
}

function explosionFrame(p, idx) {
  const rings = [
    { outer: 28, mid: 16, core: 8, alpha: 0.9 },
    { outer: 42, mid: 24, core: 12, alpha: 0.85 },
    { outer: 58, mid: 34, core: 18, alpha: 0.8 },
    { outer: 70, mid: 44, core: 24, alpha: 0.72 },
    { outer: 78, mid: 52, core: 28, alpha: 0.64 },
    { outer: 84, mid: 58, core: 30, alpha: 0.52 },
  ];
  const ring = rings[Math.max(0, Math.min(rings.length - 1, idx))];
  return [
    circle(128, 128, ring.outer, p.fxExplosion, ` opacity="${ring.alpha}"`),
    circle(128, 128, ring.mid, p.fxExplosionCore, ` opacity="${Math.min(1, ring.alpha + 0.08)}"`),
    circle(86, 94, 20, p.fxSmoke, " opacity=\"0.54\""),
    circle(170, 102, 16, p.fxSmoke, " opacity=\"0.48\""),
    circle(98, 168, 22, p.fxSmoke, " opacity=\"0.5\""),
    circle(160, 170, 18, p.fxSmoke, " opacity=\"0.45\""),
    polygon("128,72 142,106 178,108 148,130 158,164 128,144 98,164 108,130 78,108 114,106", "#fff4cc", " opacity=\"0.86\""),
    circle(128, 128, ring.core, "#fff8d2", " opacity=\"0.92\""),
  ];
}

function addAnimatedSet(out, baseKey, frames) {
  if (!Array.isArray(frames) || !frames.length) return;
  frames.forEach((svg, index) => {
    out[`${baseKey}_${index}_hd`] = svg;
  });
  out[`${baseKey}_hd`] = frames[0];
}

function buildSprites(p) {
  const out = {};

  addAnimatedSet(out, "player_idle", [
    svgDoc(playerStandingFrame(p, { bob: 0, legL: 2, legR: 0 })),
    svgDoc(playerStandingFrame(p, { bob: -1, legL: 1, legR: 1, gunKick: -1 })),
    svgDoc(playerStandingFrame(p, { bob: 0, legL: 0, legR: 2 })),
    svgDoc(playerStandingFrame(p, { bob: 1, legL: 1, legR: 0, gunKick: 1 })),
    svgDoc(playerStandingFrame(p, { bob: 0, legL: 2, legR: 1, armL: -1, armR: 1 })),
    svgDoc(playerStandingFrame(p, { bob: -1, legL: 1, legR: 2, gunKick: -1 })),
  ]);

  addAnimatedSet(out, "player_run", [
    svgDoc(playerStandingFrame(p, { bob: 0, legL: -8, legR: 10, armL: -4, armR: 6, gunKick: -2, lean: 0 })),
    svgDoc(playerStandingFrame(p, { bob: -1, legL: -4, legR: 6, armL: -2, armR: 4, gunKick: -1, lean: 1 })),
    svgDoc(playerStandingFrame(p, { bob: -2, legL: 2, legR: 0, armL: 0, armR: 2, gunKick: 0, lean: 2 })),
    svgDoc(playerStandingFrame(p, { bob: -1, legL: 8, legR: -6, armL: 5, armR: -3, gunKick: 1, lean: 1 })),
    svgDoc(playerStandingFrame(p, { bob: 0, legL: 2, legR: -2, armL: 2, armR: -1, gunKick: 0, lean: 0 })),
    svgDoc(playerStandingFrame(p, { bob: 1, legL: -4, legR: 4, armL: -1, armR: 1, gunKick: -1, lean: -1 })),
    svgDoc(playerStandingFrame(p, { bob: 1, legL: -9, legR: 9, armL: -4, armR: 6, gunKick: -2, lean: -1 })),
    svgDoc(playerStandingFrame(p, { bob: 0, legL: -6, legR: 6, armL: -2, armR: 4, gunKick: -1, lean: -1 })),
  ]);

  addAnimatedSet(out, "player_jump", [
    svgDoc(playerJumpFrame(p, { bob: -6, spread: -2 })),
    svgDoc(playerJumpFrame(p, { bob: -3, spread: 2 })),
  ]);

  addAnimatedSet(out, "player_crouch", [
    svgDoc(playerCrouchFrame(p, { bob: 0, recoil: 0 })),
    svgDoc(playerCrouchFrame(p, { bob: -1, recoil: -2 })),
  ]);

  addAnimatedSet(out, "player_roll", [
    svgDoc(playerRollFrame(p, 0)),
    svgDoc(playerRollFrame(p, 1)),
    svgDoc(playerRollFrame(p, 2)),
    svgDoc(playerRollFrame(p, 3)),
  ]);

  addAnimatedSet(out, "enemy_trooper", [
    svgDoc(trooperFrame(p, { legL: -6, legR: 8, gunKick: -2 })),
    svgDoc(trooperFrame(p, { legL: -2, legR: 4, gunKick: -1, bob: -1 })),
    svgDoc(trooperFrame(p, { legL: 6, legR: -4, gunKick: 1 })),
    svgDoc(trooperFrame(p, { legL: 2, legR: -2, gunKick: 0, bob: 1 })),
    svgDoc(trooperFrame(p, { legL: -4, legR: 6, gunKick: -1 })),
    svgDoc(trooperFrame(p, { legL: 0, legR: 2, gunKick: 0, bob: -1 })),
  ]);

  addAnimatedSet(out, "enemy_drone", [
    svgDoc(droneFrame(p, 0)),
    svgDoc(droneFrame(p, 1)),
    svgDoc(droneFrame(p, 2)),
    svgDoc(droneFrame(p, 1)),
  ]);

  addAnimatedSet(out, "enemy_turret", [
    svgDoc(turretFrame(p, 0)),
    svgDoc(turretFrame(p, -10)),
    svgDoc(turretFrame(p, -4)),
  ]);

  addAnimatedSet(out, "enemy_mech", [
    svgDoc(mechFrame(p, { legL: -8, legR: 8 })),
    svgDoc(mechFrame(p, { legL: -2, legR: 4, bob: -1 })),
    svgDoc(mechFrame(p, { legL: 8, legR: -6 })),
    svgDoc(mechFrame(p, { legL: 2, legR: -2, bob: 1 })),
    svgDoc(mechFrame(p, { legL: -6, legR: 6, bob: 0 })),
    svgDoc(mechFrame(p, { legL: -1, legR: 3, bob: -1 })),
  ]);

  addAnimatedSet(out, "objective_centrifuge", [
    svgDoc(objectiveCentrifugeFrame(p, 0)),
    svgDoc(objectiveCentrifugeFrame(p, 1)),
  ]);
  addAnimatedSet(out, "objective_factory", [
    svgDoc(objectiveFactoryFrame(p, 0)),
    svgDoc(objectiveFactoryFrame(p, 1)),
  ]);
  addAnimatedSet(out, "objective_reactor", [
    svgDoc(objectiveReactorFrame(p, 0)),
    svgDoc(objectiveReactorFrame(p, 1)),
    svgDoc(objectiveReactorFrame(p, 2)),
  ]);
  addAnimatedSet(out, "objective_radar", [
    svgDoc(objectiveRadarFrame(p, 0)),
    svgDoc(objectiveRadarFrame(p, 1)),
  ]);

  addAnimatedSet(out, "pickup_med", [
    svgDoc(pickupFrame("med", p, 0)),
    svgDoc(pickupFrame("med", p, 1)),
    svgDoc(pickupFrame("med", p, 2)),
  ]);
  addAnimatedSet(out, "pickup_spread", [
    svgDoc(pickupFrame("spread", p, 0)),
    svgDoc(pickupFrame("spread", p, 1)),
    svgDoc(pickupFrame("spread", p, 2)),
  ]);
  addAnimatedSet(out, "pickup_laser", [
    svgDoc(pickupFrame("laser", p, 0)),
    svgDoc(pickupFrame("laser", p, 1)),
    svgDoc(pickupFrame("laser", p, 2)),
  ]);
  addAnimatedSet(out, "pickup_flame", [
    svgDoc(pickupFrame("flame", p, 0)),
    svgDoc(pickupFrame("flame", p, 1)),
    svgDoc(pickupFrame("flame", p, 2)),
  ]);

  addAnimatedSet(out, "fx_muzzle_flash", [
    svgDoc(muzzleFrame(p, 0)),
    svgDoc(muzzleFrame(p, 1)),
    svgDoc(muzzleFrame(p, 2)),
  ]);

  addAnimatedSet(out, "fx_explosion", [
    svgDoc(explosionFrame(p, 0)),
    svgDoc(explosionFrame(p, 1)),
    svgDoc(explosionFrame(p, 2)),
    svgDoc(explosionFrame(p, 3)),
    svgDoc(explosionFrame(p, 4)),
    svgDoc(explosionFrame(p, 5)),
  ]);

  return out;
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return {};
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function main() {
  const args = parseArgs(process.argv);
  const styles = Object.keys(STYLE_PRESETS);

  if (args.listStyles) {
    console.log(styles.join("\n"));
    return;
  }

  if (!styles.includes(args.style)) {
    console.error(`Unknown style "${args.style}". Use one of: ${styles.join(", ")}`);
    process.exit(1);
  }

  const outDir = path.resolve(args.out);
  const manifestPath = path.resolve(args.manifest);
  const palette = STYLE_PRESETS[args.style];
  const sprites = buildSprites(palette);
  const relBase = path.relative(path.dirname(manifestPath), outDir).split(path.sep).join("/");

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

  let written = 0;
  let skipped = 0;
  const manifest = readManifest(manifestPath);

  for (const [key, svg] of Object.entries(sprites)) {
    const filename = `${key}.svg`;
    const target = path.join(outDir, filename);
    if (fs.existsSync(target) && !args.overwrite) {
      skipped += 1;
    } else {
      fs.writeFileSync(target, svg, "utf8");
      written += 1;
    }
    manifest[key] = `${relBase}/${filename}`;
  }

  writeManifestBundle(manifestPath, manifest);

  console.log(`Generated style preset: ${args.style}`);
  console.log(`Total sprite keys: ${Object.keys(sprites).length}`);
  console.log(`Sprites written: ${written}`);
  console.log(`Sprites skipped: ${skipped}`);
  console.log(`Output directory: ${outDir}`);
  console.log(`Manifest updated: ${manifestPath}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
