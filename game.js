(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = "low";
  const splash = document.getElementById("splash");
  const banner = document.getElementById("banner");
  const startBtn = document.getElementById("start-btn");
  const DEBUG_SCENARIO = new URLSearchParams(window.location.search).get("scenario") || "";

  const DT = 1 / 60;
  const GRAVITY = 2200;
  const W = canvas.width;
  const H = canvas.height;
  const PLAYER_SPEED = 295;
  const PLAYER_ROLL_SPEED = 420;
  const PLAYER_ROLL_DURATION = 0.38;
  const PLAYER_ROLL_COOLDOWN = 0.68;
  const PLAYER_CLIMB_SPEED = 185;
  const PLAYER_DROP_THROUGH = 0.22;
  const CAMERA_LERP = 6.4;
  const CAMERA_LEAD_LERP = 8.2;
  const FACE_LERP = 10.5;

  const keys = Object.create(null);
  const sprites = new Map();
  const spriteBounds = new Map();

  const WEAPON_ORDER = ["RIFLE", "SPREAD", "LASER", "FLAME"];
  const WEAPONS = {
    RIFLE: { label: "Rifle", dmg: [20, 28, 36], cd: [0.16, 0.13, 0.1], speed: 860, color: "#f3f8ff", ammo: Infinity, pickup: 0 },
    SPREAD: { label: "Spread", dmg: [14, 18, 24], cd: [0.24, 0.2, 0.17], speed: 760, pellets: [3, 4, 5], cone: [0.28, 0.34, 0.42], color: "#ffd447", ammo: 70, pickup: 60 },
    LASER: { label: "Laser", dmg: [30, 40, 52], cd: [0.2, 0.16, 0.13], speed: 1080, pierce: [2, 3, 4], color: "#46ebff", ammo: 52, pickup: 42 },
    FLAME: { label: "Flame", dmg: [9, 13, 17], cd: [0.11, 0.095, 0.08], speed: 430, ttl: [0.32, 0.38, 0.43], radius: [8, 10, 12], color: "#ff8b2f", ammo: 110, pickup: 90 },
  };
  const ANIM = {
    player: {
      player_idle: { frames: 6, fps: 7 },
      player_idle_up: { frames: 6, fps: 7 },
      player_idle_diag: { frames: 6, fps: 7 },
      player_run: { frames: 8, fps: 14 },
      player_run_up: { frames: 8, fps: 14 },
      player_run_diag: { frames: 8, fps: 14 },
      player_jump: { frames: 6, fps: 16 },
      player_air_forward: { frames: 4, fps: 10 },
      player_air_up: { frames: 4, fps: 10 },
      player_air_diag: { frames: 4, fps: 10 },
      player_crouch: { frames: 2, fps: 5 },
      player_roll: { frames: 4, fps: 16 },
      player_climb: { frames: 6, fps: 10 },
    },
    enemy: {
      trooper: { frames: 6, fps: 12 },
      trooper_fire: { frames: 6, fps: 12 },
      trooper_up: { frames: 6, fps: 12 },
      drone: { frames: 4, fps: 12 },
      turret: { frames: 3, fps: 5 },
      mech: { frames: 6, fps: 8 },
      boss: { frames: 6, fps: 8 },
    },
    objective: {
      centrifuge: { frames: 2, fps: 4 },
      factory: { frames: 2, fps: 3 },
      reactor: { frames: 3, fps: 5 },
      radar: { frames: 2, fps: 4 },
    },
    pickup: { frames: 3, fps: 6 },
  };

  const LEVELS = [
    {
      name: "Subterranean Breach",
      subtitle: "Penetrate the deep cave base and sabotage enrichment lines",
      length: 7600,
      palette: {
        theme: "cave",
        sky1: "#070b13",
        sky2: "#0d1521",
        sky3: "#191f2d",
        back: "#1c2633",
        mid: "#2b3745",
        g1: "#5b4a3f",
        g2: "#2f2621",
        roof1: "#101722",
        roof2: "#1b2430",
        support: "#495869",
        cable: "#2a3440",
        glow: "#3a7da0",
        light: "#8be8ff",
      },
      terrain: [
        { x: 0, y: 466 },
        { x: 900, y: 454 },
        { x: 1820, y: 470 },
        { x: 2700, y: 446 },
        { x: 3600, y: 472 },
        { x: 4500, y: 444 },
        { x: 5500, y: 468 },
        { x: 6400, y: 452 },
        { x: 7100, y: 462 },
        { x: 7600, y: 456 },
      ],
      objectives: [
        { id: "centrifuge", label: "Centrifuge Chamber", kind: "centrifuge", x: 1880, y: 318, w: 136, h: 136, hp: 360, weak: "SPREAD", reward: "SPREAD" },
        { id: "forge", label: "Missile Forge", kind: "factory", x: 3980, y: 330, w: 142, h: 122, hp: 440, weak: "FLAME", reward: "LASER" },
        { id: "reactor", label: "Core Reactor", kind: "reactor", x: 6520, y: 286, w: 170, h: 168, hp: 620, weak: "LASER", reward: "FLAME" },
      ],
      platforms: [
        { id: "l1-catwalk-1", x: 500, y: 382, w: 176, h: 12 },
        { id: "l1-catwalk-2", x: 960, y: 332, w: 170, h: 12 },
        { id: "l1-catwalk-3", x: 1480, y: 358, w: 150, h: 12 },
        { id: "l1-catwalk-4", x: 2050, y: 306, w: 178, h: 12 },
        { id: "l1-catwalk-5", x: 2500, y: 342, w: 154, h: 12 },
        { id: "l1-catwalk-6", x: 3220, y: 302, w: 170, h: 12 },
        { id: "l1-catwalk-7", x: 3880, y: 344, w: 190, h: 12 },
        { id: "l1-catwalk-8", x: 4600, y: 314, w: 174, h: 12 },
        { id: "l1-catwalk-9", x: 5360, y: 354, w: 150, h: 12 },
        { id: "l1-catwalk-10", x: 5980, y: 312, w: 182, h: 12 },
      ],
      climbables: [
        { id: "l1-grate-1", x: 578, y: 302, w: 24, h: 168 },
        { id: "l1-grate-2", x: 1032, y: 252, w: 24, h: 204 },
        { id: "l1-grate-3", x: 2128, y: 232, w: 24, h: 224 },
        { id: "l1-grate-4", x: 3290, y: 224, w: 24, h: 236 },
        { id: "l1-grate-5", x: 4680, y: 236, w: 24, h: 224 },
        { id: "l1-grate-6", x: 6060, y: 230, w: 24, h: 236 },
      ],
      obstacles: [
        { id: "l1-cover-1", kind: "crate", x: 740, y: 406, w: 48, h: 48 },
        { id: "l1-cover-2", kind: "barrier", x: 1680, y: 390, w: 60, h: 64 },
        { id: "l1-cover-3", kind: "crate", x: 2800, y: 404, w: 52, h: 42 },
        { id: "l1-cover-4", kind: "barrier", x: 4300, y: 388, w: 70, h: 64 },
        { id: "l1-cover-5", kind: "crate", x: 5700, y: 404, w: 54, h: 44 },
        { id: "l1-cover-6", kind: "pillar", x: 6800, y: 344, w: 58, h: 112 },
      ],
      hazards: [
        { id: "l1-hazard-1", kind: "laser-floor", x: 1270, y: 446, w: 106, h: 10, dmg: 18 },
        { id: "l1-hazard-2", kind: "acid", x: 3520, y: 446, w: 118, h: 12, dmg: 20 },
        { id: "l1-hazard-3", kind: "spikes", x: 6200, y: 444, w: 120, h: 12, dmg: 22 },
      ],
      spawns: [
        { t: "trooper", x: 420 }, { t: "trooper", x: 560, surfaceY: 382, patrolMin: 516, patrolMax: 644 }, { t: "drone", x: 760, y: 248 },
        { t: "turret", x: 980, surfaceY: 332 }, { t: "trooper", x: 1180 }, { t: "trooper", x: 1530, surfaceY: 358, patrolMin: 1490, patrolMax: 1588 },
        { t: "turret", x: 1710 }, { t: "drone", x: 1920, y: 220 }, { t: "trooper", x: 2110, surfaceY: 306, patrolMin: 2070, patrolMax: 2188 },
        { t: "trooper", x: 2360 }, { t: "turret", x: 2570, surfaceY: 342 }, { t: "drone", x: 2860, y: 205 }, { t: "trooper", x: 3240, surfaceY: 302, patrolMin: 3232, patrolMax: 3348 },
        { t: "trooper", x: 3470 }, { t: "mech", x: 3900, surfaceY: 344, patrolMin: 3880, patrolMax: 3998 }, { t: "drone", x: 4220, y: 230 },
        { t: "turret", x: 4650, surfaceY: 314 }, { t: "trooper", x: 4880 }, { t: "drone", x: 5200, y: 240 }, { t: "trooper", x: 5400, surfaceY: 354, patrolMin: 5374, patrolMax: 5478 },
        { t: "mech", x: 5820 }, { t: "turret", x: 6030, surfaceY: 312 }, { t: "drone", x: 6320, y: 205 }, { t: "trooper", x: 6570 },
        { t: "trooper", x: 6980 }, { t: "drone", x: 7180, y: 190 },
      ],
      pickups: [{ type: "med", x: 2360, y: 360 }, { type: "med", x: 5060, y: 352 }],
      boss: { name: "Iron Talon", intro: "Arena security commander engaging.", x: 7320, arenaStart: 6920, hp: 1650, w: 78, h: 96, speed: 82 },
    },
    {
      name: "Arc Mountains",
      subtitle: "Disable launch and guidance bunkers",
      length: 5100,
      palette: { sky1: "#13243f", sky2: "#24456d", sky3: "#6884a5", back: "#2c3444", mid: "#3e4f63", g1: "#586470", g2: "#3d444f" },
      terrain: [{ x: 0, y: 460 }, { x: 900, y: 444 }, { x: 1500, y: 456 }, { x: 2350, y: 432 }, { x: 3150, y: 455 }, { x: 3900, y: 439 }, { x: 4700, y: 450 }, { x: 5100, y: 444 }],
      objectives: [
        { id: "guidance", label: "Guidance Array", kind: "radar", x: 1360, y: 330, w: 130, h: 126, hp: 350, weak: "RIFLE", reward: "SPREAD" },
        { id: "fuel", label: "Fuel Crucible", kind: "factory", x: 2790, y: 338, w: 130, h: 114, hp: 430, weak: "FLAME", reward: "FLAME" },
        { id: "vault", label: "Launch Vault", kind: "reactor", x: 4280, y: 302, w: 158, h: 150, hp: 540, weak: "LASER", reward: "LASER" },
      ],
      platforms: [
        { id: "l2-bridge-1", x: 660, y: 366, w: 170, h: 12 },
        { id: "l2-bridge-2", x: 1160, y: 324, w: 168, h: 12 },
        { id: "l2-bridge-3", x: 1810, y: 344, w: 160, h: 12 },
        { id: "l2-bridge-4", x: 2570, y: 308, w: 170, h: 12 },
        { id: "l2-bridge-5", x: 3340, y: 330, w: 176, h: 12 },
        { id: "l2-bridge-6", x: 4090, y: 302, w: 176, h: 12 },
      ],
      climbables: [
        { id: "l2-ladder-1", x: 736, y: 298, w: 24, h: 162 },
        { id: "l2-ladder-2", x: 1236, y: 250, w: 24, h: 200 },
        { id: "l2-ladder-3", x: 2648, y: 238, w: 24, h: 214 },
        { id: "l2-ladder-4", x: 3420, y: 256, w: 24, h: 188 },
      ],
      obstacles: [
        { id: "l2-cover-1", kind: "crate", x: 490, y: 408, w: 52, h: 44 },
        { id: "l2-cover-2", kind: "barrier", x: 1520, y: 394, w: 62, h: 60 },
        { id: "l2-cover-3", kind: "crate", x: 2890, y: 392, w: 56, h: 44 },
        { id: "l2-cover-4", kind: "pillar", x: 4340, y: 340, w: 56, h: 108 },
      ],
      hazards: [
        { id: "l2-hazard-1", kind: "spikes", x: 980, y: 434, w: 96, h: 12, dmg: 18 },
        { id: "l2-hazard-2", kind: "laser-floor", x: 2140, y: 432, w: 120, h: 10, dmg: 20 },
        { id: "l2-hazard-3", kind: "acid", x: 3780, y: 430, w: 126, h: 14, dmg: 22 },
      ],
      spawns: [
        { t: "trooper", x: 460 }, { t: "drone", x: 820, y: 234 }, { t: "trooper", x: 730, surfaceY: 366, patrolMin: 680, patrolMax: 786 },
        { t: "turret", x: 1220, surfaceY: 324 }, { t: "trooper", x: 1440 }, { t: "drone", x: 1680, y: 214 }, { t: "trooper", x: 1860, surfaceY: 344, patrolMin: 1822, patrolMax: 1932 },
        { t: "trooper", x: 2140 }, { t: "turret", x: 2600, surfaceY: 308 }, { t: "drone", x: 2710, y: 272 }, { t: "trooper", x: 3030 },
        { t: "trooper", x: 3380, surfaceY: 330, patrolMin: 3352, patrolMax: 3472 }, { t: "turret", x: 3620 }, { t: "drone", x: 3820, y: 244 }, { t: "mech", x: 3980 },
        { t: "trooper", x: 4140, surfaceY: 302, patrolMin: 4104, patrolMax: 4240 }, { t: "turret", x: 4420 }, { t: "drone", x: 4620, y: 218 },
      ],
      pickups: [{ type: "med", x: 1890, y: 368 }, { type: "med", x: 3480, y: 355 }],
      boss: { name: "Mountain Warden", intro: "Command mech descending from the ridge.", x: 4860, arenaStart: 4440, hp: 1820, w: 80, h: 98, speed: 84 },
    },
    {
      name: "Tidal Core",
      subtitle: "Crush the coastal reactor chain",
      length: 5500,
      palette: { sky1: "#091b2f", sky2: "#0d385b", sky3: "#2f8ea2", back: "#202936", mid: "#294050", g1: "#4b6f72", g2: "#2d4444" },
      terrain: [{ x: 0, y: 458 }, { x: 860, y: 446 }, { x: 1560, y: 468 }, { x: 2450, y: 438 }, { x: 3320, y: 462 }, { x: 4200, y: 432 }, { x: 5000, y: 454 }, { x: 5500, y: 448 }],
      objectives: [
        { id: "sea", label: "Sea Centrifuge", kind: "centrifuge", x: 1440, y: 326, w: 136, h: 126, hp: 420, weak: "SPREAD", reward: "SPREAD" },
        { id: "assembly", label: "Assembly Cradle", kind: "factory", x: 3060, y: 336, w: 138, h: 118, hp: 520, weak: "FLAME", reward: "FLAME" },
        { id: "midnight", label: "Midnight Reactor", kind: "reactor", x: 4740, y: 286, w: 170, h: 166, hp: 720, weak: "LASER", reward: "LASER" },
      ],
      platforms: [
        { id: "l3-catwalk-1", x: 620, y: 358, w: 170, h: 12 },
        { id: "l3-catwalk-2", x: 1320, y: 326, w: 168, h: 12 },
        { id: "l3-catwalk-3", x: 2140, y: 342, w: 168, h: 12 },
        { id: "l3-catwalk-4", x: 2920, y: 304, w: 176, h: 12 },
        { id: "l3-catwalk-5", x: 3820, y: 320, w: 176, h: 12 },
        { id: "l3-catwalk-6", x: 4540, y: 300, w: 180, h: 12 },
      ],
      climbables: [
        { id: "l3-chain-1", x: 698, y: 286, w: 24, h: 172 },
        { id: "l3-chain-2", x: 1400, y: 250, w: 24, h: 214 },
        { id: "l3-chain-3", x: 3000, y: 228, w: 24, h: 226 },
        { id: "l3-chain-4", x: 4624, y: 220, w: 24, h: 232 },
      ],
      obstacles: [
        { id: "l3-cover-1", kind: "crate", x: 520, y: 402, w: 54, h: 46 },
        { id: "l3-cover-2", kind: "barrier", x: 1780, y: 392, w: 64, h: 60 },
        { id: "l3-cover-3", kind: "crate", x: 3400, y: 396, w: 58, h: 42 },
        { id: "l3-cover-4", kind: "pillar", x: 5080, y: 336, w: 60, h: 112 },
      ],
      hazards: [
        { id: "l3-hazard-1", kind: "acid", x: 1040, y: 442, w: 116, h: 12, dmg: 20 },
        { id: "l3-hazard-2", kind: "spikes", x: 2620, y: 438, w: 112, h: 14, dmg: 22 },
        { id: "l3-hazard-3", kind: "laser-floor", x: 4380, y: 430, w: 126, h: 10, dmg: 22 },
      ],
      spawns: [
        { t: "trooper", x: 520 }, { t: "drone", x: 860, y: 238 }, { t: "trooper", x: 690, surfaceY: 358, patrolMin: 646, patrolMax: 754 },
        { t: "turret", x: 1180 }, { t: "trooper", x: 1390, surfaceY: 326, patrolMin: 1336, patrolMax: 1466 }, { t: "drone", x: 1820, y: 220 },
        { t: "trooper", x: 2140, surfaceY: 342, patrolMin: 2150, patrolMax: 2260 }, { t: "turret", x: 2500 }, { t: "mech", x: 2880, surfaceY: 304, patrolMin: 2930, patrolMax: 3030 },
        { t: "drone", x: 3200, y: 214 }, { t: "trooper", x: 3520 }, { t: "turret", x: 3900, surfaceY: 320 }, { t: "drone", x: 4180, y: 238 },
        { t: "mech", x: 4480 }, { t: "trooper", x: 4620, surfaceY: 300, patrolMin: 4560, patrolMax: 4698 }, { t: "trooper", x: 5060 },
      ],
      pickups: [{ type: "med", x: 2300, y: 350 }, { type: "med", x: 4160, y: 344 }],
      boss: { name: "Leviathan Core", intro: "Final defense chassis rising from the coolant trench.", x: 5260, arenaStart: 4840, hp: 2100, w: 82, h: 102, speed: 86 },
    },
  ];

  const state = {
    mode: "splash",
    levelIndex: 0,
    level: null,
    cameraX: 0,
    cameraLead: 180,
    score: 0,
    lives: 4,
    combo: 0,
    comboTimer: 0,
    extractionReady: false,
    bossActive: false,
    bossDefeated: false,
    levelClock: 0,
    msg: "",
    msgT: 0,
    transitionT: 0,
    player: null,
    enemies: [],
    pending: [],
    objectives: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    explosions: [],
    acc: 0,
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => Math.random() * (b - a) + a;
  const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));
  const TROOPER_VARIANTS = ["", "olive", "crimson", "navy"];
  const normalizeVec = (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  };

  function pickTrooperVariant(seed) {
    return TROOPER_VARIANTS[Math.abs(Math.floor(seed)) % TROOPER_VARIANTS.length];
  }

  function getPlayerAimMode(p) {
    if (p.aimY < -0.86 && Math.abs(p.aimX) < 0.26) return "up";
    if (p.aimY < -0.24) return "diag";
    return "forward";
  }

  function getPlayerAimVector(p) {
    if (p.rollT > 0) return { x: p.face, y: 0 };
    const rawX = typeof p.aimX === "number" ? p.aimX : p.face;
    const rawY = typeof p.aimY === "number" ? p.aimY : 0;
    if (Math.abs(rawX) < 0.001 && Math.abs(rawY) < 0.001) {
      return { x: p.face, y: 0 };
    }
    return normalizeVec(rawX, rawY);
  }

  function getPlayerMuzzlePoint(p) {
    const aim = getPlayerAimVector(p);
    const shoulderX = p.x + p.w * 0.5 + p.face * 8;
    const shoulderY = p.y + (p.crouching ? 24 : (!p.onGround ? 18 : 18));
    return {
      x: shoulderX + aim.x * 20,
      y: shoulderY + aim.y * 20,
      dirX: aim.x,
      dirY: aim.y,
    };
  }

  function say(text, s = 2.2) {
    state.msg = text;
    state.msgT = s;
    banner.innerHTML = text;
    banner.classList.add("visible");
  }

  function clearSay() {
    banner.classList.remove("visible");
  }

  function terrainY(xWorld) {
    const t = state.level ? state.level.terrain : LEVELS[0].terrain;
    const x = clamp(xWorld, t[0].x, t[t.length - 1].x);
    for (let i = 0; i < t.length - 1; i++) {
      const a = t[i], b = t[i + 1];
      if (x >= a.x && x <= b.x) {
        return lerp(a.y, b.y, (x - a.x) / Math.max(1, b.x - a.x));
      }
    }
    return t[t.length - 1].y;
  }

  function levelPlatforms() {
    return state.level?.platforms || [];
  }

  function levelClimbables() {
    return state.level?.climbables || [];
  }

  function levelObstacles() {
    return state.level?.obstacles || [];
  }

  function levelHazards() {
    return state.level?.hazards || [];
  }

  function overlap1D(a0, a1, b0, b1, pad = 0) {
    return a1 > b0 + pad && a0 < b1 - pad;
  }

  function rectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function findClimbableForRect(rect) {
    const centerX = rect.x + rect.w * 0.5;
    for (const climb of levelClimbables()) {
      if (centerX < climb.x - 10 || centerX > climb.x + climb.w + 10) continue;
      if (!overlap1D(rect.y, rect.y + rect.h, climb.y, climb.y + climb.h, 6)) continue;
      return climb;
    }
    return null;
  }

  function findLandingSupport(prevRect, nextRect, dropThroughPlatforms) {
    const prevBottom = prevRect.y + prevRect.h;
    const nextBottom = nextRect.y + nextRect.h;
    const left = nextRect.x + 4;
    const right = nextRect.x + nextRect.w - 4;
    let best = null;

    for (const obstacle of levelObstacles()) {
      if (!overlap1D(left, right, obstacle.x, obstacle.x + obstacle.w, 2)) continue;
      if (prevBottom > obstacle.y + 2 || nextBottom < obstacle.y) continue;
      if (!best || obstacle.y < best.y) best = { y: obstacle.y, type: "obstacle", ref: obstacle };
    }

    if (!dropThroughPlatforms) {
      for (const platform of levelPlatforms()) {
        if (!overlap1D(left, right, platform.x, platform.x + platform.w, 6)) continue;
        if (prevBottom > platform.y + 4 || nextBottom < platform.y) continue;
        if (!best || platform.y < best.y) best = { y: platform.y, type: "platform", ref: platform };
      }
    }

    const sampleX = nextRect.x + nextRect.w * 0.5;
    const groundY = terrainY(sampleX);
    if (nextBottom >= groundY && (!best || groundY < best.y)) {
      best = { y: groundY, type: "terrain", ref: null };
    }
    return best;
  }

  function resolveHorizontalSolids(prevRect, nextRect) {
    for (const obstacle of levelObstacles()) {
      if (!overlap1D(nextRect.y + 6, nextRect.y + nextRect.h - 4, obstacle.y, obstacle.y + obstacle.h, 4)) continue;
      if (!rectOverlap(nextRect, obstacle)) continue;
      if (prevRect.x + prevRect.w <= obstacle.x + 1) {
        nextRect.x = obstacle.x - nextRect.w;
      } else if (prevRect.x >= obstacle.x + obstacle.w - 1) {
        nextRect.x = obstacle.x + obstacle.w;
      }
    }
    return nextRect;
  }

  function resolveCeilingSolids(prevRect, nextRect) {
    for (const obstacle of levelObstacles()) {
      if (!overlap1D(nextRect.x + 4, nextRect.x + nextRect.w - 4, obstacle.x, obstacle.x + obstacle.w, 2)) continue;
      if (!rectOverlap(nextRect, obstacle)) continue;
      if (prevRect.y >= obstacle.y + obstacle.h - 2) {
        nextRect.y = obstacle.y + obstacle.h;
      }
    }
    return nextRect;
  }

  function supportYForPickup(c) {
    let bestY = terrainY(c.x + c.w * 0.5) - c.h;
    for (const obstacle of levelObstacles()) {
      if (c.x + c.w * 0.5 < obstacle.x || c.x + c.w * 0.5 > obstacle.x + obstacle.w) continue;
      bestY = Math.min(bestY, obstacle.y - c.h);
    }
    for (const platform of levelPlatforms()) {
      if (c.x + c.w * 0.5 < platform.x || c.x + c.w * 0.5 > platform.x + platform.w) continue;
      bestY = Math.min(bestY, platform.y - c.h);
    }
    return bestY;
  }

  function rectHit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function circleRect(c, r) {
    const cx = clamp(c.x, r.x, r.x + r.w);
    const cy = clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - cx, dy = c.y - cy;
    return dx * dx + dy * dy <= c.r * c.r;
  }

  function newLoadout(prev) {
    const out = {};
    for (const w of WEAPON_ORDER) {
      out[w] = { unlocked: w === "RIFLE", level: 1, ammo: WEAPONS[w].ammo };
    }
    if (prev) {
      for (const w of WEAPON_ORDER) {
        if (prev[w]) {
          out[w] = { ...prev[w] };
        }
      }
    }
    out.RIFLE.ammo = Infinity;
    return out;
  }

  function makePlayer(prev) {
    return {
      x: 80,
      y: terrainY(90) - 48,
      w: 32,
      h: 48,
      vx: 0,
      vy: 0,
      face: 1,
      onGround: true,
      supportType: "terrain",
      jumpLatch: false,
      hp: prev ? prev.maxHp : 220,
      maxHp: prev ? prev.maxHp : 220,
      invuln: 0,
      fireCd: 0,
      crouching: false,
      rollT: 0,
      rollCd: 0,
      rollLatch: false,
      muzzleFlashT: 0,
      climbing: false,
      climbId: null,
      dropTimer: 0,
      aimX: prev ? prev.aimX : 1,
      aimY: prev ? prev.aimY : 0,
      visualFace: prev ? (prev.visualFace ?? prev.face) : 1,
      airT: 0,
      weapon: prev ? prev.weapon : "RIFLE",
      bag: newLoadout(prev ? prev.bag : null),
    };
  }

  function resetLevel(i, keepPlayer) {
    const lvl = LEVELS[i];
    state.levelIndex = i;
    state.level = lvl;
    state.cameraX = 0;
    state.cameraLead = 180;
    state.levelClock = 0;
    state.extractionReady = false;
    state.bossActive = false;
    state.bossDefeated = false;
    state.combo = 0;
    state.comboTimer = 0;
    state.enemies = [];
    state.pending = lvl.spawns.map((s, idx) => ({ ...s, id: `${s.t}-${idx}`, variantSeed: idx }));
    state.objectives = lvl.objectives.map((o) => ({ ...o, maxHp: o.hp, destroyed: false }));
    state.bullets = [];
    state.enemyBullets = [];
    state.explosions = [];
    state.pickups = lvl.pickups.map((p, idx) => ({ id: `p-${idx}`, ...p, w: 24, h: 24, vy: 0, bob: rand(0, Math.PI * 2) }));

    if (!keepPlayer || !state.player) {
      state.player = makePlayer(null);
      state.lives = 4;
      state.score = 0;
    } else {
      const prev = state.player;
      state.player = makePlayer(prev);
      state.player.hp = state.player.maxHp;
    }

    say(`<strong>${lvl.name}</strong><br>${lvl.subtitle}<br>Use catwalks, climb grates, survive the arena boss.`, 3.6);
  }

  function startCampaign() {
    resetLevel(0, false);
    state.mode = "playing";
    splash.classList.remove("visible");
    if (DEBUG_SCENARIO) {
      setTimeout(() => {
        if (DEBUG_SCENARIO === "skip-boss") window.__nuclear_commando_debug.skipToBoss();
        if (DEBUG_SCENARIO === "clear-boss" || DEBUG_SCENARIO === "next-level") {
          window.__nuclear_commando_debug.skipToBoss();
          window.__nuclear_commando_debug.defeatBoss();
        }
      }, 0);
    }
  }

  function finishLevel() {
    if (state.levelIndex >= LEVELS.length - 1) {
      state.mode = "campaignComplete";
      say(`<strong>Operation Complete</strong><br>Score: ${Math.floor(state.score)}<br>Press Enter to replay.`, 999);
      return;
    }
    state.mode = "levelClear";
    state.transitionT = 3.4;
    say(`<strong>${state.level.name} cleared.</strong><br>Moving to ${LEVELS[state.levelIndex + 1].name}.`, 3.4);
  }

  function loseLife() {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.mode = "gameOver";
      say("<strong>Mission Failed</strong><br>Press Enter to restart campaign.", 999);
      return;
    }
    const p = state.player;
    const arenaStart = state.bossActive && state.level?.boss ? state.level.boss.arenaStart + 48 : 60;
    p.x = Math.max(arenaStart, p.x - 180);
    p.y = terrainY(p.x + 10) - p.h;
    p.vx = 0;
    p.vy = 0;
    p.climbing = false;
    p.climbId = null;
    p.dropTimer = 0;
    p.supportType = "terrain";
    p.hp = p.maxHp;
    p.invuln = 1.4;
    state.bullets = [];
    state.enemyBullets = [];
    say(`<strong>Life Lost</strong><br>${state.lives} lives remaining.`, 2);
  }

  function cycleWeapon(dir) {
    const p = state.player;
    const start = WEAPON_ORDER.indexOf(p.weapon);
    for (let s = 1; s <= WEAPON_ORDER.length; s++) {
      const idx = (start + dir * s + WEAPON_ORDER.length) % WEAPON_ORDER.length;
      const w = WEAPON_ORDER[idx];
      if (p.bag[w].unlocked) {
        p.weapon = w;
        const ammo = Number.isFinite(p.bag[w].ammo) ? Math.floor(p.bag[w].ammo) : "INF";
        say(`<strong>${WEAPONS[w].label}</strong> selected (${ammo} ammo).`, 1.1);
        return;
      }
    }
  }

  function grantWeapon(w) {
    const p = state.player;
    const slot = p.bag[w];
    const meta = WEAPONS[w];
    if (!slot.unlocked) {
      slot.unlocked = true;
      slot.ammo = Math.max(slot.ammo, meta.ammo);
      p.weapon = w;
      say(`<strong>${meta.label}</strong> unlocked.`, 1.8);
      return;
    }
    slot.level = clamp(slot.level + 1, 1, 3);
    if (Number.isFinite(slot.ammo)) {
      slot.ammo += meta.pickup;
    }
    p.weapon = w;
    say(`<strong>${meta.label}</strong> upgraded to Mk-${slot.level}.`, 1.4);
  }

  function boom(x, y, size, color) {
    state.explosions.push({ x, y, size, t: 0, ttl: 0.45, color });
  }

  function spawnEnemy(spawn) {
    const base = { x: spawn.x, y: spawn.y || 0, vx: 0, vy: 0, fireCd: rand(0.5, 1.3), wave: rand(0, Math.PI * 2), drop: 0.18 };
    const surfaceY = typeof spawn.surfaceY === "number" ? spawn.surfaceY : null;
    const patrolMin = typeof spawn.patrolMin === "number" ? spawn.patrolMin : null;
    const patrolMax = typeof spawn.patrolMax === "number" ? spawn.patrolMax : null;
    if (spawn.t === "trooper") {
      state.enemies.push({
        ...base,
        kind: "trooper",
        w: 28,
        h: 44,
        y: (surfaceY ?? terrainY(spawn.x)) - 44,
        surfaceY,
        patrolMin,
        patrolMax,
        hp: 88,
        maxHp: 88,
        speed: 88,
        dir: 1,
        attackT: 0,
        variant: spawn.variant || pickTrooperVariant(typeof spawn.variantSeed === "number" ? spawn.variantSeed : spawn.x),
      });
    } else if (spawn.t === "drone") {
      state.enemies.push({ ...base, kind: "drone", w: 34, h: 24, y: spawn.y || 250, baseY: spawn.y || 250, hp: 56, maxHp: 56, speed: 112 });
    } else if (spawn.t === "turret") {
      state.enemies.push({ ...base, kind: "turret", w: 36, h: 38, y: (surfaceY ?? terrainY(spawn.x)) - 38, surfaceY, hp: 130, maxHp: 130, speed: 0, fireCd: rand(0.3, 0.9), drop: 0.1 });
    } else if (spawn.t === "mech") {
      state.enemies.push({ ...base, kind: "mech", w: 46, h: 62, y: (surfaceY ?? terrainY(spawn.x)) - 62, surfaceY, patrolMin, patrolMax, hp: 290, maxHp: 290, speed: 54, fireCd: rand(0.7, 1.1), drop: 0.24, dir: 1 });
    } else if (spawn.t === "boss") {
      state.enemies.push({
        ...base,
        kind: "boss",
        w: spawn.w || 78,
        h: spawn.h || 96,
        y: terrainY(spawn.x) - (spawn.h || 96),
        hp: spawn.hp || 1600,
        maxHp: spawn.hp || 1600,
        speed: spawn.speed || 82,
        fireCd: 0.75,
        drop: 0,
        dir: -1,
        arenaStart: spawn.arenaStart || Math.max(0, spawn.x - 360),
        arenaEnd: spawn.arenaEnd || (state.level.length - 40),
        bossName: spawn.name || "Command Unit",
      });
    }
  }

  function fireEnemy(enemy) {
    const p = state.player;
    const sx = enemy.x + enemy.w * 0.5, sy = enemy.y + enemy.h * 0.42;
    const tx = p.x + p.w * 0.5, ty = p.y + p.h * 0.45;
    const dx = tx - sx, dy = ty - sy;
    const d = Math.hypot(dx, dy) || 1;
    if (enemy.kind === "boss") {
      const baseAngle = Math.atan2(dy, dx);
      for (const angle of [-0.24, -0.08, 0.08, 0.24]) {
        const shot = baseAngle + angle;
        state.enemyBullets.push({ x: sx, y: sy, vx: Math.cos(shot) * 420, vy: Math.sin(shot) * 420, r: 5, ttl: 2.4, dmg: 16, color: "#ffae63" });
      }
      return;
    }
    if (enemy.kind === "trooper") enemy.attackT = Math.max(enemy.attackT || 0, 0.34);
    const speed = enemy.kind === "mech" ? 440 : enemy.kind === "turret" ? 390 : 340;
    state.enemyBullets.push({ x: sx, y: sy, vx: (dx / d) * speed, vy: (dy / d) * speed, r: enemy.kind === "mech" ? 5 : 4, ttl: 2, dmg: enemy.kind === "mech" ? 18 : 10, color: enemy.kind === "turret" ? "#ff8f6a" : "#ff5969" });
  }

  function activateBossEncounter() {
    const boss = state.level?.boss;
    if (!boss || state.bossActive || state.bossDefeated) return;
    state.bossActive = true;
    spawnEnemy({ t: "boss", ...boss });
    say(`<strong>${boss.name}</strong><br>${boss.intro}`, 2.6);
  }

  function resolveTrooperSpriteBase(e) {
    const suffix = e.variant ? `_${e.variant}` : "";
    const playerAbove = state.player.y + state.player.h * 0.5 < e.y + e.h * 0.2;
    const action = e.attackT > 0.04 ? (playerAbove ? "_up" : "_fire") : "";
    const preferred = `enemy_trooper${suffix}${action}`;
    if (hasSpriteKey(`${preferred}_0`) || hasSpriteKey(preferred)) return preferred;
    const fallbackAction = action ? `enemy_trooper${action}` : `enemy_trooper${suffix}`;
    if (hasSpriteKey(`${fallbackAction}_0`) || hasSpriteKey(fallbackAction)) return fallbackAction;
    return "enemy_trooper";
  }

  function spawnDrop(enemy) {
    if (Math.random() > enemy.drop) return;
    const options = ["SPREAD", "LASER", "FLAME", "med"];
    const pick = options[Math.floor(Math.random() * options.length)];
    state.pickups.push({
      id: `${pick}-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      type: pick === "med" ? "med" : "weapon",
      weapon: pick === "med" ? undefined : pick,
      x: enemy.x + enemy.w * 0.5,
      y: enemy.y,
      w: 24,
      h: 24,
      vy: pick === "med" ? -140 : -160,
      bob: rand(0, Math.PI * 2),
    });
  }

  function spawnPlayerBullets() {
    const p = state.player;
    const weapon = p.weapon;
    const slot = p.bag[weapon];
    const meta = WEAPONS[weapon];

    if (Number.isFinite(slot.ammo) && slot.ammo <= 0) {
      p.weapon = "RIFLE";
      say("Weapon dry. Auto-switched to <strong>Rifle</strong>.", 1);
      return;
    }

    const lvl = clamp(slot.level, 1, 3);
    const muzzle = getPlayerMuzzlePoint(p);
    const aim = getPlayerAimVector(p);
    const baseAngle = Math.atan2(aim.y, aim.x);
    const mx = muzzle.x;
    const my = muzzle.y;

    function add(angle, speedScale, dmgScale, r, ttl, pierce) {
      const shotAngle = baseAngle + angle;
      const vx = Math.cos(shotAngle) * meta.speed * speedScale;
      state.bullets.push({ x: mx, y: my, vx, vy: Math.sin(shotAngle) * meta.speed * speedScale, r, ttl, dmg: meta.dmg[lvl - 1] * dmgScale, color: meta.color, weapon, pierce });
    }

    if (weapon === "RIFLE") add(0, 1, 1, 3, 1.2, 1);
    if (weapon === "LASER") add(0, 1.1, 1, 2, 1.3, meta.pierce[lvl - 1]);
    if (weapon === "SPREAD") {
      const pellets = meta.pellets[lvl - 1], cone = meta.cone[lvl - 1];
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0.5 : i / (pellets - 1);
        add(lerp(-cone * 0.5, cone * 0.5, t), 1, 0.92, 3, 0.85, 1);
      }
    }
    if (weapon === "FLAME") {
      for (let i = 0; i < 3; i++) {
        add(rand(-0.2, 0.2), rand(0.9, 1.05), rand(0.84, 1.08), meta.radius[lvl - 1], rand(meta.ttl[lvl - 1] * 0.8, meta.ttl[lvl - 1] * 1.15), 1);
      }
    }

    p.fireCd = meta.cd[lvl - 1];
    p.muzzleFlashT = weapon === "FLAME" ? 0.11 : 0.08;
    if (Number.isFinite(slot.ammo)) slot.ammo = Math.max(0, slot.ammo - 1);
  }

  function updatePlayer(dt) {
    const p = state.player;
    const left = !!keys.ArrowLeft;
    const right = !!keys.ArrowRight;
    const upHeld = !!keys.ArrowUp;
    const downHeld = !!keys.ArrowDown;
    const jumpHeld = !!keys.Space;
    const shootHeld = !!keys.KeyZ;
    const wantsRoll = !!keys.KeyR || (downHeld && shootHeld && left !== right);
    const prevOnGround = p.onGround;
    const prevRect = { x: p.x, y: p.y, w: p.w, h: p.h };
    const climbTouch = findClimbableForRect(prevRect);
    const wantsDrop = jumpHeld && !p.jumpLatch && p.onGround && p.supportType === "platform" && downHeld && p.rollT <= 0;
    let desiredFace = p.face;

    if (wantsDrop) {
      p.onGround = false;
      p.supportType = null;
      p.dropTimer = PLAYER_DROP_THROUGH;
      p.vy = Math.max(p.vy, 120);
      p.crouching = false;
    }

    if (!p.climbing && climbTouch && p.rollT <= 0 && !wantsDrop && (upHeld || (downHeld && !p.onGround))) {
      p.climbing = true;
      p.climbId = climbTouch.id;
      p.crouching = false;
      p.onGround = false;
      p.supportType = "climb";
      p.vx = 0;
      p.vy = 0;
      p.x = clamp(climbTouch.x + climbTouch.w * 0.5 - p.w * 0.5, 0, state.level.length - p.w);
    }

    if (p.climbing) {
      const climb = levelClimbables().find((c) => c.id === p.climbId) || climbTouch;
      if (!climb) {
        p.climbing = false;
        p.climbId = null;
      } else {
        if (left !== right) desiredFace = right ? 1 : -1;
        p.face = desiredFace;

        if (jumpHeld && !p.jumpLatch) {
          const launchDir = left === right ? p.face : (right ? 1 : -1);
          p.climbing = false;
          p.climbId = null;
          p.vx = launchDir * 240;
          p.vy = -760;
          p.face = launchDir;
          p.supportType = null;
        } else {
          const climbDir = (downHeld ? 1 : 0) - (upHeld ? 1 : 0);
          p.vx = 0;
          p.vy = climbDir * PLAYER_CLIMB_SPEED;
          p.x = clamp(climb.x + climb.w * 0.5 - p.w * 0.5, 0, state.level.length - p.w);
          p.y += p.vy * dt;
          p.y = clamp(p.y, climb.y - p.h * 0.38, climb.y + climb.h - p.h + 8);

          const climbRect = { x: climb.x - 12, y: climb.y - p.h * 0.4, w: climb.w + 24, h: climb.h + p.h * 0.5 + 12 };
          if (!rectOverlap({ x: p.x, y: p.y, w: p.w, h: p.h }, climbRect)) {
            p.climbing = false;
            p.climbId = null;
          }

          p.onGround = false;
          p.supportType = "climb";
          p.airT = 0;
        }
      }
    }

    if (p.climbing) {
      if (upHeld) {
        if (left !== right) {
          p.aimX = p.face * 0.72;
          p.aimY = -0.72;
        } else {
          p.aimX = 0;
          p.aimY = -1;
        }
      } else {
        if (left !== right) p.face = right ? 1 : -1;
        p.aimX = p.face;
        p.aimY = 0;
      }
      p.invuln = Math.max(0, p.invuln - dt);
      p.fireCd = Math.max(0, p.fireCd - dt);
      p.rollCd = Math.max(0, p.rollCd - dt);
      p.dropTimer = Math.max(0, p.dropTimer - dt);
      p.muzzleFlashT = Math.max(0, p.muzzleFlashT - dt);
      p.visualFace = damp(typeof p.visualFace === "number" ? p.visualFace : p.face, p.face, FACE_LERP, dt);
      p.jumpLatch = jumpHeld;
      if (shootHeld && p.fireCd <= 0) spawnPlayerBullets();
      return;
    }

    if (wantsRoll && !p.rollLatch && p.onGround && p.rollT <= 0 && p.rollCd <= 0) {
      const dir = left === right ? p.face : right ? 1 : -1;
      p.face = dir;
      p.rollT = PLAYER_ROLL_DURATION;
      p.rollCd = PLAYER_ROLL_COOLDOWN;
      p.crouching = false;
      p.vx = dir * PLAYER_ROLL_SPEED;
      p.invuln = Math.max(p.invuln, 0.24);
    }
    p.rollLatch = wantsRoll;

    if (p.rollT > 0) {
      p.rollT = Math.max(0, p.rollT - dt);
      p.vx = p.face * PLAYER_ROLL_SPEED;
      p.crouching = false;
    } else if (downHeld && p.onGround && !upHeld && !wantsDrop) {
      p.crouching = true;
      p.vx *= 0.62;
      if (Math.abs(p.vx) < 12) p.vx = 0;
      if (left !== right) desiredFace = right ? 1 : -1;
    } else {
      p.crouching = false;
      if (left === right) {
        p.vx *= 0.78;
        if (Math.abs(p.vx) < 12) p.vx = 0;
      } else {
        desiredFace = right ? 1 : -1;
        p.vx = desiredFace * PLAYER_SPEED;
      }
    }

    if (jumpHeld && !p.jumpLatch && p.onGround && !p.crouching && p.rollT <= 0 && !wantsDrop) {
      p.vy = -860;
      p.onGround = false;
      p.supportType = null;
      p.airT = 0;
    }
    p.jumpLatch = jumpHeld;
    if (!jumpHeld && p.vy < 0) p.vy *= 0.62;

    if (p.rollT <= 0) {
      if (left !== right) p.face = desiredFace;
      if (upHeld) {
        if (left !== right) {
          p.face = desiredFace;
          p.aimX = p.face * 0.72;
          p.aimY = -0.72;
        } else {
          p.aimX = 0;
          p.aimY = -1;
        }
      } else {
        p.aimX = p.face;
        p.aimY = 0;
      }
    } else {
      p.aimX = p.face;
      p.aimY = 0;
    }

    p.dropTimer = Math.max(0, p.dropTimer - dt);
    p.vy += GRAVITY * dt;
    let nextRect = {
      x: clamp(p.x + p.vx * dt, 0, state.level.length - p.w),
      y: p.y,
      w: p.w,
      h: p.h,
    };
    nextRect = resolveHorizontalSolids(prevRect, nextRect);
    p.x = clamp(nextRect.x, 0, state.level.length - p.w);

    let nextYRect = { x: p.x, y: p.y + p.vy * dt, w: p.w, h: p.h };
    if (p.vy < 0) {
      const resolved = resolveCeilingSolids({ x: p.x, y: p.y, w: p.w, h: p.h }, nextYRect);
      if (resolved.y !== nextYRect.y) p.vy = 0;
      nextYRect = resolved;
    }

    const landed = p.vy >= 0 ? findLandingSupport({ x: p.x, y: p.y, w: p.w, h: p.h }, nextYRect, p.dropTimer > 0) : null;
    if (landed) {
      nextYRect.y = landed.y - p.h;
      p.vy = 0;
      p.onGround = true;
      p.supportType = landed.type;
      p.airT = 0;
      p.climbId = null;
    } else {
      p.onGround = false;
      p.supportType = null;
      p.crouching = false;
      p.airT += dt;
    }
    p.y = nextYRect.y;
    if (!prevOnGround && p.onGround) p.airT = 0;

    p.invuln = Math.max(0, p.invuln - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.rollCd = Math.max(0, p.rollCd - dt);
    p.muzzleFlashT = Math.max(0, p.muzzleFlashT - dt);
    p.visualFace = damp(typeof p.visualFace === "number" ? p.visualFace : p.face, p.face, FACE_LERP, dt);
    if (Math.abs(p.visualFace) < 0.08) p.visualFace = p.face * 0.08;
    if (shootHeld && p.fireCd <= 0) spawnPlayerBullets();
  }

  function updateSpawns() {
    const front = state.cameraX + W + 160;
    while (state.pending.length && state.pending[0].x <= front) {
      spawnEnemy(state.pending.shift());
    }
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      e.fireCd -= dt;
      if (typeof e.attackT === "number") e.attackT = Math.max(0, e.attackT - dt);
      if (e.kind === "trooper") {
        const dir = p.x >= e.x ? 1 : -1;
        if (typeof e.patrolMin === "number" && typeof e.patrolMax === "number") {
          if (e.x <= e.patrolMin + 2) e.dir = 1;
          if (e.x >= e.patrolMax - e.w - 2) e.dir = -1;
          if (Math.abs(p.x - e.x) < 260) e.dir = dir;
          e.vx = e.dir * e.speed;
        } else {
          e.vx = dir * e.speed;
        }
        e.x += e.vx * dt;
        if (typeof e.patrolMin === "number" && typeof e.patrolMax === "number") {
          e.x = clamp(e.x, e.patrolMin, e.patrolMax - e.w);
        }
        e.y = (typeof e.surfaceY === "number" ? e.surfaceY : terrainY(e.x + e.w * 0.5)) - e.h;
        if (e.fireCd <= 0 && Math.abs(p.x - e.x) < 520) {
          fireEnemy(e);
          e.fireCd = rand(0.9, 1.5);
        }
      } else if (e.kind === "drone") {
        const dir = p.x >= e.x ? 1 : -1;
        e.x += dir * e.speed * dt;
        e.y = e.baseY + Math.sin(state.levelClock * 3 + e.wave) * 22;
        if (e.fireCd <= 0 && Math.abs(p.x - e.x) < 600) {
          fireEnemy(e);
          e.fireCd = rand(1.0, 1.4);
        }
      } else if (e.kind === "turret") {
        if (e.fireCd <= 0 && Math.abs(p.x - e.x) < 640) {
          fireEnemy(e);
          e.fireCd = rand(0.95, 1.3);
        }
      } else if (e.kind === "boss") {
        const dir = p.x >= e.x ? 1 : -1;
        if (e.x <= e.arenaStart + 24) e.dir = 1;
        if (e.x >= e.arenaEnd - e.w - 24) e.dir = -1;
        if (Math.abs(p.x - e.x) > 100) e.dir = dir;
        e.vx = e.dir * e.speed;
        e.x += e.vx * dt;
        e.x = clamp(e.x, e.arenaStart + 8, e.arenaEnd - e.w - 8);
        e.y = terrainY(e.x + e.w * 0.5) - e.h;
        if (e.fireCd <= 0 && Math.abs(p.x - e.x) < 760) {
          fireEnemy(e);
          e.fireCd = rand(0.7, 1.05);
        }
      } else {
        const dir = p.x >= e.x ? 1 : -1;
        if (typeof e.patrolMin === "number" && typeof e.patrolMax === "number") {
          if (e.x <= e.patrolMin + 2) e.dir = 1;
          if (e.x >= e.patrolMax - e.w - 2) e.dir = -1;
          if (Math.abs(p.x - e.x) < 260) e.dir = dir;
          e.vx = e.dir * e.speed;
        } else {
          e.vx = dir * e.speed;
        }
        e.x += e.vx * dt;
        if (typeof e.patrolMin === "number" && typeof e.patrolMax === "number") {
          e.x = clamp(e.x, e.patrolMin, e.patrolMax - e.w);
        }
        e.y = (typeof e.surfaceY === "number" ? e.surfaceY : terrainY(e.x + e.w * 0.5)) - e.h;
        if (e.fireCd <= 0 && Math.abs(p.x - e.x) < 700) {
          fireEnemy(e);
          e.fireCd = rand(0.75, 1.1);
        }
      }
      e.x = clamp(e.x, 0, state.level.length - e.w);
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0 && (e.kind === "boss" || e.x > state.cameraX - 240));
  }

  function updateBullets(dt) {
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
      for (const obstacle of levelObstacles()) {
        if (!circleRect({ x: b.x, y: b.y, r: b.r }, obstacle)) continue;
        b.ttl = 0;
        break;
      }
    }
    state.bullets = state.bullets.filter((b) => b.ttl > 0 && b.x > state.cameraX - 120 && b.x < state.cameraX + W + 220 && b.y > -50 && b.y < H + 60);

    for (const b of state.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
      for (const obstacle of levelObstacles()) {
        if (!circleRect({ x: b.x, y: b.y, r: b.r }, obstacle)) continue;
        b.ttl = 0;
        break;
      }
    }
    state.enemyBullets = state.enemyBullets.filter((b) => b.ttl > 0 && b.x > state.cameraX - 120 && b.x < state.cameraX + W + 220 && b.y > -40 && b.y < H + 40);
  }

  function resolveCombat() {
    const p = state.player;

    for (const b of state.bullets) {
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        if (!circleRect({ x: b.x, y: b.y, r: b.r }, e)) continue;
        e.hp -= b.dmg;
        b.pierce -= 1;
        if (e.hp <= 0) {
          if (e.kind === "boss") {
            state.score += 2600;
            state.bossActive = false;
            state.bossDefeated = true;
          } else {
            state.score += e.kind === "mech" ? 320 : 120;
          }
          state.combo += 1;
          state.comboTimer = 2.2;
          boom(e.x + e.w * 0.5, e.y + e.h * 0.5, e.kind === "boss" ? 68 : e.kind === "mech" ? 32 : 20, "#ffd37d");
          if (e.kind === "boss") {
            finishLevel();
          } else {
            spawnDrop(e);
          }
        }
        if (b.pierce <= 0) {
          b.ttl = 0;
          break;
        }
      }
      if (b.ttl <= 0) continue;
      for (const o of state.objectives) {
        if (o.destroyed) continue;
        if (!circleRect({ x: b.x, y: b.y, r: b.r }, o)) continue;
        o.hp -= b.dmg * (b.weapon === o.weak ? 1.65 : 1);
        b.pierce -= 1;
        if (o.hp <= 0) {
          o.hp = 0;
          o.destroyed = true;
          state.score += 700;
          boom(o.x + o.w * 0.5, o.y + o.h * 0.5, 48, "#ff9f74");
          if (o.reward) {
            state.pickups.push({ id: `o-${o.id}`, type: "weapon", weapon: o.reward, x: o.x + o.w * 0.5, y: o.y + o.h * 0.5, w: 24, h: 24, vy: -180, bob: rand(0, Math.PI * 2) });
          }
          say(`<strong>${o.label}</strong> disabled. Weak point: ${o.weak}.`, 1.7);
        }
        if (b.pierce <= 0) {
          b.ttl = 0;
          break;
        }
      }
    }

    state.enemies = state.enemies.filter((e) => e.hp > 0);

    for (const b of state.enemyBullets) {
      if (p.invuln > 0) continue;
      if (!circleRect({ x: b.x, y: b.y, r: b.r }, p)) continue;
      p.hp -= b.dmg;
      p.invuln = 0.9;
      b.ttl = 0;
      boom(b.x, b.y, 12, "#ff8f94");
    }

    for (const e of state.enemies) {
      if (p.invuln > 0) continue;
      if (!rectHit(e, p)) continue;
      p.hp -= e.kind === "boss" ? 24 : e.kind === "mech" ? 20 : 10;
      p.invuln = 0.9;
      p.vx = e.x > p.x ? -250 : 250;
      p.vy = -280;
      boom(p.x + p.w * 0.5, p.y + p.h * 0.5, 14, "#ffced1");
    }
  }

  function updatePickups(dt) {
    const p = state.player;
    for (const c of state.pickups) {
      c.vy += GRAVITY * 0.6 * dt;
      c.y += c.vy * dt;
      const gy = supportYForPickup(c);
      if (c.y >= gy) {
        c.y = gy;
        c.vy *= -0.2;
        if (Math.abs(c.vy) < 18) c.vy = 0;
      }
      c.bob += dt * 4;
    }

    state.pickups = state.pickups.filter((c) => {
      const hb = { x: c.x - c.w * 0.5, y: c.y, w: c.w, h: c.h };
      if (!rectHit(hb, p)) return true;
      if (c.type === "weapon" && c.weapon) {
        grantWeapon(c.weapon);
      } else {
        p.hp = clamp(p.hp + 46, 0, p.maxHp);
        say("Field kit recovered: +46 HP", 1.2);
      }
      return false;
    });
  }

  function updateHazards() {
    const p = state.player;
    for (const hazard of levelHazards()) {
      const rect = { x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h };
      if (!rectHit(rect, p)) continue;
      if (p.invuln > 0) continue;
      p.hp -= hazard.dmg || 18;
      p.invuln = 0.8;
      p.vy = -280;
      p.vx = p.x + p.w * 0.5 < hazard.x + hazard.w * 0.5 ? -220 : 220;
      boom(p.x + p.w * 0.5, p.y + p.h * 0.55, 18, hazard.kind === "acid" ? "#67ffd4" : "#ffb56c");
    }
    if (p.hp <= 0) loseLife();
  }

  function updateExplosions(dt) {
    for (const e of state.explosions) e.t += dt;
    state.explosions = state.explosions.filter((e) => e.t < e.ttl);
  }

  function updateFlow(dt) {
    if (!state.extractionReady && state.objectives.every((o) => o.destroyed)) {
      state.extractionReady = true;
      say("All critical targets neutralized. Push into the final arena.", 2.2);
    }
    const boss = state.level?.boss;
    if (boss && !state.bossDefeated && state.player.x >= boss.arenaStart - 80) {
      activateBossEncounter();
    }
    const maxCamera = Math.max(0, state.level.length - W);
    const targetLead = state.player.face > 0 ? 180 : 120;
    state.cameraLead = damp(typeof state.cameraLead === "number" ? state.cameraLead : targetLead, targetLead, CAMERA_LEAD_LERP, dt);
    let targetCameraX = clamp(state.player.x - W * 0.35 + state.cameraLead, 0, maxCamera);
    if (boss && state.bossActive) {
      targetCameraX = clamp(Math.max(targetCameraX, boss.arenaStart - 120), 0, maxCamera);
      state.player.x = clamp(state.player.x, boss.arenaStart + 18, state.level.length - state.player.w - 18);
    }
    state.cameraX = clamp(damp(state.cameraX, targetCameraX, CAMERA_LERP, dt), 0, maxCamera);
    if (state.player.x > targetCameraX + W - 130) state.player.x = targetCameraX + W - 130;
  }

  function step(dt) {
    state.levelClock += dt;
    if (state.msgT > 0) {
      state.msgT -= dt;
      if (state.msgT <= 0 && state.mode !== "gameOver" && state.mode !== "campaignComplete") clearSay();
    }
    if (state.mode === "levelClear") {
      state.transitionT -= dt;
      if (state.transitionT <= 0) {
        clearSay();
        resetLevel(state.levelIndex + 1, true);
        state.mode = "playing";
      }
      return;
    }
    if (state.mode === "transition") {
      state.transitionT -= dt;
      if (state.transitionT <= 0) {
        clearSay();
        resetLevel(state.levelIndex + 1, true);
        state.mode = "playing";
      }
      return;
    }
    if (state.mode !== "playing") return;
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) state.combo = 0;

    updateSpawns();
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    resolveCombat();
    updatePickups(dt);
    updateHazards();
    updateExplosions(dt);
    updateFlow(dt);
  }

  function drawSprite(key, x, y, w, h, flip, fallback) {
    const hdKey = `${key}_hd`;
    const resolvedKey = sprites.has(hdKey) ? hdKey : (sprites.has(key) ? key : null);
    if (!resolvedKey) {
      fallback();
      return;
    }
    const img = sprites.get(resolvedKey);
    const bounds = spriteBounds.get(resolvedKey) || { sx: 0, sy: 0, sw: img.width || 1, sh: img.height || 1 };
    const px = Math.round(x);
    const py = Math.round(y);
    const pw = Math.max(1, Math.round(w));
    const ph = Math.max(1, Math.round(h));
    const scaleX = typeof flip === "number" ? flip : (flip ? -1 : 1);
    const needsTransform = Math.abs(scaleX - 1) > 0.001;
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = "low";
    ctx.save();
    if (needsTransform) {
      const sign = scaleX < 0 ? -1 : 1;
      const magnitude = Math.max(0.08, Math.abs(scaleX));
      ctx.translate(px + (sign < 0 ? pw : 0), py);
      ctx.scale(sign * magnitude, 1);
      ctx.drawImage(img, bounds.sx, bounds.sy, bounds.sw, bounds.sh, 0, 0, pw, ph);
    } else {
      ctx.drawImage(img, bounds.sx, bounds.sy, bounds.sw, bounds.sh, px, py, pw, ph);
    }
    ctx.restore();
    ctx.imageSmoothingEnabled = prevSmooth;
  }

  function hasSpriteKey(key) {
    return sprites.has(`${key}_hd`) || sprites.has(key);
  }

  function pickAnimKey(baseKey, frames, fps, phase = 0) {
    if (!frames || frames <= 1 || !fps) return baseKey;
    const idx = Math.floor((state.levelClock * fps + phase) % frames);
    const key = `${baseKey}_${idx}`;
    if (hasSpriteKey(key)) return key;
    return baseKey;
  }

  function drawAnimSprite(baseKey, frames, fps, phase, x, y, w, h, flip, fallback) {
    const key = pickAnimKey(baseKey, frames, fps, phase);
    drawSprite(key, x, y, w, h, flip, fallback);
  }

  function drawShadowBlob(cx, cy, rx, ry, alpha = 0.24) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, `rgba(6,9,14,${alpha})`);
    g.addColorStop(1, "rgba(6,9,14,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEntityShadow(x, y, w, h, alpha = 0.24) {
    drawShadowBlob(x + w * 0.5, y + h - 1, Math.max(8, w * 0.46), Math.max(3, h * 0.15), alpha);
  }

  function drawGlowCircle(x, y, radius, color, alpha = 0.32) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWorldAtmosphere() {
    const haze = ctx.createLinearGradient(0, 0, 0, H);
    haze.addColorStop(0, "rgba(166, 209, 245, 0.06)");
    haze.addColorStop(0.58, "rgba(86, 123, 158, 0.08)");
    haze.addColorStop(1, "rgba(12, 20, 30, 0.26)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(183, 216, 242, 0.04)";
    for (let i = 0; i < 8; i++) {
      const y = 98 + i * 56 + Math.sin(state.levelClock * 0.8 + i * 0.7) * 8;
      ctx.fillRect(0, y, W, 10);
    }
  }

  function drawSurfaceBackground(p) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, p.sky1); g.addColorStop(0.5, p.sky2); g.addColorStop(1, p.sky3);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const far = state.cameraX * 0.22;
    const mid = state.cameraX * 0.42;
    ctx.fillStyle = p.back;
    for (let i = -1; i < 7; i++) {
      const x = i * 230 - (far % 230);
      ctx.beginPath(); ctx.moveTo(x, 350); ctx.lineTo(x + 90, 250); ctx.lineTo(x + 190, 350); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = p.mid;
    for (let i = -1; i < 8; i++) {
      const x = i * 180 - (mid % 180);
      ctx.beginPath(); ctx.moveTo(x, 410); ctx.lineTo(x + 70, 310); ctx.lineTo(x + 160, 410); ctx.closePath(); ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(0, H);
    const start = Math.floor(state.cameraX / 28) * 28 - 28;
    for (let x = start; x <= state.cameraX + W + 28; x += 28) {
      ctx.lineTo(x - state.cameraX, terrainY(x));
    }
    ctx.lineTo(W, H); ctx.closePath();
    const gg = ctx.createLinearGradient(0, 360, 0, H);
    gg.addColorStop(0, p.g1); gg.addColorStop(1, p.g2);
    ctx.fillStyle = gg;
    ctx.fill();

    ctx.fillStyle = "rgba(137, 176, 210, 0.1)";
    for (let i = -1; i < 9; i++) {
      const x = i * 140 - (state.cameraX * 0.35 % 140);
      ctx.fillRect(x + 24, 436, 58, 5);
    }
  }

  function drawCaveBackground(p) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, p.sky1);
    g.addColorStop(0.52, p.sky2);
    g.addColorStop(1, p.sky3);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const topShade = ctx.createLinearGradient(0, 0, 0, 220);
    topShade.addColorStop(0, "rgba(0,0,0,0.42)");
    topShade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, W, 220);

    const farShift = state.cameraX * 0.16;
    const glowShift = state.cameraX * 0.22;
    const midShift = state.cameraX * 0.36;
    const supportShift = state.cameraX * 0.54;
    const cableShift = state.cameraX * 0.7;

    ctx.fillStyle = p.back;
    for (let i = -2; i < 9; i++) {
      const x = i * 250 - (farShift % 250);
      const rise = 95 + Math.sin(i * 1.4) * 24;
      ctx.beginPath();
      ctx.moveTo(x, 384);
      ctx.lineTo(x + 58, 384 - rise);
      ctx.lineTo(x + 145, 384 - rise * 0.62);
      ctx.lineTo(x + 250, 384);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = p.glow;
    for (let i = -1; i < 8; i++) {
      const x = i * 210 - (glowShift % 210) + 105;
      const y = 230 + Math.sin(i * 1.9) * 22;
      ctx.beginPath();
      ctx.ellipse(x, y, 94, 44, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = p.mid;
    for (let i = -2; i < 11; i++) {
      const x = i * 165 - (midShift % 165);
      const ridge = 84 + Math.sin(i * 1.1) * 20;
      ctx.beginPath();
      ctx.moveTo(x, 438);
      ctx.lineTo(x + 48, 438 - ridge);
      ctx.lineTo(x + 100, 438 - ridge * 0.56);
      ctx.lineTo(x + 165, 438);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = p.roof1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = -40; x <= W + 40; x += 40) {
      const wx = x + state.cameraX * 0.24;
      const y = 66 + Math.sin(wx * 0.011) * 15 + Math.sin(wx * 0.027) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = p.roof2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = -32; x <= W + 32; x += 32) {
      const wx = x + state.cameraX * 0.38;
      const y = 112 + Math.sin(wx * 0.014) * 21 + Math.sin(wx * 0.037) * 13;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();

    for (let i = -2; i < 11; i++) {
      const x = i * 170 - (supportShift % 170);
      ctx.fillStyle = p.support;
      ctx.fillRect(x + 72, 160, 26, 250);
      ctx.fillRect(x + 54, 156, 62, 14);
      ctx.beginPath();
      ctx.moveTo(x + 54, 170);
      ctx.lineTo(x + 38, 222);
      ctx.lineTo(x + 50, 222);
      ctx.lineTo(x + 64, 170);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 116, 170);
      ctx.lineTo(x + 132, 222);
      ctx.lineTo(x + 120, 222);
      ctx.lineTo(x + 106, 170);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = p.cable;
    ctx.lineWidth = 2;
    for (let i = -1; i < 7; i++) {
      const sx = i * 220 - (cableShift % 220);
      const ex = sx + 220;
      ctx.beginPath();
      ctx.moveTo(sx, 142);
      ctx.quadraticCurveTo(sx + 110, 165, ex, 142);
      ctx.stroke();

      const lx = sx + 110;
      const ly = 162;
      ctx.fillStyle = p.light;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.ellipse(lx, ly + 14, 42, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    ctx.fillStyle = p.light;
    ctx.fillRect(lx - 3, ly - 4, 6, 10);

      drawGlowCircle(lx, ly + 8, 44, p.light, 0.1);
    }
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, H);
    const start = Math.floor(state.cameraX / 28) * 28 - 28;
    for (let x = start; x <= state.cameraX + W + 28; x += 28) {
      ctx.lineTo(x - state.cameraX, terrainY(x));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    const gg = ctx.createLinearGradient(0, 360, 0, H);
    gg.addColorStop(0, p.g1);
    gg.addColorStop(1, p.g2);
    ctx.fillStyle = gg;
    ctx.fill();

    ctx.fillStyle = "rgba(140, 182, 211, 0.09)";
    for (let i = -1; i < 8; i++) {
      const x = i * 140 - (supportShift % 140);
      ctx.fillRect(x + 18, 446, 56, 5);
    }

    ctx.fillStyle = "rgba(143, 188, 220, 0.18)";
    for (let i = 0; i < 26; i++) {
      const wx = Math.floor(state.cameraX / 120) * 120 + i * 120 - 220;
      const x = wx - state.cameraX + Math.sin((wx + state.levelClock * 64) * 0.014) * 9;
      const y = 128 + (Math.sin(wx * 0.016 + state.levelClock * 0.72) + 1) * 130;
      const r = 0.8 + (i % 3) * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(84, 118, 145, 0.09)";
    ctx.fillRect(0, 296, W, 162);
    ctx.fillStyle = "rgba(12, 20, 30, 0.26)";
    ctx.fillRect(0, 424, W, H - 424);
  }

  function drawBackground() {
    const p = state.level.palette;
    if (p.theme === "cave") {
      drawCaveBackground(p);
    } else {
      drawSurfaceBackground(p);
    }
    drawWorldAtmosphere();
  }

  function drawTraversal() {
    const p = state.level.palette;
    const steel = p.theme === "cave" ? "#6e8298" : "#7c90a4";
    const steelDark = p.theme === "cave" ? "#2c3947" : "#304152";

    for (const climb of levelClimbables()) {
      const x = climb.x - state.cameraX;
      if (x < -60 || x > W + 40) continue;
      ctx.fillStyle = "rgba(18, 24, 34, 0.32)";
      ctx.fillRect(x - 4, climb.y, climb.w + 8, climb.h);
      ctx.fillStyle = steelDark;
      ctx.fillRect(x, climb.y, 5, climb.h);
      ctx.fillRect(x + climb.w - 5, climb.y, 5, climb.h);
      ctx.fillStyle = steel;
      for (let y = climb.y + 10; y < climb.y + climb.h; y += 14) {
        ctx.fillRect(x + 5, y, climb.w - 10, 3);
      }
      drawGlowCircle(x + climb.w * 0.5, climb.y + 8, 18, "#8be8ff", 0.08);
    }

    for (const platform of levelPlatforms()) {
      const x = platform.x - state.cameraX;
      if (x < -platform.w - 30 || x > W + 30) continue;
      drawShadowBlob(x + platform.w * 0.5, platform.y + 6, platform.w * 0.42, 10, 0.18);
      ctx.fillStyle = steelDark;
      ctx.fillRect(x, platform.y, platform.w, platform.h);
      ctx.fillStyle = steel;
      ctx.fillRect(x + 4, platform.y + 2, platform.w - 8, 4);
      ctx.fillStyle = "#b4cadb";
      ctx.fillRect(x + 8, platform.y + 6, platform.w - 16, 2);
      ctx.fillStyle = "#223140";
      for (let px = x + 10; px < x + platform.w - 10; px += 26) {
        ctx.fillRect(px, platform.y + 8, 4, 4);
      }
    }

    for (const obstacle of levelObstacles()) {
      const x = obstacle.x - state.cameraX;
      if (x < -obstacle.w - 40 || x > W + 40) continue;
      drawShadowBlob(x + obstacle.w * 0.5, obstacle.y + obstacle.h, obstacle.w * 0.44, 10, 0.22);
      if (obstacle.kind === "pillar") {
        ctx.fillStyle = "#324152";
        ctx.fillRect(x, obstacle.y, obstacle.w, obstacle.h);
        ctx.fillStyle = "#8aa6c0";
        ctx.fillRect(x + 6, obstacle.y + 8, obstacle.w - 12, 8);
        ctx.fillStyle = "#4e6176";
        for (let y = obstacle.y + 24; y < obstacle.y + obstacle.h - 10; y += 18) {
          ctx.fillRect(x + 8, y, obstacle.w - 16, 4);
        }
      } else if (obstacle.kind === "barrier") {
        ctx.fillStyle = "#394557";
        ctx.fillRect(x, obstacle.y, obstacle.w, obstacle.h);
        ctx.fillStyle = "#d7b15d";
        ctx.fillRect(x + 6, obstacle.y + 10, obstacle.w - 12, 7);
        ctx.fillStyle = "#262d38";
        ctx.fillRect(x + 10, obstacle.y + 24, obstacle.w - 20, obstacle.h - 34);
      } else {
        ctx.fillStyle = "#5b4637";
        ctx.fillRect(x, obstacle.y, obstacle.w, obstacle.h);
        ctx.fillStyle = "#8a6b50";
        ctx.fillRect(x + 4, obstacle.y + 4, obstacle.w - 8, obstacle.h - 8);
        ctx.strokeStyle = "#2f241c";
        ctx.strokeRect(x + 6.5, obstacle.y + 6.5, obstacle.w - 13, obstacle.h - 13);
      }
    }

    for (const hazard of levelHazards()) {
      const x = hazard.x - state.cameraX;
      if (x < -hazard.w - 20 || x > W + 20) continue;
      if (hazard.kind === "acid") {
        ctx.fillStyle = "rgba(80, 255, 208, 0.2)";
        ctx.fillRect(x, hazard.y - 2, hazard.w, hazard.h + 4);
        ctx.fillStyle = "#69ffd4";
        for (let i = 0; i < hazard.w; i += 16) {
          const bob = Math.sin(state.levelClock * 4 + i * 0.12) * 2.5;
          ctx.fillRect(x + i, hazard.y + 3 + bob, 10, 3);
        }
      } else if (hazard.kind === "laser-floor") {
        drawGlowCircle(x + hazard.w * 0.5, hazard.y + 4, hazard.w * 0.6, "#ff9861", 0.12);
        ctx.fillStyle = "#362120";
        ctx.fillRect(x, hazard.y, hazard.w, hazard.h);
        ctx.fillStyle = "#ffb26a";
        ctx.fillRect(x + 4, hazard.y + 3, hazard.w - 8, 3);
      } else {
        ctx.fillStyle = "#8c98a8";
        for (let i = 0; i < hazard.w; i += 12) {
          ctx.beginPath();
          ctx.moveTo(x + i, hazard.y + hazard.h);
          ctx.lineTo(x + i + 6, hazard.y);
          ctx.lineTo(x + i + 12, hazard.y + hazard.h);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  function drawObjectives() {
    for (const o of state.objectives) {
      const x = o.x - state.cameraX;
      if (x < -220 || x > W + 120) continue;
      const scale = 1.24;
      const sw = o.w * scale;
      const sh = o.h * scale;
      const sx = x - (sw - o.w) * 0.5;
      const sy = o.y - (sh - o.h);
      const ratio = o.hp / o.maxHp;
      drawEntityShadow(sx, sy + sh - 4, sw, 12, 0.28);
      const anim = ANIM.objective[o.kind] || { frames: 1, fps: 0 };
      drawAnimSprite(`objective_${o.kind}`, anim.frames, anim.fps, o.x * 0.01, sx, sy, sw, sh, false, () => {
        ctx.fillStyle = o.destroyed ? "#30343a" : "#8b99ad";
        ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = o.destroyed ? "#4e5058" : "#bbc9e0";
        ctx.fillRect(sx + 8, sy + 8, sw - 16, sh - 16);
      });
      if (!o.destroyed) {
        const weakGlow = o.weak === "LASER" ? "#54f3ff" : o.weak === "FLAME" ? "#ff9042" : o.weak === "SPREAD" ? "#ffd447" : "#f1f7ff";
        drawGlowCircle(sx + sw * 0.5, sy + sh * 0.48, sw * 0.42, weakGlow, 0.08);
        ctx.fillStyle = "rgba(15,21,30,0.8)";
        ctx.fillRect(sx, sy - 20, sw, 8);
        ctx.fillStyle = weakGlow;
        ctx.fillRect(sx + 1, sy - 19, Math.max(0, (sw - 2) * ratio), 6);
      }
      ctx.fillStyle = "#e7f4ff";
      ctx.font = "12px Trebuchet MS";
      ctx.fillText(o.label, sx, sy - 28);
      if (!o.destroyed) {
        ctx.fillStyle = "#9bd1ff";
        ctx.fillText(`Weak: ${o.weak}`, sx, sy - 12);
      }
    }
  }

  function drawEnemies() {
    for (const e of state.enemies) {
      const x = e.x - state.cameraX, y = e.y, flip = state.player.x >= e.x;
      const scale = e.kind === "boss" ? 2.1 : e.kind === "trooper" ? 1.66 : e.kind === "drone" ? 1.6 : e.kind === "turret" ? 1.4 : 1.5;
      const sw = e.w * scale;
      const sh = e.h * scale;
      const sx = x - (sw - e.w) * 0.5;
      const sy = y - (sh - e.h);
      if (e.kind === "drone") {
        const gy = terrainY(e.x + e.w * 0.5);
        drawShadowBlob(sx + sw * 0.5, gy - 1, sw * 0.5, 6, 0.22);
      } else {
        drawEntityShadow(sx, sy, sw, sh, 0.25);
      }
      let baseKey = e.kind === "boss" ? "enemy_mech" : `enemy_${e.kind}`;
      let anim = ANIM.enemy[e.kind] || { frames: 1, fps: 0 };
      if (e.kind === "trooper") {
        baseKey = resolveTrooperSpriteBase(e);
        anim = baseKey.includes("_up") ? ANIM.enemy.trooper_up : baseKey.includes("_fire") ? ANIM.enemy.trooper_fire : ANIM.enemy.trooper;
      }
      const phase = (e.x * 0.013 + e.y * 0.007 + (e.wave || 0)) % 11;
      drawAnimSprite(baseKey, anim.frames, anim.fps, phase, sx, sy, sw, sh, flip, () => {
        if (e.kind === "trooper") { ctx.fillStyle = "#f15d5d"; ctx.fillRect(sx, sy, sw, sh); }
        else if (e.kind === "drone") { ctx.fillStyle = "#f7b267"; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = "#201f2a"; ctx.fillRect(sx + 6, sy + 4, sw - 12, 8); }
        else if (e.kind === "turret") { ctx.fillStyle = "#d6617c"; ctx.fillRect(sx, sy, sw, sh); ctx.fillRect(sx + 10, sy - 8, 16, 8); }
        else if (e.kind === "boss") { ctx.fillStyle = "#ff9b57"; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = "#352133"; ctx.fillRect(sx + 10, sy + 8, sw - 20, sh - 18); }
        else { ctx.fillStyle = "#ff9169"; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = "#352133"; ctx.fillRect(sx + 8, sy + 10, sw - 16, 20); }
      });
      ctx.fillStyle = "rgba(10,12,16,0.78)";
      ctx.fillRect(sx, sy - 8, sw, 4);
      ctx.fillStyle = "#ff8d9a";
      ctx.fillRect(sx + 1, sy - 7, Math.max(0, (sw - 2) * (e.hp / e.maxHp)), 2);
      if (e.kind === "boss") {
        ctx.fillStyle = "#ffd98a";
        ctx.font = "bold 14px Trebuchet MS";
        ctx.fillText(e.bossName, sx + 6, sy - 16);
      }
    }
  }

  function drawPickups() {
    for (const c of state.pickups) {
      const x = c.x - state.cameraX - c.w * 0.5;
      const y = c.y + Math.sin(c.bob) * 3;
      if (x < -40 || x > W + 20) continue;
      const scale = 1.34;
      const sw = c.w * scale;
      const sh = c.h * scale;
      const sx = x - (sw - c.w) * 0.5;
      const sy = y - (sh - c.h) * 0.5;
      const aura = c.type === "med" ? "#76f2ab" : c.weapon === "LASER" ? "#65f3ff" : c.weapon === "FLAME" ? "#ff9e49" : "#ffe163";
      drawGlowCircle(sx + sw * 0.5, sy + sh * 0.5, sw * 0.95, aura, 0.16);
      drawEntityShadow(sx, sy, sw, sh, 0.18);
      if (c.type === "med") {
        drawAnimSprite("pickup_med", ANIM.pickup.frames, ANIM.pickup.fps, c.bob, sx, sy, sw, sh, false, () => {
          ctx.fillStyle = "#74df98"; ctx.fillRect(sx, sy, sw, sh);
          ctx.fillStyle = "#1a4630"; ctx.fillRect(sx + 9, sy + 4, 6, 16); ctx.fillRect(sx + 4, sy + 9, 16, 6);
        });
      } else {
        const w = c.weapon || "RIFLE";
        drawAnimSprite(`pickup_${w.toLowerCase()}`, ANIM.pickup.frames, ANIM.pickup.fps, c.bob + 0.5, sx, sy, sw, sh, false, () => {
          const color = w === "LASER" ? "#54f3ff" : w === "FLAME" ? "#ff8b2f" : w === "SPREAD" ? "#ffd447" : "#f2f5ff";
          ctx.fillStyle = color; ctx.fillRect(sx, sy, sw, sh);
          ctx.fillStyle = "#212838"; ctx.font = "bold 12px Trebuchet MS"; ctx.fillText(w[0], sx + 8, sy + 16);
        });
      }
    }
  }

  function drawBullets() {
    for (const b of state.bullets) {
      const x = b.x - state.cameraX;
      const tx = x - b.vx * 0.018;
      const ty = b.y - b.vy * 0.018;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = Math.max(1.2, b.r * 1.1);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, b.y);
      ctx.stroke();
      ctx.restore();
      drawGlowCircle(x, b.y, b.r * 4.2, b.color, 0.24);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.enemyBullets) {
      const x = b.x - state.cameraX;
      const tx = x - b.vx * 0.015;
      const ty = b.y - b.vy * 0.015;
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = Math.max(1, b.r);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, b.y);
      ctx.stroke();
      ctx.restore();
      drawGlowCircle(x, b.y, b.r * 3.2, b.color, 0.2);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    const p = state.player;
    const x = p.x - state.cameraX, y = p.y;
    const scale = 1.86;
    const sw = p.w * scale;
    const sh = p.h * scale;
    const sx = x - (sw - p.w) * 0.5;
    const sy = y - (sh - p.h);
    drawEntityShadow(sx, sy, sw, sh, 0.26);
    const aimMode = getPlayerAimMode(p);
    const flipScale = typeof p.visualFace === "number" ? p.visualFace : p.face;
    const key = p.climbing
      ? "player_climb"
      : p.rollT > 0
      ? "player_roll"
      : (p.crouching && p.onGround
        ? "player_crouch"
        : (!p.onGround
          ? (aimMode === "up"
            ? "player_air_up"
            : aimMode === "diag"
              ? "player_air_diag"
              : (p.muzzleFlashT > 0 ? "player_air_forward" : "player_jump"))
          : (Math.abs(p.vx) > 20
            ? (aimMode === "up" ? "player_run_up" : aimMode === "diag" ? "player_run_diag" : "player_run")
            : (aimMode === "up" ? "player_idle_up" : aimMode === "diag" ? "player_idle_diag" : "player_idle"))));
    const anim = ANIM.player[key] || { frames: 1, fps: 0 };
    drawAnimSprite(key, anim.frames, anim.fps, p.x * 0.013 + (flipScale < 0 ? 0.5 : 0), sx, sy, sw, sh, flipScale, () => {
      ctx.fillStyle = p.invuln > 0 && Math.floor(state.levelClock * 18) % 2 === 0 ? "#ffd8d8" : "#f1f8ff";
      if (key === "player_roll") {
        ctx.beginPath();
        ctx.ellipse(sx + sw * 0.5, sy + sh * 0.74, sw * 0.45, sh * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3f79ff";
        ctx.beginPath();
        ctx.ellipse(sx + sw * 0.46, sy + sh * 0.72, sw * 0.32, sh * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (key === "player_crouch") {
        ctx.fillRect(sx + 2, sy + sh * 0.46, sw - 4, sh * 0.54);
        ctx.fillStyle = "#2f3742";
        ctx.fillRect(sx + sw * 0.26, sy + sh * 0.32, sw * 0.44, sh * 0.2);
        ctx.fillStyle = "#ff5a5a";
        ctx.fillRect(sx + sw * 0.22, sy + sh * 0.28, sw * 0.5, sh * 0.04);
        ctx.fillStyle = "#3f79ff";
        ctx.fillRect(sx + sw * 0.2, sy + sh * 0.58, sw * 0.56, sh * 0.34);
      } else {
        ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = "#2f3742";
        ctx.fillRect(sx + sw * 0.25, sy + sh * 0.12, sw * 0.5, sh * 0.25);
        ctx.fillStyle = "#ff5a5a";
        ctx.fillRect(sx + sw * 0.2, sy + sh * 0.08, sw * 0.6, sh * 0.06);
        ctx.fillStyle = "#3f79ff";
        ctx.fillRect(sx + sw * 0.25, sy + sh * 0.42, sw * 0.5, sh * 0.45);
      }
      ctx.fillStyle = "#d9e4ff";
      if (flipScale < 0) ctx.fillRect(sx - 6, sy + sh * 0.52, 14, 4);
      else ctx.fillRect(sx + sw - 6, sy + sh * 0.52, 14, 4);
    });

    if (p.rollT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#9dc8ff";
      for (let i = 0; i < 4; i++) {
        const ox = flipScale < 0 ? sx + sw + i * 4 : sx - i * 4;
        ctx.fillRect(ox, sy + sh * 0.48 + i, 10 + i * 2, 10 - i);
      }
      ctx.restore();
    }

    if (p.muzzleFlashT > 0) {
      const muzzle = getPlayerMuzzlePoint(p);
      const aim = getPlayerAimVector(p);
      const mx = muzzle.x - state.cameraX;
      const my = muzzle.y;
      const nx = -aim.y;
      const ny = aim.x;
      drawGlowCircle(mx, my, 16, "#ffe27c", 0.3);
      ctx.fillStyle = "#fff2b2";
      ctx.beginPath();
      ctx.moveTo(mx + aim.x * 14, my + aim.y * 14);
      ctx.lineTo(mx - aim.x * 2 + nx * 4.5, my - aim.y * 2 + ny * 4.5);
      ctx.lineTo(mx - aim.x * 2 - nx * 4.5, my - aim.y * 2 - ny * 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffb347";
      ctx.beginPath();
      ctx.moveTo(mx + aim.x * 8, my + aim.y * 8);
      ctx.lineTo(mx - aim.x * 1 + nx * 2.3, my - aim.y * 1 + ny * 2.3);
      ctx.lineTo(mx - aim.x * 1 - nx * 2.3, my - aim.y * 1 - ny * 2.3);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawEffects() {
    for (const e of state.explosions) {
      const k = e.t / e.ttl;
      drawGlowCircle(e.x - state.cameraX, e.y, e.size * (1.1 + k), e.color, 0.14 * (1 - k));
      ctx.globalAlpha = 1 - k;
      const size = e.size * (0.8 + k * 0.9);
      const frame = Math.min(5, Math.max(0, Math.floor(k * 6)));
      drawSprite(`fx_explosion_${frame}`, e.x - state.cameraX - size * 0.5, e.y - size * 0.5, size, size, false, () => {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x - state.cameraX, e.y, e.size * (0.4 + k * 0.8), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
  }

  function drawExtraction() {
    const boss = state.level?.boss;
    if (!boss || state.bossDefeated) return;
    const x = boss.arenaStart - state.cameraX;
    if (x < -120 || x > W + 140) return;
    const y = terrainY(boss.arenaStart + 24) - 110;
    ctx.fillStyle = "rgba(38, 53, 69, 0.8)";
    ctx.fillRect(x, y, 34, 112);
    ctx.fillStyle = "#7f95a8";
    ctx.fillRect(x + 4, y + 8, 26, 96);
    ctx.fillStyle = state.bossActive ? "#ff9861" : "#7fffd3";
    ctx.fillRect(x + 12, y - 18, 10, 18);
    ctx.font = "12px Trebuchet MS";
    ctx.fillText(state.bossActive ? "ARENA LOCK" : "BOSS GATE", x - 18, y - 28);
  }

  function drawHud() {
    const p = state.player;
    const left = state.objectives.filter((o) => !o.destroyed).length;
    const slot = p.bag[p.weapon];
    const ammo = Number.isFinite(slot.ammo) ? Math.floor(slot.ammo) : "INF";

    const hudGrad = ctx.createLinearGradient(10, 10, 10, 76);
    hudGrad.addColorStop(0, "rgba(8, 19, 30, 0.9)");
    hudGrad.addColorStop(1, "rgba(4, 12, 19, 0.78)");
    ctx.fillStyle = hudGrad;
    ctx.fillRect(10, 10, W - 20, 66);
    ctx.strokeStyle = "rgba(124, 172, 221, 0.32)";
    ctx.lineWidth = 1;
    ctx.strokeRect(10.5, 10.5, W - 21, 65);
    ctx.fillStyle = "rgba(120, 169, 215, 0.24)";
    ctx.fillRect(12, 42, W - 24, 1);
    ctx.fillStyle = "#ecf6ff";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText(`Level: ${state.level.name}`, 18, 30);
    ctx.fillText(`Score: ${Math.floor(state.score)}`, 18, 52);
    ctx.fillText(`Lives: ${state.lives}`, 240, 30);
    ctx.fillText(`Targets Left: ${left}`, 240, 52);
    ctx.fillText(`Weapon: ${WEAPONS[p.weapon].label} Mk-${slot.level}`, 470, 30);
    ctx.fillText(`Ammo: ${ammo}`, 470, 52);

    const hp = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = "rgba(18,23,32,0.9)";
    ctx.fillRect(760, 24, 180, 16);
    ctx.fillStyle = hp > 0.45 ? "#5ef0a3" : hp > 0.2 ? "#ffd447" : "#ff6b57";
    ctx.fillRect(762, 26, 176 * hp, 12);
    ctx.fillStyle = "#ecf6ff";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, 784, 53);

    const boss = state.enemies.find((e) => e.kind === "boss");
    if (boss) {
      ctx.fillStyle = "rgba(18,23,32,0.9)";
      ctx.fillRect(W * 0.5 - 170, 82, 340, 16);
      ctx.fillStyle = "#ff9567";
      ctx.fillRect(W * 0.5 - 168, 84, 336 * clamp(boss.hp / boss.maxHp, 0, 1), 12);
      ctx.fillStyle = "#fff0d8";
      ctx.font = "bold 13px Trebuchet MS";
      ctx.fillText(boss.bossName, W * 0.5 - 56, 78);
    }

    if (state.combo >= 2 && state.comboTimer > 0) {
      ctx.fillStyle = "#ffd447";
      ctx.font = "bold 16px Trebuchet MS";
      ctx.fillText(`Combo x${state.combo}`, W * 0.5 - 45, 98);
    }

    if (state.mode === "paused") {
      ctx.fillStyle = "rgba(4,8,12,0.66)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f3f8ff";
      ctx.font = "bold 42px Trebuchet MS";
      ctx.fillText("PAUSED", W * 0.5 - 90, H * 0.5);
    }

    if (state.mode === "gameOver") {
      ctx.fillStyle = "rgba(16,0,0,0.58)";
      ctx.fillRect(0, 0, W, H);
    }

    if (state.mode === "campaignComplete") {
      ctx.fillStyle = "rgba(4,8,12,0.6)";
      ctx.fillRect(0, 0, W, H);
    }

    if (state.mode === "levelClear") {
      ctx.fillStyle = "rgba(6,10,16,0.66)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawPostFx() {
    const vignette = ctx.createRadialGradient(W * 0.5, H * 0.44, 180, W * 0.5, H * 0.52, W * 0.8);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.012)";
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(0, y, W, 1);
    }
  }

  function drawSplashCard() {
    ctx.fillStyle = "rgba(6, 13, 22, 0.86)";
    ctx.fillRect(120, 90, W - 240, H - 180);
    ctx.strokeStyle = "rgba(147, 199, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(120, 90, W - 240, H - 180);

    ctx.fillStyle = "#f1f8ff";
    ctx.font = "bold 42px Trebuchet MS";
    ctx.fillText("NUCLEAR COMMANDO", 212, 170);

    ctx.fillStyle = "#9ed0ff";
    ctx.font = "bold 16px Trebuchet MS";
    ctx.fillText("Retro assault. Tactical objectives. No room for hesitation.", 188, 206);

    ctx.fillStyle = "#e2eefc";
    ctx.font = "14px Trebuchet MS";
    ctx.fillText("Move: Arrow Left/Right", 190, 250);
    ctx.fillText("Aim: Arrow Up / Up + Direction", 190, 274);
    ctx.fillText("Jump: Space   Crouch: Arrow Down", 190, 298);
    ctx.fillText("Drop Through Catwalk: Down + Space", 190, 322);
    ctx.fillText("Climb Grates: Hold Up/Down near a wall", 190, 346);
    ctx.fillText("Shoot: Z   Roll: R", 190, 370);
    ctx.fillText("Cycle Weapons: A / B   Pause: P   Fullscreen: F", 190, 394);

    ctx.fillStyle = "#ffd447";
    ctx.font = "bold 20px Trebuchet MS";
    ctx.fillText("Press Enter or click Start Operation", 254, 436);
  }

  function drawLevelClearCard() {
    if (state.mode !== "levelClear") return;
    const next = LEVELS[state.levelIndex + 1];
    ctx.fillStyle = "rgba(7, 14, 24, 0.88)";
    ctx.fillRect(180, 120, W - 360, H - 240);
    ctx.strokeStyle = "rgba(147, 199, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(180, 120, W - 360, H - 240);
    ctx.fillStyle = "#f1f8ff";
    ctx.font = "bold 38px Trebuchet MS";
    ctx.fillText(`${state.level.name} Clear`, 280, 198);
    ctx.fillStyle = "#9ed0ff";
    ctx.font = "bold 16px Trebuchet MS";
    ctx.fillText("Boss destroyed. The route deeper inside is open.", 248, 236);
    ctx.fillStyle = "#e2eefc";
    ctx.font = "14px Trebuchet MS";
    ctx.fillText(`Score: ${Math.floor(state.score)}`, 270, 286);
    ctx.fillText(`Lives Remaining: ${state.lives}`, 270, 314);
    if (next) {
      ctx.fillText(`Next Operation: ${next.name}`, 270, 356);
      ctx.fillText(next.subtitle, 270, 382);
    }
  }

  function render() {
    drawBackground();
    drawTraversal();
    drawObjectives();
    drawExtraction();
    drawPickups();
    drawEnemies();
    drawBullets();
    drawPlayer();
    drawEffects();
    drawHud();
    drawPostFx();
    if (state.mode === "splash") drawSplashCard();
    drawLevelClearCard();
  }

  function loop(now) {
    const dt = Math.min((now - (loop.last || now)) / 1000, 0.05);
    loop.last = now;
    state.acc += dt;
    while (state.acc >= DT) {
      if (state.mode !== "paused" && state.mode !== "splash") step(DT);
      state.acc -= DT;
    }
    render();
    requestAnimationFrame(loop);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Ignore fullscreen errors.
    }
  }

  function onKeyDown(e) {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyZ", "KeyR", "KeyA", "KeyB"].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === "KeyF") {
      toggleFullscreen();
      return;
    }
    if (e.code === "Escape" && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }

    if (state.mode === "splash") {
      if (e.code === "Enter") startCampaign();
      return;
    }

    if (state.mode === "playing" || state.mode === "paused") {
      if (e.code === "KeyP") state.mode = state.mode === "playing" ? "paused" : "playing";
      if (!e.repeat && e.code === "KeyA") cycleWeapon(-1);
      if (!e.repeat && e.code === "KeyB") cycleWeapon(1);
      return;
    }

    if ((state.mode === "gameOver" || state.mode === "campaignComplete") && e.code === "Enter") {
      startCampaign();
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyZ", "KeyR", "KeyA", "KeyB"].includes(e.code)) {
      e.preventDefault();
    }
  }

  window.render_game_to_text = () => {
    const p = state.player;
    const boss = state.enemies.find((e) => e.kind === "boss") || null;
    const payload = {
      coordinateSystem: { origin: "top-left", xDirection: "right", yDirection: "down" },
      mode: state.mode,
      level: {
        index: state.levelIndex,
        name: state.level.name,
        cameraX: Math.round(state.cameraX),
        extractionReady: state.extractionReady,
        bossActive: state.bossActive,
        bossDefeated: state.bossDefeated,
        platforms: levelPlatforms().length,
        climbables: levelClimbables().length,
        hazards: levelHazards().length,
      },
      player: {
        x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy),
        hp: Math.round(p.hp), maxHp: p.maxHp, onGround: p.onGround, crouching: p.crouching, rolling: p.rollT > 0, climbing: p.climbing,
        rollCooldown: Number(p.rollCd.toFixed(2)), muzzleFlash: p.muzzleFlashT > 0, facing: p.face, visualFacing: Number((p.visualFace || p.face).toFixed(2)),
        support: p.supportType || null,
        aim: { x: Number((p.aimX || 0).toFixed(2)), y: Number((p.aimY || 0).toFixed(2)), mode: getPlayerAimMode(p) },
        activeWeapon: p.weapon,
      },
      objectives: state.objectives.slice(0, 8).map((o) => ({ id: o.id, label: o.label, x: Math.round(o.x), y: Math.round(o.y), hp: Math.round(o.hp), maxHp: o.maxHp, destroyed: o.destroyed, weakness: o.weak })),
      enemies: state.enemies.slice(0, 16).map((e) => ({ kind: e.kind, variant: e.variant || null, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp) })),
      boss: boss ? { name: boss.bossName, hp: Math.round(boss.hp), maxHp: boss.maxHp, x: Math.round(boss.x), y: Math.round(boss.y) } : null,
      bullets: { player: state.bullets.length, enemy: state.enemyBullets.length },
      pickups: state.pickups.slice(0, 10).map((c) => ({ type: c.type, weapon: c.weapon || null, x: Math.round(c.x), y: Math.round(c.y) })),
      score: Math.round(state.score),
      lives: state.lives,
      timer: Number(state.levelClock.toFixed(2)),
    };
    return JSON.stringify(payload);
  };

  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / (DT * 1000)));
    for (let i = 0; i < steps; i++) {
      if (state.mode !== "paused" && state.mode !== "splash") step(DT);
    }
    render();
    return Promise.resolve();
  };

  window.__nuclear_commando_debug = {
    getState() {
      return JSON.parse(window.render_game_to_text());
    },
    clearObjectives() {
      for (const o of state.objectives) {
        o.hp = 0;
        o.destroyed = true;
      }
      state.extractionReady = true;
    },
    skipToBoss() {
      const boss = state.level?.boss;
      if (!boss) return false;
      this.clearObjectives();
      state.player.x = boss.arenaStart + 48;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      activateBossEncounter();
      return true;
    },
    defeatBoss() {
      const boss = state.enemies.find((e) => e.kind === "boss");
      if (!boss) return false;
      state.bossActive = false;
      state.bossDefeated = true;
      boom(boss.x + boss.w * 0.5, boss.y + boss.h * 0.5, 68, "#ffd37d");
      state.enemies = state.enemies.filter((e) => e !== boss);
      finishLevel();
      return true;
    },
  };

  function measureOpaqueBounds(img) {
    const w = Math.max(1, img.naturalWidth || img.width || 1);
    const h = Math.max(1, img.naturalHeight || img.height || 1);
    const probe = document.createElement("canvas");
    probe.width = w;
    probe.height = h;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    if (!pctx) return { sx: 0, sy: 0, sw: w, sh: h };
    pctx.clearRect(0, 0, w, h);
    pctx.drawImage(img, 0, 0, w, h);
    const pixels = pctx.getImageData(0, 0, w, h).data;

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = pixels[(y * w + x) * 4 + 3];
        if (a <= 8) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < minX || maxY < minY) {
      return { sx: 0, sy: 0, sw: w, sh: h };
    }

    const pad = 2;
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const ex = Math.min(w - 1, maxX + pad);
    const ey = Math.min(h - 1, maxY + pad);
    return {
      sx,
      sy,
      sw: Math.max(1, ex - sx + 1),
      sh: Math.max(1, ey - sy + 1),
    };
  }

  async function loadSprites() {
    try {
      const inlineManifest = window.NUCLEAR_COMMANDO_SPRITE_MANIFEST
        && typeof window.NUCLEAR_COMMANDO_SPRITE_MANIFEST === "object"
        ? window.NUCLEAR_COMMANDO_SPRITE_MANIFEST
        : null;
      const manifest = inlineManifest || await (async () => {
        const res = await fetch("./assets/sprites/manifest.json", { cache: "no-store" });
        if (!res.ok) return null;
        return res.json();
      })();
      if (!manifest) return;
      const entries = Object.entries(manifest);
      await Promise.all(entries.map(([key, rel]) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          sprites.set(key, img);
          spriteBounds.set(key, measureOpaqueBounds(img));
          resolve();
        };
        img.onerror = () => resolve();
        img.src = `./assets/sprites/${rel}`;
      })));
      if (entries.length && sprites.size) say(`<strong>${sprites.size}</strong> custom sprites loaded from manifest.`, 2.2);
    } catch {
      // Fallback art remains active.
    }
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  startBtn.addEventListener("click", () => {
    if (state.mode === "splash") startCampaign();
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      canvas.style.width = "";
      canvas.style.height = "";
    } else {
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
  });

  resetLevel(0, false);
  state.mode = "splash";
  clearSay();
  loadSprites();
  requestAnimationFrame(loop);
})();
