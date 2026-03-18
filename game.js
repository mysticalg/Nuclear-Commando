(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = "low";
  const splash = document.getElementById("splash");
  const banner = document.getElementById("banner");
  const startBtn = document.getElementById("start-btn");

  const DT = 1 / 60;
  const GRAVITY = 2200;
  const W = canvas.width;
  const H = canvas.height;
  const PLAYER_SPEED = 295;
  const PLAYER_ROLL_SPEED = 420;
  const PLAYER_ROLL_DURATION = 0.38;
  const PLAYER_ROLL_COOLDOWN = 0.68;

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
      player_run: { frames: 8, fps: 14 },
      player_jump: { frames: 2, fps: 6 },
      player_crouch: { frames: 2, fps: 5 },
      player_roll: { frames: 4, fps: 16 },
    },
    enemy: {
      trooper: { frames: 6, fps: 12 },
      drone: { frames: 4, fps: 12 },
      turret: { frames: 3, fps: 5 },
      mech: { frames: 6, fps: 8 },
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
      spawns: [
        { t: "trooper", x: 520 }, { t: "trooper", x: 820 }, { t: "drone", x: 1060, y: 258 }, { t: "turret", x: 1380 }, { t: "trooper", x: 1660 },
        { t: "drone", x: 1940, y: 236 }, { t: "trooper", x: 2220 }, { t: "turret", x: 2480 }, { t: "trooper", x: 2860 }, { t: "drone", x: 3120, y: 214 },
        { t: "turret", x: 3440 }, { t: "trooper", x: 3780 }, { t: "mech", x: 4120 }, { t: "drone", x: 4460, y: 224 }, { t: "trooper", x: 4820 },
        { t: "turret", x: 5160 }, { t: "drone", x: 5480, y: 245 }, { t: "trooper", x: 5880 }, { t: "mech", x: 6240 }, { t: "drone", x: 6620, y: 216 },
        { t: "trooper", x: 7040 }, { t: "turret", x: 7300 },
      ],
      pickups: [{ type: "med", x: 2360, y: 360 }, { type: "med", x: 5060, y: 352 }],
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
      spawns: [
        { t: "trooper", x: 460 }, { t: "drone", x: 860, y: 240 }, { t: "trooper", x: 1080 }, { t: "turret", x: 1240 }, { t: "trooper", x: 1640 },
        { t: "drone", x: 1780, y: 220 }, { t: "trooper", x: 2060 }, { t: "turret", x: 2480 }, { t: "drone", x: 2580, y: 280 }, { t: "trooper", x: 2980 },
        { t: "trooper", x: 3320 }, { t: "turret", x: 3600 }, { t: "drone", x: 3720, y: 250 }, { t: "mech", x: 3920 }, { t: "trooper", x: 4620 },
      ],
      pickups: [{ type: "med", x: 1890, y: 368 }, { type: "med", x: 3480, y: 355 }],
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
      spawns: [
        { t: "trooper", x: 520 }, { t: "drone", x: 860, y: 248 }, { t: "turret", x: 1180 }, { t: "trooper", x: 1500 }, { t: "drone", x: 1820, y: 225 },
        { t: "trooper", x: 2140 }, { t: "turret", x: 2500 }, { t: "mech", x: 2880 }, { t: "drone", x: 3200, y: 218 }, { t: "trooper", x: 3520 },
        { t: "turret", x: 3900 }, { t: "drone", x: 4180, y: 242 }, { t: "mech", x: 4480 }, { t: "trooper", x: 5060 },
      ],
      pickups: [{ type: "med", x: 2300, y: 350 }, { type: "med", x: 4160, y: 344 }],
    },
  ];

  const state = {
    mode: "splash",
    levelIndex: 0,
    level: null,
    cameraX: 0,
    score: 0,
    lives: 4,
    combo: 0,
    comboTimer: 0,
    extractionReady: false,
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
      weapon: prev ? prev.weapon : "RIFLE",
      bag: newLoadout(prev ? prev.bag : null),
    };
  }

  function resetLevel(i, keepPlayer) {
    const lvl = LEVELS[i];
    state.levelIndex = i;
    state.level = lvl;
    state.cameraX = 0;
    state.levelClock = 0;
    state.extractionReady = false;
    state.combo = 0;
    state.comboTimer = 0;
    state.enemies = [];
    state.pending = lvl.spawns.map((s, idx) => ({ ...s, id: `${s.t}-${idx}` }));
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

    say(`<strong>${lvl.name}</strong><br>${lvl.subtitle}<br>Destroy all targets, then reach extraction.`, 3.6);
  }

  function startCampaign() {
    resetLevel(0, false);
    state.mode = "playing";
    splash.classList.remove("visible");
  }

  function finishLevel() {
    if (state.levelIndex >= LEVELS.length - 1) {
      state.mode = "campaignComplete";
      say(`<strong>Operation Complete</strong><br>Score: ${Math.floor(state.score)}<br>Press Enter to replay.`, 999);
      return;
    }
    state.mode = "transition";
    state.transitionT = 2.4;
    say(`<strong>${state.level.name} neutralized.</strong><br>Moving to next operation.`, 2.4);
  }

  function loseLife() {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.mode = "gameOver";
      say("<strong>Mission Failed</strong><br>Press Enter to restart campaign.", 999);
      return;
    }
    const p = state.player;
    p.x = Math.max(60, p.x - 180);
    p.y = terrainY(p.x + 10) - p.h;
    p.vx = 0;
    p.vy = 0;
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
    if (spawn.t === "trooper") {
      state.enemies.push({ ...base, kind: "trooper", w: 28, h: 44, y: terrainY(spawn.x) - 44, hp: 88, maxHp: 88, speed: 88 });
    } else if (spawn.t === "drone") {
      state.enemies.push({ ...base, kind: "drone", w: 34, h: 24, y: spawn.y || 250, baseY: spawn.y || 250, hp: 56, maxHp: 56, speed: 112 });
    } else if (spawn.t === "turret") {
      state.enemies.push({ ...base, kind: "turret", w: 36, h: 38, y: terrainY(spawn.x) - 38, hp: 130, maxHp: 130, speed: 0, fireCd: rand(0.3, 0.9), drop: 0.1 });
    } else if (spawn.t === "mech") {
      state.enemies.push({ ...base, kind: "mech", w: 46, h: 62, y: terrainY(spawn.x) - 62, hp: 290, maxHp: 290, speed: 54, fireCd: rand(0.7, 1.1), drop: 0.24 });
    }
  }

  function fireEnemy(enemy) {
    const p = state.player;
    const sx = enemy.x + enemy.w * 0.5, sy = enemy.y + enemy.h * 0.42;
    const tx = p.x + p.w * 0.5, ty = p.y + p.h * 0.45;
    const dx = tx - sx, dy = ty - sy;
    const d = Math.hypot(dx, dy) || 1;
    const speed = enemy.kind === "mech" ? 440 : enemy.kind === "turret" ? 390 : 340;
    state.enemyBullets.push({ x: sx, y: sy, vx: (dx / d) * speed, vy: (dy / d) * speed, r: enemy.kind === "mech" ? 5 : 4, ttl: 2, dmg: enemy.kind === "mech" ? 18 : 10, color: enemy.kind === "turret" ? "#ff8f6a" : "#ff5969" });
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
    const mx = p.face > 0 ? p.x + p.w + 2 : p.x - 2;
    const my = p.y + 19;

    function add(angle, speedScale, dmgScale, r, ttl, pierce) {
      const vx = Math.cos(angle) * meta.speed * speedScale * p.face;
      const vy = Math.sin(angle) * meta.speed * speedScale;
      state.bullets.push({ x: mx, y: my, vx, vy, r, ttl, dmg: meta.dmg[lvl - 1] * dmgScale, color: meta.color, weapon, pierce });
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
    const downHeld = !!keys.ArrowDown;
    const jumpHeld = !!keys.ArrowUp;
    const shootHeld = !!keys.Space;
    const wantsRoll = !!keys.KeyR || (downHeld && shootHeld && left !== right);

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
    } else if (downHeld && p.onGround) {
      p.crouching = true;
      p.vx *= 0.62;
      if (Math.abs(p.vx) < 12) p.vx = 0;
      if (left !== right) p.face = right ? 1 : -1;
    } else {
      p.crouching = false;
      if (left === right) {
        p.vx *= 0.78;
        if (Math.abs(p.vx) < 12) p.vx = 0;
      } else {
        p.vx = (right ? 1 : -1) * PLAYER_SPEED;
        p.face = right ? 1 : -1;
      }
    }

    if (jumpHeld && !p.jumpLatch && p.onGround && !p.crouching && p.rollT <= 0) {
      p.vy = -860;
      p.onGround = false;
    }
    p.jumpLatch = jumpHeld;
    if (!jumpHeld && p.vy < 0) p.vy *= 0.62;

    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, 0, state.level.length - p.w);

    const gy = terrainY(p.x + p.w * 0.5);
    if (p.y + p.h >= gy) {
      p.y = gy - p.h;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
      p.crouching = false;
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.rollCd = Math.max(0, p.rollCd - dt);
    p.muzzleFlashT = Math.max(0, p.muzzleFlashT - dt);
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
      if (e.kind === "trooper") {
        const dir = p.x >= e.x ? 1 : -1;
        e.vx = dir * e.speed;
        e.x += e.vx * dt;
        e.y = terrainY(e.x + e.w * 0.5) - e.h;
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
      } else {
        const dir = p.x >= e.x ? 1 : -1;
        e.vx = dir * e.speed;
        e.x += e.vx * dt;
        e.y = terrainY(e.x + e.w * 0.5) - e.h;
        if (e.fireCd <= 0 && Math.abs(p.x - e.x) < 700) {
          fireEnemy(e);
          e.fireCd = rand(0.75, 1.1);
        }
      }
      e.x = clamp(e.x, 0, state.level.length - e.w);
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0 && e.x > state.cameraX - 240);
  }

  function updateBullets(dt) {
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
    }
    state.bullets = state.bullets.filter((b) => b.ttl > 0 && b.x > state.cameraX - 120 && b.x < state.cameraX + W + 220 && b.y > -50 && b.y < H + 60);

    for (const b of state.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
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
          state.score += e.kind === "mech" ? 320 : 120;
          state.combo += 1;
          state.comboTimer = 2.2;
          boom(e.x + e.w * 0.5, e.y + e.h * 0.5, e.kind === "mech" ? 32 : 20, "#ffd37d");
          spawnDrop(e);
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
      p.hp -= e.kind === "mech" ? 20 : 10;
      p.invuln = 0.9;
      p.vx = e.x > p.x ? -250 : 250;
      p.vy = -280;
      boom(p.x + p.w * 0.5, p.y + p.h * 0.5, 14, "#ffced1");
    }

    if (p.hp <= 0) loseLife();
  }

  function updatePickups(dt) {
    const p = state.player;
    for (const c of state.pickups) {
      c.vy += GRAVITY * 0.6 * dt;
      c.y += c.vy * dt;
      const gy = terrainY(c.x + c.w * 0.5) - c.h;
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

  function updateExplosions(dt) {
    for (const e of state.explosions) e.t += dt;
    state.explosions = state.explosions.filter((e) => e.t < e.ttl);
  }

  function updateFlow() {
    if (!state.extractionReady && state.objectives.every((o) => o.destroyed)) {
      state.extractionReady = true;
      say("All critical targets neutralized. Reach extraction.", 2.2);
    }
    if (state.extractionReady && state.player.x >= state.level.length - 120) finishLevel();
    const lead = state.player.face > 0 ? 180 : 120;
    state.cameraX = clamp(state.player.x - W * 0.35 + lead, 0, Math.max(0, state.level.length - W));
    if (state.player.x > state.cameraX + W - 130) state.player.x = state.cameraX + W - 130;
  }

  function step(dt) {
    state.levelClock += dt;
    if (state.msgT > 0) {
      state.msgT -= dt;
      if (state.msgT <= 0 && state.mode !== "gameOver" && state.mode !== "campaignComplete") clearSay();
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
    updateExplosions(dt);
    updateFlow();
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
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = "low";
    ctx.save();
    if (flip) {
      ctx.translate(px + pw, py);
      ctx.scale(-1, 1);
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
      const scale = e.kind === "trooper" ? 1.66 : e.kind === "drone" ? 1.6 : e.kind === "turret" ? 1.4 : 1.5;
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
      const anim = ANIM.enemy[e.kind] || { frames: 1, fps: 0 };
      const phase = (e.x * 0.013 + e.y * 0.007 + (e.wave || 0)) % 11;
      drawAnimSprite(`enemy_${e.kind}`, anim.frames, anim.fps, phase, sx, sy, sw, sh, flip, () => {
        if (e.kind === "trooper") { ctx.fillStyle = "#f15d5d"; ctx.fillRect(sx, sy, sw, sh); }
        else if (e.kind === "drone") { ctx.fillStyle = "#f7b267"; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = "#201f2a"; ctx.fillRect(sx + 6, sy + 4, sw - 12, 8); }
        else if (e.kind === "turret") { ctx.fillStyle = "#d6617c"; ctx.fillRect(sx, sy, sw, sh); ctx.fillRect(sx + 10, sy - 8, 16, 8); }
        else { ctx.fillStyle = "#ff9169"; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = "#352133"; ctx.fillRect(sx + 8, sy + 10, sw - 16, 20); }
      });
      ctx.fillStyle = "rgba(10,12,16,0.78)";
      ctx.fillRect(sx, sy - 8, sw, 4);
      ctx.fillStyle = "#ff8d9a";
      ctx.fillRect(sx + 1, sy - 7, Math.max(0, (sw - 2) * (e.hp / e.maxHp)), 2);
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
    const x = p.x - state.cameraX, y = p.y, flip = p.face < 0;
    const scale = 1.86;
    const sw = p.w * scale;
    const sh = p.h * scale;
    const sx = x - (sw - p.w) * 0.5;
    const sy = y - (sh - p.h);
    drawEntityShadow(sx, sy, sw, sh, 0.26);
    const key = p.rollT > 0
      ? "player_roll"
      : (p.crouching && p.onGround
        ? "player_crouch"
        : (!p.onGround ? "player_jump" : Math.abs(p.vx) > 20 ? "player_run" : "player_idle"));
    const anim = ANIM.player[key] || { frames: 1, fps: 0 };
    drawAnimSprite(key, anim.frames, anim.fps, p.x * 0.013 + (flip ? 0.5 : 0), sx, sy, sw, sh, flip, () => {
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
      if (flip) ctx.fillRect(sx - 6, sy + sh * 0.52, 14, 4);
      else ctx.fillRect(sx + sw - 6, sy + sh * 0.52, 14, 4);
    });

    if (p.rollT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#9dc8ff";
      for (let i = 0; i < 4; i++) {
        const ox = flip ? sx + sw + i * 4 : sx - i * 4;
        ctx.fillRect(ox, sy + sh * 0.48 + i, 10 + i * 2, 10 - i);
      }
      ctx.restore();
    }

    if (p.muzzleFlashT > 0) {
      const flashW = 18;
      const flashH = 18;
      const flashX = flip ? sx - flashW * 0.62 : sx + sw - 2;
      const flashY = sy + (p.rollT > 0 ? sh * 0.38 : p.crouching ? sh * 0.53 : sh * 0.42);
      drawGlowCircle(flashX + flashW * 0.5, flashY + flashH * 0.5, 16, "#ffe27c", 0.3);
      drawAnimSprite("fx_muzzle_flash", 3, 24, state.levelClock * 2.1, flashX, flashY, flashW, flashH, flip, () => {
        ctx.fillStyle = "#ffe27c";
        ctx.beginPath();
        if (flip) {
          ctx.moveTo(flashX + flashW, flashY + flashH * 0.5);
          ctx.lineTo(flashX + 3, flashY + 2);
          ctx.lineTo(flashX + 3, flashY + flashH - 2);
        } else {
          ctx.moveTo(flashX, flashY + flashH * 0.5);
          ctx.lineTo(flashX + flashW - 3, flashY + 2);
          ctx.lineTo(flashX + flashW - 3, flashY + flashH - 2);
        }
        ctx.closePath();
        ctx.fill();
      });
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
    if (!state.extractionReady) return;
    const x = state.level.length - 120 - state.cameraX;
    if (x < -80 || x > W + 80) return;
    const y = terrainY(state.level.length - 120) - 90;
    ctx.strokeStyle = "#7fffd3";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 60, 80);
    ctx.fillStyle = "#7fffd3";
    ctx.fillRect(x + 24, y - 22, 12, 20);
    ctx.font = "12px Trebuchet MS";
    ctx.fillText("EXTRACT", x - 8, y - 30);
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
    ctx.fillText("Jump: Arrow Up", 190, 274);
    ctx.fillText("Crouch: Arrow Down", 190, 298);
    ctx.fillText("Roll: R  (or Down + Move + Shoot)", 190, 322);
    ctx.fillText("Shoot: Space", 190, 346);
    ctx.fillText("Cycle Weapons: A / B", 190, 370);
    ctx.fillText("Pause: P   Fullscreen: F", 190, 394);

    ctx.fillStyle = "#ffd447";
    ctx.font = "bold 20px Trebuchet MS";
    ctx.fillText("Press Enter or click Start Operation", 254, 436);
  }

  function render() {
    drawBackground();
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
  }

  window.render_game_to_text = () => {
    const p = state.player;
    const payload = {
      coordinateSystem: { origin: "top-left", xDirection: "right", yDirection: "down" },
      mode: state.mode,
      level: { index: state.levelIndex, name: state.level.name, cameraX: Math.round(state.cameraX), extractionReady: state.extractionReady },
      player: {
        x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy),
        hp: Math.round(p.hp), maxHp: p.maxHp, onGround: p.onGround, crouching: p.crouching, rolling: p.rollT > 0,
        rollCooldown: Number(p.rollCd.toFixed(2)), muzzleFlash: p.muzzleFlashT > 0, facing: p.face, activeWeapon: p.weapon,
      },
      objectives: state.objectives.slice(0, 8).map((o) => ({ id: o.id, label: o.label, x: Math.round(o.x), y: Math.round(o.y), hp: Math.round(o.hp), maxHp: o.maxHp, destroyed: o.destroyed, weakness: o.weak })),
      enemies: state.enemies.slice(0, 16).map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp) })),
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
