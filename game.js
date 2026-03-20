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
  const PLAYER_CLIMB_SPEED = 185;
  const PLAYER_HANG_SPEED = 165;
  const PLAYER_HANG_ATTACH_OFFSET = 2;
  const PLAYER_DROP_THROUGH = 0.22;
  const PLAYER_HANG_RELEASE = 0.18;
  const SPRITE_FRAME_SIZE = 160;
  const PLAYER_REFERENCE_VISIBLE_HEIGHT = 114;
  const TROOPER_REFERENCE_VISIBLE_HEIGHT = 101;
  const PLAYER_VISUAL_SCALE = 0.55;
  const PLAYER_UP_POSE_SCALE_MULT = 1.27;
  const TROOPER_VISUAL_SCALE = PLAYER_VISUAL_SCALE * (PLAYER_REFERENCE_VISIBLE_HEIGHT / TROOPER_REFERENCE_VISIBLE_HEIGHT);
  const CAMERA_LERP = 6.4;
  const CAMERA_LEAD_LERP = 8.2;
  const FACE_LERP = 10.5;
  const BLOOD_GRAVITY = 1180;
  const MAX_CORPSES = 120;
  const MAX_BLOOD_PARTICLES = 320;
  const TROOPER_RESPAWN_DELAY = 5;
  const CORPSE_STACK_OVERLAP = 12;
  const BULLET_RADIUS_SCALE = 0.5;
  const MUZZLE_FLASH_FORWARD_OFFSET = 2.5;
  const PLAYER_CANONICAL_BOUNDS = Object.freeze({ sx: 31 / 160, sy: 21 / 160, sw: 98 / 160, sh: 123 / 160 });
  const TROOPER_CANONICAL_BOUNDS = Object.freeze({ sx: 21 / 160, sy: 18 / 160, sw: 118 / 160, sh: 126 / 160 });
  const PLAYER_FRAME_ANCHOR = Object.freeze({ x: 80 / SPRITE_FRAME_SIZE, y: 142 / SPRITE_FRAME_SIZE });
  const TROOPER_FRAME_ANCHOR = Object.freeze({ x: 79 / SPRITE_FRAME_SIZE, y: 142 / SPRITE_FRAME_SIZE });
  const SMART_BOMB_STOCK = 5;
  const SMART_BOMB_GROW_DURATION = 3.2;
  const SMART_BOMB_FLASH_DURATION = 0.22;
  const SMART_BOMB_WHITEOUT_HOLD = 0.72;
  const SMART_BOMB_FADE_DURATION = 1.45;
  const SMART_BOMB_DURATION = SMART_BOMB_GROW_DURATION + SMART_BOMB_FLASH_DURATION + SMART_BOMB_WHITEOUT_HOLD + SMART_BOMB_FADE_DURATION;
  const SMART_BOMB_MAX_RADIUS = 1360;
  const CRATE_HP = 200;
  const SHIELD_HITS_PER_PICKUP = 3;
  const MAX_SHIELD_HITS = 6;
  const OBJECTIVE_DEATH_DURATION = 1.15;
  const OBJECTIVE_CENTRIFUGE_DEATH_DURATION = 1.35;
  const OBJECTIVE_REACTOR_DEATH_DURATION = 1.55;
  const PLAYER_DEATH_FALL_DURATION = 0.42;
  const PLAYER_DEATH_EXPLODE_DURATION = 1.58;
  const PLAYER_DEATH_TOTAL_DURATION = PLAYER_DEATH_FALL_DURATION + PLAYER_DEATH_EXPLODE_DURATION;
  const BOSS_DEATH_DURATION = 5;
  const BOSS_WHITEOUT_DURATION = 5;
  const BOSS_DEATH_TOTAL_DURATION = BOSS_DEATH_DURATION + BOSS_WHITEOUT_DURATION;
  const AUDIO_MAP_STORAGE_KEY = "nuclear-commando-audio-map-v1";
  const AUDIO_PREFS_STORAGE_KEY = "nuclear-commando-audio-prefs-v1";
  const DEFAULT_AUDIO_MAP = {
    stage1: "stage1",
    stage2: "stage2",
    stage3: "stage6",
    boss: "boss_main",
    bossAlt: "boss_simple",
    stageClear: "stage_clear",
    campaignClear: "campaign_clear",
    gameOver: "game_over",
    bossIntro: "steel_spider",
    menuStart: "sfx_01",
    playerFire: "sfx_02",
    enemyFire: "sfx_03",
    playerJump: "sfx_04",
    explosion: "sfx_05",
    bigExplosion: "sfx_06",
    playerHit: "sfx_07",
    playerDeath: "sfx_08",
    pickupWeapon: "sfx_09",
    pickupMed: "sfx_10",
    weaponUpgrade: "sfx_11",
    checkpoint: "sfx_12",
    objectiveDestroy: "sfx_13",
    bossAlarm: "sfx_15",
    uiMove: "sfx_16",
    nuclearBlast: "sfx_27",
  };

  const keys = Object.create(null);
  const sprites = new Map();
  const spriteBounds = new Map();
  const environmentImages = new Map();
  let spritesReady = false;
  let debugHidePauseOverlay = false;

  const ENV_ART_MANIFEST = {
    caveCrystal: "cb4dffda-pixel-art-crystalline-cave-glowing-geodes-underground-compressed.jpg",
    caveEmerald: "aHR0cHM6Ly9iLnN0YWJsZWNvZy5jb20vODc5ZmE3MDUtYTQ5Ny00OTE1LTgyMjUtZjM3YzdjNjMyZjc3LmpwZWc.webp",
    industrialZone: "Free-Industrial-Zone-Tileset-Pixel-Art5-720x480.webp",
    industrialAtlas: "deshfsw-418d0116-ef10-4106-871a-7154fdadafdf.png",
    structureTiles: "environment_structure_tiles.png",
    ruinTiles: "environment_ruin_tiles.png",
  };
  const ENV_TILE_SETS = {
    ruins: {
      platformTop: { art: "structureTiles", sx: 0, sy: 0, sw: 96, sh: 28, mode: "repeat-x", fit: "height" },
      platformBeam: { art: "structureTiles", sx: 0, sy: 32, sw: 96, sh: 44, mode: "repeat-x", fit: "height" },
      hangBar: { art: "structureTiles", sx: 0, sy: 80, sw: 64, sh: 8, mode: "repeat-x", fit: "height" },
      columnFace: { art: "structureTiles", sx: 96, sy: 0, sw: 32, sh: 96, mode: "repeat-y", fit: "width" },
      terrainTop: { art: "structureTiles", sx: 128, sy: 0, sw: 64, sh: 24, mode: "repeat-x", fit: "height" },
      terrainFill: { art: "structureTiles", sx: 128, sy: 24, sw: 64, sh: 64, mode: "repeat-xy", scale: 1 },
      supportFace: { art: "ruinTiles", sx: 0, sy: 64, sw: 48, sh: 96, mode: "repeat-y", fit: "width" },
      wallFace: { art: "ruinTiles", sx: 0, sy: 0, sw: 64, sh: 64, mode: "repeat-xy", scale: 1 },
    },
    industrial: {
      platformTop: { art: "structureTiles", sx: 0, sy: 0, sw: 96, sh: 28, mode: "repeat-x", fit: "height" },
      platformBeam: { art: "structureTiles", sx: 0, sy: 32, sw: 96, sh: 44, mode: "repeat-x", fit: "height" },
      hangBar: { art: "structureTiles", sx: 0, sy: 80, sw: 64, sh: 8, mode: "repeat-x", fit: "height" },
      columnFace: { art: "structureTiles", sx: 96, sy: 0, sw: 32, sh: 96, mode: "repeat-y", fit: "width" },
      terrainTop: { art: "structureTiles", sx: 128, sy: 0, sw: 64, sh: 24, mode: "repeat-x", fit: "height" },
      terrainFill: { art: "structureTiles", sx: 128, sy: 24, sw: 64, sh: 64, mode: "repeat-xy", scale: 1 },
      supportFace: { art: "industrialAtlas", sx: 384, sy: 1076, sw: 64, sh: 64, mode: "repeat-y", fit: "width" },
      wallFace: { art: "industrialAtlas", sx: 512, sy: 1076, sw: 64, sh: 64, mode: "repeat-xy", scale: 1 },
    },
  };
  const CAVE_RENDER_PRESETS = {
    crystal: {
      crystalBackdrop: ["caveCrystal", "caveEmerald"],
      glowBackdrop: ["caveEmerald"],
      industrialBackdrop: ["industrialZone"],
      crystalAlpha: 0.22,
      crystalY: 34,
      crystalHeight: 430,
      crystalScale: 1.12,
      glowAlpha: 0.16,
      glowY: -18,
      glowHeight: 320,
      industrialAlpha: 0.14,
      industrialY: 164,
      industrialHeight: 250,
      atmosphericWash: "rgba(46, 92, 126, 0.1)",
      atmosphericBandY: 136,
      atmosphericBandH: 210,
      floorGlow: "rgba(60, 117, 150, 0.08)",
      topVeil: "rgba(14, 20, 32, 0.18)",
      dustColor: "rgba(143, 188, 220, 0.18)",
      nearFog: "rgba(84, 118, 145, 0.09)",
      bottomShade: "rgba(12, 20, 30, 0.26)",
    },
    basalt: {
      crystalBackdrop: ["caveCrystal"],
      glowBackdrop: ["industrialZone"],
      industrialBackdrop: ["industrialZone"],
      crystalAlpha: 0.15,
      crystalY: 8,
      crystalHeight: 390,
      crystalScale: 1.04,
      glowAlpha: 0.06,
      glowY: 10,
      glowHeight: 270,
      industrialAlpha: 0.3,
      industrialY: 94,
      industrialHeight: 318,
      atmosphericWash: "rgba(26, 56, 88, 0.22)",
      atmosphericBandY: 88,
      atmosphericBandH: 270,
      floorGlow: "rgba(114, 176, 214, 0.04)",
      topVeil: "rgba(8, 14, 24, 0.28)",
      dustColor: "rgba(162, 196, 226, 0.1)",
      nearFog: "rgba(70, 92, 120, 0.14)",
      bottomShade: "rgba(8, 14, 22, 0.34)",
    },
    coolant: {
      crystalBackdrop: ["caveEmerald", "caveCrystal"],
      glowBackdrop: ["caveEmerald"],
      industrialBackdrop: ["industrialZone", "caveEmerald"],
      crystalAlpha: 0.2,
      crystalY: 22,
      crystalHeight: 470,
      crystalScale: 1.18,
      glowAlpha: 0.24,
      glowY: -4,
      glowHeight: 356,
      industrialAlpha: 0.16,
      industrialY: 166,
      industrialHeight: 248,
      atmosphericWash: "rgba(34, 106, 120, 0.24)",
      atmosphericBandY: 132,
      atmosphericBandH: 248,
      floorGlow: "rgba(70, 210, 194, 0.14)",
      topVeil: "rgba(4, 20, 26, 0.2)",
      dustColor: "rgba(128, 244, 232, 0.18)",
      nearFog: "rgba(52, 108, 118, 0.14)",
      bottomShade: "rgba(5, 20, 24, 0.3)",
    },
  };

  const WEAPON_ORDER = ["RIFLE", "SPREAD", "LASER", "FLAME"];
  const WEAPONS = {
    RIFLE: { label: "Rifle", dmg: [20, 28, 36], cd: [0.12, 0.1, 0.08], speed: 860, color: "#f3f8ff", ammo: Infinity, pickup: 0 },
    SPREAD: { label: "Spread", dmg: [14, 18, 24], cd: [0.18, 0.155, 0.13], speed: 760, pellets: [3, 4, 5], cone: [0.28, 0.34, 0.42], color: "#ffd447", ammo: Infinity, pickup: 0 },
    LASER: { label: "Laser", dmg: [30, 40, 52], cd: [0.16, 0.13, 0.105], speed: 1080, pierce: [2, 3, 4], color: "#46ebff", ammo: Infinity, pickup: 0 },
    FLAME: { label: "Flame", dmg: [9, 13, 17], cd: [0.09, 0.078, 0.066], speed: 430, ttl: [0.32, 0.38, 0.43], radius: [7, 8.5, 10], color: "#ff8b2f", ammo: Infinity, pickup: 0 },
  };
  const ANIM = {
    player: {
      player_idle: { frames: 6, fps: 7 },
      player_idle_up: { frames: 6, fps: 7 },
      player_idle_diag: { frames: 6, fps: 7 },
      player_idle_down_diag: { frames: 6, fps: 7 },
      player_run: { frames: 8, fps: 14 },
      player_run_up: { frames: 8, fps: 14 },
      player_run_diag: { frames: 8, fps: 14 },
      player_run_down_diag: { frames: 8, fps: 14 },
      player_jump: { frames: 6, fps: 16 },
      player_air_forward: { frames: 4, fps: 10 },
      player_air_up: { frames: 4, fps: 10 },
      player_air_diag: { frames: 4, fps: 10 },
      player_air_down_diag: { frames: 4, fps: 10 },
      player_crouch: { frames: 2, fps: 5 },
      player_prone: { frames: 2, fps: 0 },
      player_climb: { frames: 8, fps: 10 },
      player_climb_up: { frames: 4, fps: 8 },
      player_climb_diag: { frames: 4, fps: 8 },
      player_climb_forward: { frames: 4, fps: 8 },
    player_climb_forward_right: { frames: 4, fps: 8 },
    player_climb_up_right: { frames: 4, fps: 8 },
    player_climb_diag_right: { frames: 4, fps: 8 },
    player_climb_down_diag_right: { frames: 4, fps: 8 },
    player_climb_down_right: { frames: 4, fps: 8 },
      player_climb_down_diag: { frames: 4, fps: 8 },
      player_climb_down: { frames: 4, fps: 8 },
      player_hang: { frames: 8, fps: 10 },
      player_hang_up: { frames: 4, fps: 8 },
      player_hang_diag: { frames: 4, fps: 8 },
      player_hang_forward: { frames: 4, fps: 8 },
      player_hang_down_diag: { frames: 4, fps: 8 },
      player_hang_down: { frames: 4, fps: 8 },
    },
    enemy: {
      trooper: { frames: 6, fps: 12 },
      trooper_fire: { frames: 6, fps: 12 },
      trooper_up: { frames: 6, fps: 12 },
      trooper_death: { frames: 7, fps: 16 },
      drone: { frames: 5, fps: 10 },
      drone_attack: { frames: 4, fps: 10 },
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
    prop: {
      prop_cooling_plant: { frames: 2, fps: 2 },
      prop_waste_barrel: { frames: 2, fps: 2 },
      prop_cooling_pool: { frames: 2, fps: 2 },
      prop_warning_sign: { frames: 2, fps: 2 },
      prop_reactor_dome: { frames: 1, fps: 0 },
      prop_centrifuge_stack: { frames: 1, fps: 0 },
      prop_reactor_gate: { frames: 2, fps: 2 },
      prop_reactor_claw: { frames: 2, fps: 2 },
      prop_pipe_cannon: { frames: 1, fps: 0 },
      prop_plasma_turret: { frames: 2, fps: 2 },
    },
    pickup: { frames: 3, fps: 6 },
  };
  const OBJECTIVE_SPRITE_STYLES = {
    centrifuge: { baseKey: "objective_centrifuge", frames: 2, fps: 4, floorOffset: 8 },
    factory: { baseKey: "objective_factory", frames: 2, fps: 3, floorOffset: 8 },
    radar: { baseKey: "objective_radar", frames: 2, fps: 4, floorOffset: 4 },
    reactor: { baseKey: "objective_reactor", frames: 3, fps: 5, floorOffset: 10 },
    factorySilo: { baseKey: "objective_factory_silo", frames: 2, fps: 3, floorOffset: 12 },
    reactorCoreAlt: { baseKey: "objective_reactor_core_alt", frames: 3, fps: 5, floorOffset: 12 },
    reactorArcAlt: { baseKey: "objective_reactor_arc_alt", frames: 3, fps: 5, floorOffset: 12 },
  };
  const DETAIL_PROP_DEFS = {
    coolingPlant: { baseKey: "prop_cooling_plant", frames: 2, fps: 2, w: 152, h: 116, shadow: 0.22, glow: "#b5e1ff", glowRadius: 34, glowAlpha: 0.06, glowY: 0.22, floorOffset: 8 },
    wasteBarrel: { baseKey: "prop_waste_barrel", frames: 2, fps: 2, w: 88, h: 102, shadow: 0.18, glow: "#72ff6c", glowRadius: 28, glowAlpha: 0.08, glowY: 0.74, floorOffset: 4 },
    coolingPool: { baseKey: "prop_cooling_pool", frames: 2, fps: 2, w: 156, h: 122, shadow: 0.2, glow: "#6de4ff", glowRadius: 42, glowAlpha: 0.08, glowY: 0.54, floorOffset: 8 },
    consoleBank: { baseKey: "objective_radar", frames: 2, fps: 4, w: 126, h: 92, shadow: 0.18, glow: "#ff8d46", glowRadius: 28, glowAlpha: 0.07, glowY: 0.42, floorOffset: 6 },
    missileCart: { baseKey: "objective_factory", frames: 2, fps: 3, w: 132, h: 84, shadow: 0.18, glow: "#ffd86c", glowRadius: 26, glowAlpha: 0.06, glowY: 0.52, floorOffset: 10 },
    centrifugeBank: { baseKey: "objective_centrifuge", frames: 2, fps: 4, w: 132, h: 108, shadow: 0.2, glow: "#7cff77", glowRadius: 32, glowAlpha: 0.08, glowY: 0.48, floorOffset: 10 },
    reactorDome: { baseKey: "prop_reactor_dome", frames: 1, fps: 0, w: 158, h: 118, shadow: 0.22, glow: "#ffe783", glowRadius: 34, glowAlpha: 0.05, glowY: 0.26, floorOffset: 8 },
    centrifugeStack: { baseKey: "prop_centrifuge_stack", frames: 1, fps: 0, w: 106, h: 118, shadow: 0.2, floorOffset: 8 },
    warningSign: { baseKey: "prop_warning_sign", frames: 2, fps: 2, w: 64, h: 64, shadow: 0.12, glow: "#ffd85c", glowRadius: 24, glowAlpha: 0.1, glowY: 0.52, floorOffset: 2 },
    reactorGate: { baseKey: "prop_reactor_gate", frames: 2, fps: 2, w: 154, h: 104, shadow: 0.2, glow: "#ff7f47", glowRadius: 34, glowAlpha: 0.08, glowY: 0.48, floorOffset: 8 },
  };
  const MECH_SPRITE_STYLES = {
    crawler: {
      idle: { baseKey: "enemy_mech_crawler_idle", frames: 4, fps: 4, anchor: { x: 0.82, y: 0.42 } },
      walk: { baseKey: "enemy_mech_crawler_walk", frames: 4, fps: 6, anchor: { x: 0.82, y: 0.42 } },
      attack: { baseKey: "enemy_mech_crawler_attack", frames: 4, fps: 8, anchor: { x: 0.8, y: 0.36 } },
    },
    walker: {
      idle: { baseKey: "enemy_mech_walker_idle", frames: 2, fps: 4, anchor: { x: 0.86, y: 0.38 } },
      walk: { baseKey: "enemy_mech_walker_walk", frames: 4, fps: 6, anchor: { x: 0.86, y: 0.38 } },
      attack: { baseKey: "enemy_mech_walker_attack", frames: 4, fps: 8, anchor: { x: 0.88, y: 0.34 } },
    },
  };
  const BOSS_SPRITE_STYLES = {
    giantskull: {
      idle: { baseKey: "enemy_boss_giantskull_idle", frames: 2, fps: 3, anchor: { x: 0.82, y: 0.18 } },
      walk: { baseKey: "enemy_boss_giantskull_walk", frames: 4, fps: 5, anchor: { x: 0.82, y: 0.18 } },
      attack: { baseKey: "enemy_boss_giantskull_attack", frames: 2, fps: 6, anchor: { x: 0.84, y: 0.18 } },
    },
    ironskull: {
      idle: { baseKey: "enemy_boss_ironskull_idle", frames: 4, fps: 4, anchor: { x: 0.84, y: 0.32 } },
      walk: { baseKey: "enemy_boss_ironskull_walk", frames: 6, fps: 6, anchor: { x: 0.84, y: 0.32 } },
      attack: { baseKey: "enemy_boss_ironskull_attack", frames: 6, fps: 8, anchor: { x: 0.88, y: 0.31 } },
    },
    skulltank: {
      idle: { baseKey: "enemy_boss_skulltank_idle", frames: 2, fps: 3, anchor: { x: 0.9, y: 0.42 } },
      walk: { baseKey: "enemy_boss_skulltank_walk", frames: 4, fps: 5, anchor: { x: 0.9, y: 0.42 } },
      attack: { baseKey: "enemy_boss_skulltank_attack", frames: 3, fps: 7, anchor: { x: 0.92, y: 0.38 } },
    },
    demonspider: {
      idle: { baseKey: "enemy_boss_demonspider_idle", frames: 2, fps: 3, anchor: { x: 0.54, y: 0.42 } },
      walk: { baseKey: "enemy_boss_demonspider_walk", frames: 4, fps: 5, anchor: { x: 0.54, y: 0.42 } },
      attack: { baseKey: "enemy_boss_demonspider_attack", frames: 2, fps: 6, anchor: { x: 0.56, y: 0.4 } },
    },
    cyberbrute: {
      idle: { baseKey: "enemy_boss_cyberbrute_idle", frames: 2, fps: 3, anchor: { x: 0.82, y: 0.34 } },
      walk: { baseKey: "enemy_boss_cyberbrute_walk", frames: 4, fps: 5, anchor: { x: 0.82, y: 0.34 } },
      attack: { baseKey: "enemy_boss_cyberbrute_attack", frames: 2, fps: 7, anchor: { x: 0.84, y: 0.34 } },
    },
  };
  const MECH_STYLE_DIMS = {
    crawler: { w: 46, h: 62 },
    walker: { w: 66, h: 38 },
  };
  const BOSS_STYLE_DIMS = {
    giantskull: { w: 96, h: 78 },
    ironskull: { w: 72, h: 96 },
    skulltank: { w: 100, h: 72 },
    demonspider: { w: 102, h: 72 },
    cyberbrute: { w: 86, h: 100 },
  };
  const LEVEL_BOSS_STYLE = ["giantskull", "demonspider", "cyberbrute"];

  const LEVELS = [
    {
      name: "Subterranean Breach",
      subtitle: "Penetrate the deep cave base and sabotage enrichment lines",
      length: 7600,
      height: 980,
      top: -260,
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
        structureTiles: "ruins",
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
        { id: "forge", label: "Missile Forge", kind: "factory", spriteStyle: "factorySilo", x: 3980, y: 330, w: 142, h: 122, hp: 440, weak: "FLAME", reward: "LASER" },
        { id: "reactor", label: "Core Reactor", kind: "reactor", spriteStyle: "reactorCoreAlt", x: 6520, y: 286, w: 170, h: 168, hp: 620, weak: "LASER", reward: "FLAME" },
      ],
      detailProps: [
        { kind: "wasteBarrel", x: 1628, y: 454 },
        { kind: "consoleBank", x: 2208, y: 452 },
        { kind: "missileCart", x: 3912, y: 452 },
        { kind: "reactorGate", x: 5890, y: 452 },
        { kind: "coolingPlant", x: 6156, y: 452 },
        { kind: "wasteBarrel", x: 6396, y: 454 },
      ],
      platforms: [
        { id: "l1-shaft-1", x: 520, y: 386, w: 168, h: 12 },
        { id: "l1-shaft-2", x: 706, y: 252, w: 168, h: 12 },
        { id: "l1-shaft-3", x: 520, y: 116, w: 168, h: 12 },
        { id: "l1-shaft-4", x: 706, y: -20, w: 168, h: 12 },
        { id: "l1-shaft-5", x: 520, y: -156, w: 168, h: 12 },
        { id: "l1-catwalk-5", x: 1480, y: 358, w: 150, h: 12 },
        { id: "l1-catwalk-6", x: 2050, y: 306, w: 178, h: 12 },
        { id: "l1-catwalk-7", x: 2500, y: 342, w: 154, h: 12 },
        { id: "l1-catwalk-8", x: 3220, y: 302, w: 170, h: 12 },
        { id: "l1-catwalk-9", x: 3880, y: 344, w: 190, h: 12 },
        { id: "l1-catwalk-10", x: 4600, y: 314, w: 174, h: 12 },
        { id: "l1-catwalk-11", x: 5360, y: 354, w: 150, h: 12 },
        { id: "l1-catwalk-12", x: 5980, y: 312, w: 182, h: 12 },
      ],
      climbables: [
        { id: "l1-ladder-1", x: 496, y: 320, w: 24, h: 146, side: "left" },
        { id: "l1-ladder-2", x: 850, y: 186, w: 24, h: 200, side: "right" },
        { id: "l1-ladder-3", x: 496, y: 50, w: 24, h: 202, side: "left" },
        { id: "l1-ladder-4", x: 850, y: -86, w: 24, h: 202, side: "right" },
        { id: "l1-ladder-5", x: 496, y: -222, w: 24, h: 202, side: "left" },
        { id: "l1-ladder-6", x: 2204, y: 230, w: 24, h: 226, side: "right" },
        { id: "l1-ladder-7", x: 3200, y: 228, w: 24, h: 228, side: "left" },
        { id: "l1-ladder-8", x: 4774, y: 238, w: 24, h: 218, side: "right" },
        { id: "l1-ladder-9", x: 5960, y: 236, w: 24, h: 220, side: "left" },
      ],
      hangables: [
        { id: "l1-bar-1", x: 558, y: 26, w: 150, h: 10 },
        { id: "l1-bar-2", x: 742, y: -110, w: 150, h: 10 },
        { id: "l1-bar-3", x: 558, y: -246, w: 150, h: 10 },
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
        { t: "trooper", x: 420 }, { t: "trooper", x: 560, surfaceY: 386, patrolMin: 526, patrolMax: 648 }, { t: "drone", x: 760, y: 248 },
        { t: "trooper", x: 742, surfaceY: 252, patrolMin: 716, patrolMax: 846 }, { t: "trooper", x: 566, surfaceY: 116, patrolMin: 534, patrolMax: 650 }, { t: "trooper", x: 742, surfaceY: -20, patrolMin: 716, patrolMax: 846 },
        { t: "turret", x: 980, surfaceY: 332 }, { t: "trooper", x: 1180 }, { t: "trooper", x: 1530, surfaceY: 358, patrolMin: 1490, patrolMax: 1588 },
        { t: "turret", x: 1710 }, { t: "drone", x: 1920, y: 220 }, { t: "trooper", x: 2110, surfaceY: 306, patrolMin: 2070, patrolMax: 2188 },
        { t: "trooper", x: 2360 }, { t: "turret", x: 2570, surfaceY: 342 }, { t: "drone", x: 2860, y: 205 }, { t: "trooper", x: 3240, surfaceY: 302, patrolMin: 3232, patrolMax: 3348 },
        { t: "trooper", x: 3470 }, { t: "mech", x: 3900, surfaceY: 344, patrolMin: 3880, patrolMax: 3998 }, { t: "drone", x: 4220, y: 230 },
        { t: "turret", x: 4650, surfaceY: 314 }, { t: "trooper", x: 4880 }, { t: "drone", x: 5200, y: 240 }, { t: "trooper", x: 5400, surfaceY: 354, patrolMin: 5374, patrolMax: 5478 },
        { t: "mech", x: 5820 }, { t: "turret", x: 6030, surfaceY: 312 }, { t: "drone", x: 6320, y: 205 }, { t: "trooper", x: 6570 },
        { t: "trooper", x: 6980 }, { t: "drone", x: 7180, y: 190 },
      ],
      pickups: [{ type: "med", x: 2360, y: 360 }, { type: "med", x: 5060, y: 352 }],
      checkpoints: [
        { id: "l1-cp-1", label: "Shaft Entry", x: 510, y: 338, support: "platform" },
        { id: "l1-cp-2", label: "Mid Cavern", x: 2050, y: 258, support: "platform" },
        { id: "l1-cp-3", label: "Deep Catwalk", x: 4600, y: 266, support: "platform" },
        { id: "l1-cp-4", label: "Arena Gate", x: 6940, y: 404, support: "terrain" },
      ],
      boss: { name: "Iron Talon", intro: "Arena security commander engaging.", spriteStyle: "giantskull", x: 7320, arenaStart: 6920, hp: 1650, w: 96, h: 78, speed: 70 },
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
        { id: "vault", label: "Launch Vault", kind: "reactor", spriteStyle: "reactorArcAlt", x: 4280, y: 302, w: 158, h: 150, hp: 540, weak: "LASER", reward: "LASER" },
      ],
      detailProps: [
        { kind: "coolingPlant", x: 1148, y: 452 },
        { kind: "missileCart", x: 2626, y: 452 },
        { kind: "wasteBarrel", x: 2868, y: 454 },
        { kind: "consoleBank", x: 4052, y: 452 },
        { kind: "reactorGate", x: 3340, y: 452 },
        { kind: "coolingPlant", x: 4460, y: 452 },
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
        { id: "l2-ladder-1", x: 736, y: 298, w: 24, h: 162, side: "left" },
        { id: "l2-ladder-2", x: 1236, y: 250, w: 24, h: 200, side: "right" },
        { id: "l2-ladder-3", x: 2648, y: 238, w: 24, h: 214, side: "left" },
        { id: "l2-ladder-4", x: 3420, y: 256, w: 24, h: 188, side: "right" },
      ],
      hangables: [
        { id: "l2-bar-1", x: 944, y: 214, w: 152, h: 10 },
        { id: "l2-bar-2", x: 1156, y: 174, w: 146, h: 10 },
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
      checkpoints: [
        { id: "l2-cp-1", label: "Ridge Bridge", x: 730, y: 318, support: "platform" },
        { id: "l2-cp-2", label: "Missile Pass", x: 2570, y: 260, support: "platform" },
        { id: "l2-cp-3", label: "Launch Ramp", x: 4430, y: 404, support: "terrain" },
      ],
      boss: { name: "Mountain Warden", intro: "Command mech descending from the ridge.", spriteStyle: "demonspider", x: 4860, arenaStart: 4440, hp: 1820, w: 102, h: 72, speed: 66 },
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
        { id: "midnight", label: "Midnight Reactor", kind: "reactor", spriteStyle: "reactorCoreAlt", x: 4740, y: 286, w: 170, h: 166, hp: 720, weak: "LASER", reward: "LASER" },
      ],
      detailProps: [
        { kind: "centrifugeBank", x: 1710, y: 452 },
        { kind: "wasteBarrel", x: 2864, y: 454 },
        { kind: "consoleBank", x: 3310, y: 452 },
        { kind: "reactorGate", x: 3930, y: 452 },
        { kind: "missileCart", x: 4474, y: 452 },
        { kind: "coolingPlant", x: 5004, y: 452 },
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
        { id: "l3-chain-1", x: 698, y: 286, w: 24, h: 172, side: "left" },
        { id: "l3-chain-2", x: 1400, y: 250, w: 24, h: 214, side: "right" },
        { id: "l3-chain-3", x: 3000, y: 228, w: 24, h: 226, side: "left" },
        { id: "l3-chain-4", x: 4624, y: 220, w: 24, h: 232, side: "right" },
      ],
      hangables: [
        { id: "l3-bar-1", x: 890, y: 206, w: 150, h: 10 },
        { id: "l3-bar-2", x: 3170, y: 166, w: 158, h: 10 },
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
      checkpoints: [
        { id: "l3-cp-1", label: "Sea Lift", x: 680, y: 310, support: "platform" },
        { id: "l3-cp-2", label: "Assembly Span", x: 2920, y: 256, support: "platform" },
        { id: "l3-cp-3", label: "Core Trench", x: 4540, y: 252, support: "platform" },
      ],
      boss: { name: "Leviathan Core", intro: "Final defense chassis rising from the coolant trench.", spriteStyle: "cyberbrute", x: 5260, arenaStart: 4840, hp: 2100, w: 86, h: 100, speed: 82 },
    },
  ];

  {
    const l1 = LEVELS[0];
    l1.palette.caveVariant = "crystal";
    l1.length = 10300;
    l1.height = 1180;
    l1.top = -360;
    l1.scenery = [
      { id: "l1-scenery-1", kind: "shaft", x: 430, y: -270, w: 490, h: 770, alpha: 0.3, lights: 2, fill: "rgba(11, 18, 26, 0.34)" },
      { id: "l1-scenery-2", kind: "room", x: 1810, y: 236, w: 520, h: 220, alpha: 0.28, lights: 2, fill: "rgba(11, 18, 26, 0.32)" },
      { id: "l1-scenery-3", kind: "room", x: 4420, y: 228, w: 560, h: 236, alpha: 0.28, lights: 3, fill: "rgba(9, 17, 24, 0.34)" },
      { id: "l1-scenery-4", kind: "shaft", x: 7700, y: -300, w: 560, h: 810, alpha: 0.34, lights: 2, fill: "rgba(10, 18, 26, 0.38)" },
      { id: "l1-scenery-5", kind: "alcove", x: 8840, y: 206, w: 790, h: 254, alpha: 0.3, lights: 3, fill: "rgba(11, 18, 26, 0.34)" },
    ];
    l1.terrain.push(
      { x: 8200, y: 430 },
      { x: 8900, y: 456 },
      { x: 9600, y: 438 },
      { x: 10300, y: 450 },
    );
    l1.platforms.push(
      { id: "l1-crystal-13", x: 7820, y: 364, w: 174, h: 12 },
      { id: "l1-crystal-14", x: 8040, y: 230, w: 162, h: 12 },
      { id: "l1-crystal-15", x: 7820, y: 96, w: 168, h: 12 },
      { id: "l1-crystal-16", x: 8040, y: -40, w: 162, h: 12 },
      { id: "l1-crystal-17", x: 8460, y: 138, w: 184, h: 12 },
      { id: "l1-crystal-18", x: 8880, y: 316, w: 188, h: 12 },
      { id: "l1-crystal-19", x: 9360, y: 278, w: 196, h: 12 },
    );
    l1.climbables.push(
      { id: "l1-ladder-10", x: 7796, y: 298, w: 24, h: 168, side: "left" },
      { id: "l1-ladder-11", x: 8178, y: 164, w: 24, h: 200, side: "right" },
      { id: "l1-ladder-12", x: 7796, y: 28, w: 24, h: 202, side: "left" },
      { id: "l1-ladder-13", x: 8178, y: -108, w: 24, h: 204, side: "right" },
      { id: "l1-ladder-14", x: 8436, y: 72, w: 24, h: 206, side: "left" },
      { id: "l1-ladder-15", x: 9548, y: 202, w: 24, h: 196, side: "right" },
    );
    l1.hangables.push(
      { id: "l1-bar-4", x: 7860, y: 4, w: 148, h: 10 },
      { id: "l1-bar-5", x: 8060, y: -132, w: 146, h: 10 },
      { id: "l1-bar-6", x: 8482, y: 76, w: 136, h: 10 },
      { id: "l1-bar-7", x: 8986, y: 252, w: 150, h: 10 },
    );
    l1.obstacles.push(
      { id: "l1-cover-7", kind: "crate", x: 8088, y: 186, w: 48, h: 44 },
      { id: "l1-cover-8", kind: "barrier", x: 8820, y: 392, w: 66, h: 64 },
      { id: "l1-cover-9", kind: "pillar", x: 9640, y: 326, w: 60, h: 116 },
    );
    l1.hazards.push(
      { id: "l1-hazard-4", kind: "acid", x: 8320, y: 440, w: 124, h: 14, dmg: 20 },
      { id: "l1-hazard-5", kind: "laser-floor", x: 9180, y: 430, w: 120, h: 10, dmg: 22 },
    );
    l1.spawns.push(
      { t: "trooper", x: 7860, surfaceY: 364, patrolMin: 7830, patrolMax: 7948 },
      { t: "drone", x: 8140, y: 154 },
      { t: "trooper", x: 8540, surfaceY: 138, patrolMin: 8484, patrolMax: 8614 },
      { t: "turret", x: 8920, surfaceY: 316 },
      { t: "drone", x: 9260, y: 190 },
      { t: "mech", x: 9540, surfaceY: 278, spriteStyle: "crawler", patrolMin: 9410, patrolMax: 9690 },
      { t: "trooper", x: 9730 },
    );
    l1.pickups.push(
      { type: "med", x: 8500, y: 186 },
      { type: "med", x: 9440, y: 340 },
      { type: "shield", amount: SHIELD_HITS_PER_PICKUP, x: 2120, y: 248 },
      { type: "shield", amount: SHIELD_HITS_PER_PICKUP, x: 9420, y: 244 },
    );
    l1.checkpoints.push(
      { id: "l1-cp-5", label: "Crystal Lift", x: 8050, y: 182, support: "platform" },
      { id: "l1-cp-6", label: "Abyss Span", x: 9360, y: 230, support: "platform" },
    );
    l1.boss.x = 9940;
    l1.boss.arenaStart = 9500;

    const l2 = LEVELS[1];
    Object.assign(l2.palette, {
      theme: "cave",
      sky1: "#08111c",
      sky2: "#102030",
      sky3: "#233547",
      back: "#162230",
      mid: "#28384b",
      g1: "#4d4a46",
      g2: "#28221e",
      roof1: "#0b1420",
      roof2: "#142132",
      support: "#566b86",
      cable: "#22384a",
      glow: "#5c90ba",
      light: "#a7defa",
      caveVariant: "basalt",
      structureTiles: "industrial",
    });
    l2.height = 1900;
    l2.top = -1100;
    l2.length = 9000;
    l2.scenery = [
      { id: "l2-scenery-1", kind: "room", x: 560, y: 302, w: 900, h: 176, alpha: 0.28, lights: 3, fill: "rgba(10, 17, 26, 0.3)" },
      { id: "l2-scenery-2", kind: "alcove", x: 2360, y: 238, w: 520, h: 216, alpha: 0.3, lights: 2, fill: "rgba(10, 17, 26, 0.32)" },
      { id: "l2-scenery-3", kind: "shaft", x: 5180, y: -1010, w: 760, h: 1510, alpha: 0.38, lights: 4, innerW: 164, ribSpacing: 58, fill: "rgba(10, 16, 24, 0.44)" },
      { id: "l2-scenery-4", kind: "room", x: 6040, y: -920, w: 1120, h: 1386, alpha: 0.34, lights: 5, ribSpacing: 46, fill: "rgba(12, 19, 28, 0.36)" },
      { id: "l2-scenery-5", kind: "room", x: 7200, y: -880, w: 720, h: 1336, alpha: 0.34, lights: 3, ribSpacing: 52, fill: "rgba(12, 20, 30, 0.36)" },
    ];
    l2.scenery.forEach((chunk) => {
      chunk.glow = "#b2d8ff";
      chunk.line = "rgba(205, 228, 255, 0.2)";
      chunk.fill = chunk.fill || "rgba(12, 18, 26, 0.34)";
    });
    Object.assign(l2.scenery[2], {
      coreGlow: "#a5d4ff",
      coreGlowAlpha: 0.12,
      coreGlowRadius: 126,
      coreGlowY: 0.46,
      fill: "rgba(10, 16, 24, 0.42)",
    });
    l2.terrain.push(
      { x: 5800, y: 432 },
      { x: 6500, y: 452 },
      { x: 7200, y: 438 },
      { x: 7800, y: 446 },
      { x: 8400, y: 436 },
      { x: 9000, y: 448 },
    );
    l2.platforms.push(
      { id: "l2-shaft-7", x: 5360, y: 368, w: 176, h: 12 },
      { id: "l2-shaft-8", x: 5600, y: 240, w: 168, h: 12 },
      { id: "l2-shaft-9", x: 5360, y: 104, w: 168, h: 12 },
      { id: "l2-shaft-10", x: 5600, y: -32, w: 168, h: 12 },
      { id: "l2-shaft-11", x: 5360, y: -168, w: 172, h: 12 },
      { id: "l2-shaft-12", x: 5600, y: -304, w: 168, h: 12 },
      { id: "l2-shaft-13", x: 5360, y: -440, w: 168, h: 12 },
      { id: "l2-shaft-14", x: 5600, y: -576, w: 168, h: 12 },
      { id: "l2-shaft-15", x: 5360, y: -712, w: 168, h: 12 },
      { id: "l2-shaft-16", x: 5600, y: -848, w: 168, h: 12 },
      { id: "l2-roof-17", x: 5860, y: -848, w: 320, h: 12 },
      { id: "l2-roof-18", x: 6180, y: -848, w: 360, h: 12 },
      { id: "l2-roof-19", x: 6540, y: -848, w: 360, h: 12 },
      { id: "l2-roof-20", x: 6900, y: -848, w: 320, h: 12 },
      { id: "l2-descent-21", x: 7240, y: -700, w: 200, h: 12 },
      { id: "l2-descent-22", x: 7480, y: -548, w: 192, h: 12 },
      { id: "l2-descent-23", x: 7720, y: -388, w: 192, h: 12 },
      { id: "l2-descent-24", x: 7980, y: -224, w: 192, h: 12 },
    );
    l2.climbables.push(
      { id: "l2-ladder-5", x: 5336, y: 302, w: 24, h: 158, side: "left" },
      { id: "l2-ladder-6", x: 5744, y: 174, w: 24, h: 194, side: "right" },
      { id: "l2-ladder-7", x: 5336, y: 38, w: 24, h: 202, side: "left" },
      { id: "l2-ladder-8", x: 5744, y: -98, w: 24, h: 202, side: "right" },
      { id: "l2-ladder-9", x: 5336, y: -234, w: 24, h: 202, side: "left" },
      { id: "l2-ladder-10", x: 5744, y: -370, w: 24, h: 202, side: "right" },
      { id: "l2-ladder-11", x: 5336, y: -506, w: 24, h: 202, side: "left" },
      { id: "l2-ladder-12", x: 5744, y: -642, w: 24, h: 202, side: "right" },
      { id: "l2-ladder-13", x: 5336, y: -778, w: 24, h: 202, side: "left" },
      { id: "l2-ladder-14", x: 7216, y: -760, w: 24, h: 194, side: "left" },
      { id: "l2-ladder-15", x: 7460, y: -608, w: 24, h: 196, side: "left" },
      { id: "l2-ladder-16", x: 7700, y: -448, w: 24, h: 196, side: "left" },
    );
    l2.hangables.push(
      { id: "l2-bar-3", x: 5400, y: 12, w: 146, h: 10 },
      { id: "l2-bar-4", x: 5624, y: -124, w: 146, h: 10 },
      { id: "l2-bar-5", x: 5400, y: -260, w: 146, h: 10 },
      { id: "l2-bar-6", x: 5624, y: -396, w: 146, h: 10 },
      { id: "l2-bar-7", x: 5400, y: -532, w: 146, h: 10 },
      { id: "l2-bar-8", x: 5624, y: -668, w: 146, h: 10 },
      { id: "l2-bar-9", x: 6208, y: -904, w: 148, h: 10 },
      { id: "l2-bar-10", x: 6794, y: -884, w: 150, h: 10 },
    );
    l2.obstacles.push(
      { id: "l2-cover-5", kind: "crate", x: 5666, y: 196, w: 48, h: 44 },
      { id: "l2-cover-6", kind: "crate", x: 5666, y: -348, w: 48, h: 44 },
      { id: "l2-cover-7", kind: "barrier", x: 6380, y: -912, w: 64, h: 60 },
      { id: "l2-cover-8", kind: "barrier", x: 7060, y: -890, w: 64, h: 60 },
      { id: "l2-cover-9", kind: "pillar", x: 8220, y: 322, w: 60, h: 112 },
    );
    l2.hazards.push(
      { id: "l2-hazard-4", kind: "spikes", x: 6020, y: 438, w: 108, h: 14, dmg: 20 },
      { id: "l2-hazard-5", kind: "laser-floor", x: 6680, y: -850, w: 126, h: 10, dmg: 22 },
      { id: "l2-hazard-6", kind: "laser-floor", x: 7900, y: 428, w: 126, h: 10, dmg: 22 },
    );
    l2.spawns.push(
      { t: "trooper", x: 5420, surfaceY: 368, patrolMin: 5382, patrolMax: 5498 },
      { t: "drone", x: 5640, y: 182 },
      { t: "trooper", x: 5420, surfaceY: 104, patrolMin: 5388, patrolMax: 5498 },
      { t: "trooper", x: 5660, surfaceY: -168, patrolMin: 5620, patrolMax: 5730 },
      { t: "drone", x: 5820, y: -240 },
      { t: "trooper", x: 5420, surfaceY: -440, patrolMin: 5388, patrolMax: 5498 },
      { t: "drone", x: 5840, y: -514 },
      { t: "trooper", x: 5660, surfaceY: -848, patrolMin: 5620, patrolMax: 5742 },
      { t: "trooper", x: 6270, surfaceY: -848, patrolMin: 6208, patrolMax: 6460 },
      { t: "turret", x: 6830, surfaceY: -826 },
      { t: "drone", x: 7020, y: -918 },
      { t: "trooper", x: 7310, surfaceY: -700, patrolMin: 7260, patrolMax: 7390 },
      { t: "trooper", x: 7530, surfaceY: -548, patrolMin: 7500, patrolMax: 7644 },
      { t: "mech", x: 8260, spriteStyle: "crawler" },
      { t: "trooper", x: 8460 },
    );
    l2.pickups.push(
      { type: "med", x: 5700, y: 196 },
      { type: "med", x: 5700, y: -348 },
      { type: "med", x: 6890, y: -890 },
      { type: "shield", amount: SHIELD_HITS_PER_PICKUP, x: 1240, y: 248 },
      { type: "shield", amount: SHIELD_HITS_PER_PICKUP, x: 6420, y: -900 },
    );
    l2.checkpoints.push(
      { id: "l2-cp-4", label: "Tower Base", x: 5600, y: 192, support: "platform" },
      { id: "l2-cp-5", label: "Mid Tower", x: 5600, y: -352, support: "platform" },
      { id: "l2-cp-6", label: "Roofline", x: 6220, y: -896, support: "platform" },
      { id: "l2-cp-7", label: "Drop Yard", x: 8160, y: -272, support: "platform" },
    );
    l2.boss.x = 8560;
    l2.boss.arenaStart = 8140;

    const l3 = LEVELS[2];
    Object.assign(l3.palette, {
      theme: "cave",
      sky1: "#041319",
      sky2: "#08232c",
      sky3: "#164753",
      back: "#10232b",
      mid: "#183741",
      g1: "#2d5054",
      g2: "#183031",
      roof1: "#06151a",
      roof2: "#0d2329",
      support: "#4c6d72",
      cable: "#1c3940",
      glow: "#3eaeb0",
      light: "#8ff9ef",
      caveVariant: "coolant",
      structureTiles: "industrial",
    });
    l3.height = 1160;
    l3.top = -340;
    l3.length = 8200;
    l3.scenery = [
      { id: "l3-scenery-1", kind: "room", x: 480, y: 292, w: 850, h: 186, alpha: 0.26, lights: 3, fill: "rgba(7, 18, 22, 0.3)" },
      { id: "l3-scenery-2", kind: "alcove", x: 2820, y: 222, w: 560, h: 228, alpha: 0.3, lights: 2, fill: "rgba(8, 20, 24, 0.32)" },
      { id: "l3-scenery-3", kind: "shaft", x: 5520, y: -306, w: 640, h: 814, alpha: 0.34, lights: 2, fill: "rgba(7, 20, 24, 0.4)" },
      { id: "l3-scenery-4", kind: "room", x: 6440, y: 176, w: 1080, h: 286, alpha: 0.3, lights: 4, fill: "rgba(7, 18, 22, 0.34)" },
      { id: "l3-scenery-5", kind: "room", x: 7480, y: 134, w: 480, h: 316, alpha: 0.3, lights: 2, fill: "rgba(6, 18, 20, 0.34)" },
    ];
    l3.scenery.forEach((chunk) => {
      chunk.glow = "#83fff0";
      chunk.line = "rgba(170, 255, 244, 0.18)";
      chunk.fill = chunk.fill || "rgba(7, 18, 22, 0.34)";
    });
    Object.assign(l3.scenery[2], {
      coreGlow: "#49dbc7",
      coreGlowAlpha: 0.14,
      coreGlowRadius: 134,
      coreGlowY: 0.48,
      fill: "rgba(5, 17, 20, 0.44)",
    });
    l3.terrain.push(
      { x: 6200, y: 434 },
      { x: 7000, y: 458 },
      { x: 7600, y: 432 },
      { x: 8200, y: 446 },
    );
    l3.platforms.push(
      { id: "l3-sling-7", x: 5660, y: 360, w: 178, h: 12 },
      { id: "l3-sling-8", x: 5940, y: 238, w: 168, h: 12 },
      { id: "l3-sling-9", x: 5660, y: 108, w: 170, h: 12 },
      { id: "l3-sling-10", x: 5940, y: -24, w: 168, h: 12 },
      { id: "l3-sling-11", x: 6500, y: 294, w: 184, h: 12 },
      { id: "l3-sling-12", x: 7060, y: 330, w: 196, h: 12 },
      { id: "l3-sling-13", x: 7600, y: 270, w: 188, h: 12 },
    );
    l3.climbables.push(
      { id: "l3-chain-5", x: 5636, y: 294, w: 24, h: 164, side: "left" },
      { id: "l3-chain-6", x: 6084, y: 172, w: 24, h: 188, side: "right" },
      { id: "l3-chain-7", x: 5636, y: 42, w: 24, h: 196, side: "left" },
      { id: "l3-chain-8", x: 6084, y: -90, w: 24, h: 198, side: "right" },
      { id: "l3-chain-9", x: 7576, y: 204, w: 24, h: 192, side: "left" },
    );
    l3.hangables.push(
      { id: "l3-bar-3", x: 5702, y: 18, w: 146, h: 10 },
      { id: "l3-bar-4", x: 5962, y: -114, w: 146, h: 10 },
      { id: "l3-bar-5", x: 6524, y: 224, w: 152, h: 10 },
      { id: "l3-bar-6", x: 7090, y: 262, w: 156, h: 10 },
    );
    l3.obstacles.push(
      { id: "l3-cover-5", kind: "crate", x: 6000, y: 194, w: 48, h: 44 },
      { id: "l3-cover-6", kind: "barrier", x: 6610, y: 388, w: 68, h: 60 },
      { id: "l3-cover-7", kind: "pillar", x: 7670, y: 320, w: 60, h: 116 },
    );
    l3.hazards.push(
      { id: "l3-hazard-4", kind: "acid", x: 6240, y: 440, w: 122, h: 12, dmg: 22 },
      { id: "l3-hazard-5", kind: "spikes", x: 7340, y: 436, w: 110, h: 14, dmg: 24 },
    );
    l3.spawns.push(
      { t: "trooper", x: 5720, surfaceY: 360, patrolMin: 5682, patrolMax: 5794 },
      { t: "drone", x: 5980, y: 180 },
      { t: "trooper", x: 6530, surfaceY: 294, patrolMin: 6490, patrolMax: 6618 },
      { t: "turret", x: 7120, surfaceY: 330 },
      { t: "drone", x: 7340, y: 202 },
      { t: "mech", x: 7620, surfaceY: 270, spriteStyle: "crawler", patrolMin: 7560, patrolMax: 7728 },
      { t: "trooper", x: 7800 },
    );
    l3.pickups.push(
      { type: "med", x: 6030, y: 192 },
      { type: "med", x: 7150, y: 286 },
      { type: "shield", amount: SHIELD_HITS_PER_PICKUP, x: 1400, y: 246 },
      { type: "shield", amount: SHIELD_HITS_PER_PICKUP, x: 6520, y: 232 },
    );
    l3.checkpoints.push(
      { id: "l3-cp-4", label: "Coolant Lift", x: 5940, y: 190, support: "platform" },
      { id: "l3-cp-5", label: "Final Span", x: 7600, y: 222, support: "platform" },
    );
    l3.boss.x = 7940;
    l3.boss.arenaStart = 7500;
  }

  const state = {
    mode: "splash",
    levelIndex: 0,
    level: null,
    cameraX: 0,
    cameraY: 0,
    cameraLead: 180,
    checkpointId: null,
    checkpoint: null,
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
    playerDeath: null,
    bossDeath: null,
    player: null,
    enemies: [],
    pending: [],
    respawnQueue: [],
    objectives: [],
    objectiveDeaths: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    explosions: [],
    corpses: [],
    bloodParticles: [],
    smartBombs: [],
    acc: 0,
  };
  const audioState = {
    manifest: null,
    catalog: new Map(),
    musicKeys: new Set(),
    map: { ...DEFAULT_AUDIO_MAP },
    unlocked: false,
    muted: false,
    musicVolume: 0.54,
    sfxVolume: 0.82,
    desiredMusicKey: null,
    currentMusicKey: null,
    currentMusicEl: null,
    currentMusicGain: 1,
    musicDuck: 1,
    musicDuckTarget: 1,
    musicDuckHoldT: 0,
    musicDuckAttack: 22,
    musicDuckRelease: 6.5,
    sfxPools: new Map(),
    lastEventMs: Object.create(null),
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => Math.random() * (b - a) + a;
  const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));
  const TROOPER_VARIANTS = ["", "olive", "crimson", "navy"];
  const ENEMY_SCALE = {
    trooper: TROOPER_VISUAL_SCALE,
    drone: 1.72,
    turret: 1.56,
    mech: 1.72,
    boss: 2.24,
  };
  const normalizeVec = (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  };
  const expandCanonicalAnchor = (anchor, canonicalBounds) => ({
    x: canonicalBounds.sx + canonicalBounds.sw * anchor.x,
    y: canonicalBounds.sy + canonicalBounds.sh * anchor.y,
  });
  const getStructureTileSetKey = (override = null) => override || state.level?.palette?.structureTiles || "industrial";
  const getEnvironmentTileSet = (override = null) => ENV_TILE_SETS[getStructureTileSetKey(override)] || ENV_TILE_SETS.industrial;

  function readStoredJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStoredJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures.
    }
  }

  function getInlineAudioManifest() {
    const manifest = window.NUCLEAR_COMMANDO_AUDIO_MANIFEST;
    return manifest && typeof manifest === "object" ? manifest : null;
  }

  function getAudioCatalogEntry(key) {
    return audioState.catalog.get(key) || null;
  }

  function resolveAudioUrl(key) {
    const entry = getAudioCatalogEntry(key);
    return entry ? `./assets/sfx/${entry.file}` : null;
  }

  function getDefaultAudioMap() {
    return {
      ...DEFAULT_AUDIO_MAP,
      ...((audioState.manifest && audioState.manifest.defaultMap) || {}),
    };
  }

  function saveAudioPrefs() {
    writeStoredJson(AUDIO_PREFS_STORAGE_KEY, {
      muted: audioState.muted,
      musicVolume: audioState.musicVolume,
      sfxVolume: audioState.sfxVolume,
    });
  }

  function stopMusic(clearIntent = false) {
    const current = audioState.currentMusicEl;
    if (current) {
      current.pause();
      current.currentTime = 0;
    }
    audioState.currentMusicEl = null;
    audioState.currentMusicKey = null;
    audioState.currentMusicGain = 1;
    audioState.musicDuck = 1;
    audioState.musicDuckTarget = 1;
    audioState.musicDuckHoldT = 0;
    if (clearIntent) audioState.desiredMusicKey = null;
  }

  function refreshMusicMix() {
    if (!audioState.currentMusicEl) return;
    const mix = clamp(audioState.musicVolume * audioState.currentMusicGain * audioState.musicDuck, 0, 1);
    audioState.currentMusicEl.volume = mix;
  }

  function triggerMusicDuck(amount = 0.62, hold = 0.1, release = 8.5, attack = 22) {
    if (!audioState.currentMusicEl) return;
    const nextTarget = clamp(amount, 0.18, 1);
    audioState.musicDuckTarget = Math.min(audioState.musicDuckTarget, nextTarget);
    audioState.musicDuckHoldT = Math.max(audioState.musicDuckHoldT, hold);
    audioState.musicDuckRelease = Math.max(1, release);
    audioState.musicDuckAttack = Math.max(1, attack);
  }

  function updateAudio(dt) {
    if (!audioState.currentMusicEl) return;
    if (audioState.musicDuckHoldT > 0) {
      audioState.musicDuckHoldT = Math.max(0, audioState.musicDuckHoldT - dt);
      audioState.musicDuck = damp(audioState.musicDuck, audioState.musicDuckTarget, audioState.musicDuckAttack, dt);
      if (audioState.musicDuckHoldT <= 0) audioState.musicDuckTarget = 1;
    } else {
      audioState.musicDuckTarget = 1;
      audioState.musicDuck = damp(audioState.musicDuck, 1, audioState.musicDuckRelease, dt);
    }
    refreshMusicMix();
  }

  function playMusic(key, options = {}) {
    if (!key) {
      stopMusic(true);
      return false;
    }
    const entry = getAudioCatalogEntry(key);
    if (!entry) return false;

    const loop = typeof options.loop === "boolean" ? options.loop : entry.role === "music";
    const restart = !!options.restart;
    const gain = clamp(options.volumeMul ?? 1, 0, 1.25);
    audioState.desiredMusicKey = key;

    if (!audioState.unlocked || audioState.muted) return false;

    if (!restart && audioState.currentMusicKey === key && audioState.currentMusicEl) {
      audioState.currentMusicEl.loop = loop;
      audioState.currentMusicGain = gain;
      refreshMusicMix();
      const playPromise = audioState.currentMusicEl.play();
      if (playPromise && typeof playPromise.catch === "function") playPromise.catch(() => {});
      return true;
    }

    stopMusic(false);
    const src = resolveAudioUrl(key);
    if (!src) return false;
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.loop = loop;
    audio.volume = 0;
    audio.playsInline = true;
    audioState.currentMusicEl = audio;
    audioState.currentMusicKey = key;
    audioState.currentMusicGain = gain;
    audioState.musicDuck = 1;
    audioState.musicDuckTarget = 1;
    audioState.musicDuckHoldT = 0;
    refreshMusicMix();
    audio.addEventListener("ended", () => {
      if (audioState.currentMusicEl !== audio) return;
      audioState.currentMusicEl = null;
      audioState.currentMusicKey = null;
      audioState.currentMusicGain = 1;
      if (!audio.loop && audioState.desiredMusicKey === key) audioState.desiredMusicKey = null;
    });
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") playPromise.catch(() => {});
    return true;
  }

  function setAudioMuted(nextMuted, announce = false) {
    audioState.muted = !!nextMuted;
    saveAudioPrefs();
    if (audioState.muted) {
      if (audioState.currentMusicEl) audioState.currentMusicEl.pause();
    } else if (audioState.unlocked && audioState.desiredMusicKey) {
      playMusic(audioState.desiredMusicKey, { restart: true });
    } else {
      refreshMusicMix();
    }
    if (announce && state.mode !== "splash") {
      say(audioState.muted ? "Audio muted." : "Audio restored.", 1);
    }
  }

  function toggleMute() {
    setAudioMuted(!audioState.muted, true);
  }

  function unlockAudio() {
    if (!audioState.manifest) return false;
    audioState.unlocked = true;
    if (!audioState.muted && audioState.desiredMusicKey && !audioState.currentMusicEl) {
      playMusic(audioState.desiredMusicKey, { restart: true });
    }
    return true;
  }

  function playSfxKey(key, options = {}) {
    if (!audioState.unlocked || audioState.muted) return false;
    const src = resolveAudioUrl(key);
    if (!src) return false;
    const now = performance.now();
    const throttleKey = options.throttleKey || key;
    const throttleMs = options.throttleMs || 0;
    if (throttleMs > 0 && now - (audioState.lastEventMs[throttleKey] || 0) < throttleMs) {
      return false;
    }
    if (throttleMs > 0) audioState.lastEventMs[throttleKey] = now;

    let pool = audioState.sfxPools.get(key);
    if (!pool) {
      pool = [];
      audioState.sfxPools.set(key, pool);
    }
    let audio = pool.find((item) => item.paused || item.ended);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      audio.playsInline = true;
      pool.push(audio);
    }
    audio.currentTime = 0;
    audio.volume = clamp(audioState.sfxVolume * (options.volumeMul ?? 1), 0, 1);
    if (options.duck !== false) {
      triggerMusicDuck(options.duckAmount ?? 0.62, options.duckHold ?? 0.09, options.duckRelease ?? 7.8, options.duckAttack ?? 22);
    }
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") playPromise.catch(() => {});
    return true;
  }

  function playSfxEvent(eventKey, options = {}) {
    const key = audioState.map[eventKey];
    if (!key) return false;
    return playSfxKey(key, { ...options, throttleKey: eventKey });
  }

  function playStageMusic(levelIndex, restart = false) {
    const key = levelIndex === 0 ? audioState.map.stage1 : levelIndex === 1 ? audioState.map.stage2 : audioState.map.stage3;
    return playMusic(key, { restart, loop: true });
  }

  function initAudio() {
    const manifest = getInlineAudioManifest();
    if (!manifest) return;
    audioState.manifest = manifest;
    audioState.catalog = new Map();
    audioState.musicKeys = new Set();
    for (const entry of [...(manifest.music || []), ...(manifest.sfx || [])]) {
      if (!entry || !entry.key || !entry.file) continue;
      audioState.catalog.set(entry.key, entry);
      if (entry.role === "music" || entry.role === "stinger") audioState.musicKeys.add(entry.key);
    }
    const prefs = readStoredJson(AUDIO_PREFS_STORAGE_KEY, {});
    if (typeof prefs.muted === "boolean") audioState.muted = prefs.muted;
    if (typeof prefs.musicVolume === "number") audioState.musicVolume = clamp(prefs.musicVolume, 0, 1);
    if (typeof prefs.sfxVolume === "number") audioState.sfxVolume = clamp(prefs.sfxVolume, 0, 1);
    audioState.map = {
      ...getDefaultAudioMap(),
      ...readStoredJson(AUDIO_MAP_STORAGE_KEY, {}),
    };
  }

  function pickTrooperVariant(seed) {
    return TROOPER_VARIANTS[Math.abs(Math.floor(seed)) % TROOPER_VARIANTS.length];
  }

  function isAimLockActive(p) {
    return !!keys.KeyX || !!p.debugAimLock;
  }

  function getPlayerAimMode(p) {
    if (p.aimY < -0.86 && Math.abs(p.aimX) < 0.26) return "up";
    if (p.aimY < -0.24) return "diag";
    if (p.aimY > 0.86 && Math.abs(p.aimX) < 0.26) return "down";
    if (p.aimY > 0.24) return "downDiag";
    return "forward";
  }

  function getPlayerAimVector(p) {
    const rawX = typeof p.aimX === "number" ? p.aimX : p.face;
    const rawY = typeof p.aimY === "number" ? p.aimY : 0;
    if (Math.abs(rawX) < 0.001 && Math.abs(rawY) < 0.001) {
      return { x: p.face, y: 0 };
    }
    return normalizeVec(rawX, rawY);
  }

  function getHangAttachY(hang) {
    return hang.y + hang.h + PLAYER_HANG_ATTACH_OFFSET;
  }

  function getClimbFacingSign(climb) {
    return climb?.side === "right" ? -1 : 1;
  }

  function getTraversePoseKey(kind, combat, aimMode, face = 1) {
    const base = kind === "hang" ? "player_hang" : "player_climb";
    if (!combat) return base;
    if (kind === "climb") {
      if (aimMode === "up") return hasSpriteKey(`${base}_up_0`) ? `${base}_up` : base;
      if (aimMode === "diag") return hasSpriteKey(`${base}_diag_0`) ? `${base}_diag` : base;
      if (aimMode === "downDiag") return hasSpriteKey(`${base}_down_diag_0`) ? `${base}_down_diag` : base;
      return hasSpriteKey(`${base}_forward_0`) ? `${base}_forward` : base;
    }
    if (aimMode === "up") return hasSpriteKey(`${base}_up_0`) ? `${base}_up` : base;
    if (aimMode === "diag") return hasSpriteKey(`${base}_diag_0`) ? `${base}_diag` : base;
    if (aimMode === "downDiag") return hasSpriteKey(`${base}_down_diag_0`) ? `${base}_down_diag` : base;
    if (aimMode === "down") return hasSpriteKey(`${base}_down_0`) ? `${base}_down` : base;
    return hasSpriteKey(`${base}_forward_0`) ? `${base}_forward` : base;
  }

  function getPlayerPoseKey(p) {
    const aimMode = getPlayerAimMode(p);
    const hasGroundDownDiag = hasSpriteKey("player_idle_down_diag_0");
    return p.hanging
      ? getTraversePoseKey("hang", p.hangCombat, p.hangAimMode || aimMode, p.face)
      : p.climbing
      ? getTraversePoseKey("climb", p.climbCombat, p.climbAimMode || aimMode, p.face)
      : (p.prone && p.onGround
        ? "player_prone"
      : (p.crouching && p.onGround
        ? "player_crouch"
        : (!p.onGround
          ? "player_jump"
          : (Math.abs(p.vx) > 20
            ? (aimMode === "up" ? "player_run_up" : aimMode === "diag" ? "player_run_diag" : aimMode === "downDiag" ? (hasGroundDownDiag ? "player_run_down_diag" : "player_run_diag") : "player_run")
            : (aimMode === "up" ? "player_idle_up" : aimMode === "diag" ? "player_idle_diag" : (aimMode === "down" || aimMode === "downDiag") ? (hasGroundDownDiag ? "player_idle_down_diag" : "player_idle_diag") : "player_idle")))));
  }

  function getPlayerFlipScale(p, aimMode, poseKey = "") {
    // The base ladder-climb loop and the climb-shoot rows have opposite native directions
    // in the imported sheet, so combat climb poses need the inverse flip to keep the shot
    // vector aligned with the barrel.
    if (poseKey.startsWith("player_climb_")) return -p.face;
    if (poseKey === "player_climb") return p.face;
    const crispFacing = p.climbing || p.hanging || p.crouching || p.prone || p.muzzleFlashT > 0.01 || aimMode !== "forward";
    return crispFacing ? p.face : (typeof p.visualFace === "number" ? p.visualFace : p.face);
  }

  function getPlayerSpriteState(p, render) {
    const key = render.key;
    const firing = p.muzzleFlashT > 0.01;
    const animatedClimbCombat = p.climbing && p.climbMoving && key.startsWith("player_climb_");
    const staticVariants = {
      player_idle: firing ? "player_idle_1" : "player_idle_0",
      player_idle_up: "player_idle_up_0",
      player_idle_diag: "player_idle_diag_0",
      player_idle_down_diag: "player_idle_down_diag_0",
      player_crouch: firing ? "player_crouch_1" : "player_crouch_0",
      player_prone: firing ? "player_prone_1" : "player_prone_0",
      player_climb_up: firing ? "player_climb_up_1" : "player_climb_up_0",
      player_climb_diag: firing ? "player_climb_diag_1" : "player_climb_diag_0",
      player_climb_forward: firing ? "player_climb_forward_1" : "player_climb_forward_0",
      player_climb_down_diag: firing ? "player_climb_down_diag_1" : "player_climb_down_diag_0",
      player_hang_up: firing ? "player_hang_up_1" : "player_hang_up_0",
      player_hang_diag: firing ? "player_hang_diag_1" : "player_hang_diag_0",
      player_hang_forward: firing ? "player_hang_forward_1" : "player_hang_forward_0",
      player_hang_down_diag: firing ? "player_hang_down_diag_1" : "player_hang_down_diag_0",
      player_hang_down: firing ? "player_hang_down_1" : "player_hang_down_0",
    };
    const staticKey = staticVariants[key];
    if (staticKey && !animatedClimbCombat && hasSpriteKey(staticKey)) {
      return { key: staticKey, frames: 1, fps: 0, phase: 0 };
    }
    if (key === "player_climb" && !p.climbMoving && hasSpriteKey("player_climb_0")) {
      return { key: "player_climb_0", frames: 1, fps: 0, phase: 0 };
    }
    if (key === "player_hang" && !p.hangMoving && hasSpriteKey("player_hang_0")) {
      return { key: "player_hang_0", frames: 1, fps: 0, phase: 0 };
    }
    const phase = key.startsWith("player_climb")
      ? p.y * 0.02
      : key.startsWith("player_hang")
        ? p.x * 0.02
        : p.x * 0.013;
    return {
      key,
      frames: ANIM.player[key]?.frames || 1,
      fps: ANIM.player[key]?.fps || 0,
      phase,
    };
  }

  function getPlayerPoseVisualScale(key) {
    return key === "player_idle_up"
      || key === "player_run_up"
      || key === "player_air_up"
      || key === "player_climb_up"
      || key === "player_hang_up"
      ? PLAYER_VISUAL_SCALE * PLAYER_UP_POSE_SCALE_MULT
      : PLAYER_VISUAL_SCALE;
  }

  function getPlayerRenderState(p) {
    const key = getPlayerPoseKey(p);
    const scale = getPlayerPoseVisualScale(key);
    const sw = SPRITE_FRAME_SIZE * scale;
    const sh = SPRITE_FRAME_SIZE * scale;
    const aimMode = getPlayerAimMode(p);
    return {
      scale,
      sw,
      sh,
      sx: p.x + p.w * 0.5 - sw * PLAYER_FRAME_ANCHOR.x,
      sy: p.y + p.h - sh * PLAYER_FRAME_ANCHOR.y,
      key,
      aimMode,
      flipScale: getPlayerFlipScale(p, aimMode, key),
    };
  }

  function getPlayerMuzzlePoint(p) {
    const aim = getPlayerAimVector(p);
    const render = getPlayerRenderState(p);
    const pose = render.key;
    const isClimbPose = pose.startsWith("player_climb");
    const isHangPose = pose.startsWith("player_hang");
    const sprite = getPlayerSpriteState(p, render);
    const spriteKey = sprite.frames > 1 ? pickAnimKey(sprite.key, sprite.frames, sprite.fps, sprite.phase) : sprite.key;
    const draw = getSpriteDrawMetrics(spriteKey, render.sx, render.sy, render.sw, render.sh);
    const anchor = pose === "player_crouch"
      ? (render.aimMode === "up"
        ? { x: 0.56, y: 0.19 }
        : render.aimMode === "diag"
          ? { x: 0.73, y: 0.27 }
          : render.aimMode === "downDiag"
            ? { x: 0.73, y: 0.59 }
            : render.aimMode === "down"
              ? { x: 0.68, y: 0.69 }
              : { x: 0.79, y: 0.51 })
      : pose === "player_prone"
        ? { x: 0.84, y: 0.56 }
      : pose === "player_jump"
        ? { x: 0.6, y: 0.47 }
      : pose === "player_climb_up"
        ? { x: 0.56, y: 0.1 }
      : pose === "player_climb_diag"
        ? { x: 0.23, y: 0.2 }
      : pose === "player_climb_forward"
        ? { x: 0.18, y: 0.36 }
      : pose === "player_climb_down_diag"
        ? { x: 0.22, y: 0.58 }
      : pose === "player_idle_up" || pose === "player_run_up"
        ? { x: 0.6, y: 0.1 }
      : pose === "player_idle_diag" || pose === "player_run_diag"
        ? { x: 0.77, y: 0.18 }
        : pose === "player_idle_down_diag" || pose === "player_run_down_diag"
          ? { x: 0.74, y: 0.58 }
          : pose === "player_hang_up"
            ? { x: 0.56, y: 0.1 }
            : pose === "player_hang_diag"
              ? { x: 0.7, y: 0.2 }
              : pose === "player_hang_forward"
                ? { x: 0.78, y: 0.36 }
                : pose === "player_hang_down_diag"
                  ? { x: 0.7, y: 0.58 }
                  : pose === "player_hang_down"
                    ? { x: 0.58, y: 0.72 }
                    : pose === "player_climb" || pose === "player_hang"
                      ? { x: 0.56, y: 0.28 }
              : { x: 0.83, y: 0.39 };
    const frameAnchor = expandCanonicalAnchor(anchor, PLAYER_CANONICAL_BOUNDS);
    const facingLeft = (typeof render.flipScale === "number" ? render.flipScale : p.face) < 0;
    const mirroredX = facingLeft ? 1 - frameAnchor.x : frameAnchor.x;
    const reach = pose === "player_jump"
      ? 14
      : (isClimbPose || isHangPose)
        ? 7
        : render.aimMode === "forward"
          ? 5.5
          : render.aimMode === "diag" || render.aimMode === "downDiag"
            ? 4.5
            : 3.5;
    const tipX = draw.x + draw.w * mirroredX + aim.x * reach;
    const tipY = draw.y + draw.h * frameAnchor.y + aim.y * reach;
    return {
      x: tipX,
      y: tipY,
      dirX: aim.x,
      dirY: aim.y,
    };
  }

  function getEnemyFacingFlip(e) {
    return state.player.x >= e.x;
  }

  function getEnemyRenderState(e) {
    if (e.kind === "trooper") {
      const sw = SPRITE_FRAME_SIZE * TROOPER_VISUAL_SCALE;
      const sh = SPRITE_FRAME_SIZE * TROOPER_VISUAL_SCALE;
      return {
        scale: TROOPER_VISUAL_SCALE,
        sw,
        sh,
        sx: e.x + e.w * 0.5 - sw * TROOPER_FRAME_ANCHOR.x,
        sy: e.y + e.h - sh * TROOPER_FRAME_ANCHOR.y,
        flip: getEnemyFacingFlip(e),
      };
    }
    const scale = ENEMY_SCALE[e.kind] || 1.5;
    const sw = e.w * scale;
    const sh = e.h * scale;
    return {
      scale,
      sw,
      sh,
      sx: e.x - (sw - e.w) * 0.5,
      sy: e.y - (sh - e.h),
      flip: getEnemyFacingFlip(e),
    };
  }

  function getEnemyAttackWindow(e) {
    if (e.kind === "trooper") return 0.34;
    if (e.kind === "drone") return 0.22;
    if (e.kind === "turret" || e.kind === "mech" || e.kind === "boss") return 0.24;
    return 0;
  }

  function getEnemyAimVector(e) {
    if (typeof e.shotAimX === "number" && typeof e.shotAimY === "number" && (e.attackT || 0) > 0) {
      return normalizeVec(e.shotAimX, e.shotAimY);
    }
    const tx = state.player.x + state.player.w * 0.5;
    const ty = state.player.y + state.player.h * 0.45;
    return normalizeVec(tx - (e.x + e.w * 0.5), ty - (e.y + e.h * 0.38));
  }

  function getEnemyRecoilOffset(e) {
    const windowT = getEnemyAttackWindow(e);
    if (!windowT || (e.attackT || 0) <= 0) return { x: 0, y: 0, t: 0 };
    const aim = getEnemyAimVector(e);
    const decay = clamp((e.attackT || 0) / windowT, 0, 1);
    const strength = e.kind === "boss" ? 5.2 : e.kind === "mech" ? 4.3 : e.kind === "turret" ? 3 : 2.4;
    const kick = strength * decay * decay;
    return { x: -aim.x * kick, y: -aim.y * kick, t: decay };
  }

  function getBossStyleName(e) {
    return e.spriteStyle || LEVEL_BOSS_STYLE[state.levelIndex] || "cyberbrute";
  }

  function getEnemySpriteState(e) {
    if (e.kind === "trooper") {
      const baseKey = resolveTrooperSpriteBase(e);
      return {
        baseKey,
        frames: baseKey.includes("_up") ? ANIM.enemy.trooper_up.frames : baseKey.includes("_fire") ? ANIM.enemy.trooper_fire.frames : ANIM.enemy.trooper.frames,
        fps: baseKey.includes("_up") ? ANIM.enemy.trooper_up.fps : baseKey.includes("_fire") ? ANIM.enemy.trooper_fire.fps : ANIM.enemy.trooper.fps,
        anchor: baseKey.includes("_up") ? { x: 0.4, y: 0.08 } : { x: 0.1, y: 0.35 },
      };
    }
    if (e.kind === "mech") {
      const style = MECH_SPRITE_STYLES[e.spriteStyle || "crawler"] || MECH_SPRITE_STYLES.crawler;
      if ((e.attackT || 0) > 0.04) return { ...style.attack };
      if (Math.abs(e.vx || 0) > 8) return { ...style.walk };
      return { ...style.idle };
    }
    if (e.kind === "boss") {
      const style = BOSS_SPRITE_STYLES[getBossStyleName(e)] || BOSS_SPRITE_STYLES.cyberbrute;
      if ((e.attackT || 0) > 0.04) return { ...style.attack };
      if (Math.abs(e.vx || 0) > 8) return { ...style.walk };
      return { ...style.idle };
    }
    if (e.kind === "turret") {
      return { baseKey: "enemy_turret", frames: ANIM.enemy.turret.frames, fps: ANIM.enemy.turret.fps, anchor: { x: 0.18, y: 0.24 } };
    }
    if (e.kind === "drone") {
      const attacking = (e.attackT || 0) > 0.04 && hasSpriteKey("enemy_drone_attack_0");
      return {
        baseKey: attacking ? "enemy_drone_attack" : "enemy_drone",
        frames: attacking ? ANIM.enemy.drone_attack.frames : ANIM.enemy.drone.frames,
        fps: attacking ? ANIM.enemy.drone_attack.fps : ANIM.enemy.drone.fps,
        anchor: attacking ? { x: 0.18, y: 0.5 } : { x: 0.18, y: 0.48 },
      };
    }
    return { baseKey: `enemy_${e.kind}`, frames: ANIM.enemy[e.kind]?.frames || 1, fps: ANIM.enemy[e.kind]?.fps || 0, anchor: { x: 0.22, y: 0.46 } };
  }

  function getEnemyMuzzlePoint(e, offsetX = 0, offsetY = 0) {
    const render = getEnemyRenderState(e);
    const facingRight = render.flip;
    const spriteState = getEnemySpriteState(e);
    const anchor = spriteState.anchor || (e.kind === "mech" || e.kind === "boss" ? { x: 0.18, y: 0.3 } : { x: 0.22, y: 0.46 });
    const baseKey = spriteState.baseKey;
    const phase = (e.x * 0.013 + e.y * 0.007 + (e.wave || 0)) % 11;
    const spriteKey = spriteState.frames > 1 ? pickAnimKey(baseKey, spriteState.frames, spriteState.fps, phase) : baseKey;
    const draw = getSpriteDrawMetrics(spriteKey, render.sx + offsetX, render.sy + offsetY, render.sw, render.sh);
    const aim = getEnemyAimVector(e);
    const lead = e.kind === "trooper" ? 5 : (e.kind === "mech" || e.kind === "boss") ? 7 : 4;
    const frameAnchor = e.kind === "trooper" ? expandCanonicalAnchor(anchor, TROOPER_CANONICAL_BOUNDS) : anchor;
    const mirroredX = (e.kind === "boss" && getBossStyleName(e) === "demonspider") ? frameAnchor.x : (facingRight ? 1 - frameAnchor.x : frameAnchor.x);
    const x = draw.x + draw.w * mirroredX + aim.x * lead;
    const y = draw.y + draw.h * frameAnchor.y + aim.y * lead;
    return { x, y };
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

  function levelHangables() {
    return state.level?.hangables || [];
  }

  function levelCheckpoints() {
    return state.level?.checkpoints || [];
  }

  function levelScenery() {
    return state.level?.scenery || [];
  }

  function levelDetailProps() {
    return state.level?.detailProps || [];
  }

  function levelHeight() {
    return state.level?.height || H;
  }

  function levelTop() {
    return state.level?.top || 0;
  }

  function getActiveCheckpointIndex() {
    return levelCheckpoints().findIndex((cp) => cp.id === state.checkpointId);
  }

  function activateCheckpoint(checkpoint) {
    if (!checkpoint || checkpoint.id === state.checkpointId) return;
    state.checkpointId = checkpoint.id;
    state.checkpoint = {
      id: checkpoint.id,
      label: checkpoint.label,
      x: checkpoint.x,
      y: checkpoint.y,
      support: checkpoint.support || "terrain",
    };
    playSfxEvent("checkpoint", { volumeMul: 0.8, throttleMs: 180, duckAmount: 0.76, duckHold: 0.12, duckRelease: 6.6 });
    say(`<strong>Checkpoint:</strong> ${checkpoint.label}`, 1.45);
  }

  function levelObstacles() {
    return (state.level?.obstacles || []).filter((obstacle) => !obstacle.destroyed);
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

  function findHangableForRect(rect) {
    const handLeft = rect.x + 4;
    const handRight = rect.x + rect.w - 4;
    const handTop = rect.y - 12;
    const handBottom = rect.y + 14;
    for (const hang of levelHangables()) {
      if (!overlap1D(handLeft, handRight, hang.x, hang.x + hang.w, 8)) continue;
      if (!overlap1D(handTop, handBottom, hang.y, hang.y + hang.h, 2)) continue;
      return hang;
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

  function supportYForBody(body, includePlatforms = true) {
    const centerX = body.x + body.w * 0.5;
    let bestY = terrainY(centerX) - body.h;
    for (const obstacle of levelObstacles()) {
      if (centerX < obstacle.x || centerX > obstacle.x + obstacle.w) continue;
      bestY = Math.min(bestY, obstacle.y - body.h);
    }
    if (includePlatforms) {
      for (const platform of levelPlatforms()) {
        if (centerX < platform.x || centerX > platform.x + platform.w) continue;
        bestY = Math.min(bestY, platform.y - body.h);
      }
    }
    return bestY;
  }

  function setColorAlpha(color, alpha = 1) {
    if (typeof color !== "string") return color;
    const match = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i);
    if (!match) return color;
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${clamp(alpha, 0, 1).toFixed(3)})`;
  }

  function insetRect(rect, insetLeft, insetTop, insetRight, insetBottom) {
    return {
      x: rect.x + insetLeft,
      y: rect.y + insetTop,
      w: Math.max(6, rect.w - insetLeft - insetRight),
      h: Math.max(6, rect.h - insetTop - insetBottom),
    };
  }

  function getPlayerCombatRect(p) {
    const base = { x: p.x, y: p.y, w: p.w, h: p.h };
    if (p.prone && p.onGround) return insetRect(base, 3, 24, 3, 8);
    if (p.crouching && p.onGround) return insetRect(base, 5, 18, 5, 2);
    if (p.climbing) return insetRect(base, 8, 5, 8, 3);
    return insetRect(base, 4, 4, 4, 2);
  }

  function getEnemyCombatRect(e) {
    const render = getEnemyRenderState(e);
    if (e.kind === "trooper") {
      return {
        x: render.sx + render.sw * (TROOPER_CANONICAL_BOUNDS.sx + TROOPER_CANONICAL_BOUNDS.sw * 0.22),
        y: render.sy + render.sh * (TROOPER_CANONICAL_BOUNDS.sy + TROOPER_CANONICAL_BOUNDS.sh * 0.09),
        w: render.sw * TROOPER_CANONICAL_BOUNDS.sw * 0.5,
        h: render.sh * TROOPER_CANONICAL_BOUNDS.sh * 0.82,
      };
    }
    if (e.kind === "drone") {
      return {
        x: render.sx + render.sw * 0.14,
        y: render.sy + render.sh * 0.24,
        w: render.sw * 0.72,
        h: render.sh * 0.42,
      };
    }
    if (e.kind === "turret") {
      return {
        x: render.sx + render.sw * 0.12,
        y: render.sy + render.sh * 0.18,
        w: render.sw * 0.74,
        h: render.sh * 0.7,
      };
    }
    if (e.kind === "mech" || e.kind === "boss") {
      return {
        x: render.sx + render.sw * 0.16,
        y: render.sy + render.sh * 0.12,
        w: render.sw * 0.68,
        h: render.sh * 0.8,
      };
    }
    return { x: e.x, y: e.y, w: e.w, h: e.h };
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
      prone: false,
      muzzleFlashT: 0,
      climbing: false,
      climbId: null,
    climbAimMode: "forward",
      climbCombat: false,
      climbMoving: false,
      hanging: false,
      hangId: null,
      hangAimMode: "forward",
      hangCombat: false,
      hangMoving: false,
      dropTimer: 0,
      downLatch: false,
      aimX: prev ? prev.aimX : 1,
      aimY: prev ? prev.aimY : 0,
      visualFace: prev ? (prev.visualFace ?? prev.face) : 1,
      debugAimLock: false,
      airT: 0,
      weapon: prev ? prev.weapon : "RIFLE",
      bag: newLoadout(prev ? prev.bag : null),
      smartBombs: prev ? prev.smartBombs : SMART_BOMB_STOCK,
      shieldHits: prev ? (prev.shieldHits || 0) : 0,
      shieldFlashT: 0,
    };
  }

  function resetLevel(i, keepPlayer) {
    const lvl = LEVELS[i];
    state.levelIndex = i;
    state.level = {
      ...lvl,
      obstacles: (lvl.obstacles || []).map((obstacle) => ({
        ...obstacle,
        maxHp: obstacle.kind === "crate" ? CRATE_HP : 0,
        hp: obstacle.kind === "crate" ? CRATE_HP : 0,
        destroyed: false,
      })),
    };
    state.cameraX = 0;
    state.cameraY = 0;
    state.cameraLead = 180;
    state.checkpointId = null;
    state.checkpoint = null;
    state.levelClock = 0;
    state.extractionReady = false;
    state.bossActive = false;
    state.bossDefeated = false;
    state.playerDeath = null;
    state.bossDeath = null;
    state.combo = 0;
    state.comboTimer = 0;
    state.enemies = [];
    state.pending = lvl.spawns.map((s, idx) => ({ ...s, id: `${s.t}-${idx}`, variantSeed: idx }));
    state.respawnQueue = [];
    state.objectives = lvl.objectives.map((o) => {
      const objectiveStyle = OBJECTIVE_SPRITE_STYLES[o.spriteStyle || o.kind] || OBJECTIVE_SPRITE_STYLES[o.kind] || null;
      const floorOffset = objectiveStyle?.floorOffset ?? 0;
      const topY = terrainY(o.x + o.w * 0.5) - o.h + floorOffset;
      return { ...o, y: topY, maxHp: o.hp, destroyed: false, damageFlashT: 0 };
    });
    state.objectiveDeaths = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.explosions = [];
    state.corpses = [];
    state.bloodParticles = [];
    state.smartBombs = [];
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
    state.player.smartBombs = SMART_BOMB_STOCK;
    state.player.shieldHits = 0;
    state.player.shieldFlashT = 0;

    state.checkpoint = {
      id: `${lvl.name}-start`,
      x: state.player.x,
      y: state.player.y,
      support: "terrain",
    };

    say(`<strong>${lvl.name}</strong><br>${lvl.subtitle}<br>Use catwalks, grates, hanging rails, and survive the arena boss.`, 3.6);
  }

  function startCampaign() {
    resetLevel(0, false);
    state.mode = "playing";
    splash.classList.remove("visible");
    unlockAudio();
    playSfxEvent("menuStart", { volumeMul: 0.84, throttleMs: 120, duckAmount: 0.7, duckHold: 0.12, duckRelease: 6.4 });
    playStageMusic(0, true);
    if (DEBUG_SCENARIO) {
      runDebugScenarioWhenReady();
    }
  }

  function runDebugScenario() {
    debugHidePauseOverlay = false;
    if (DEBUG_SCENARIO === "skip-boss") window.__nuclear_commando_debug.skipToBoss();
    if (DEBUG_SCENARIO === "clear-boss") {
      window.__nuclear_commando_debug.skipToBoss();
      window.__nuclear_commando_debug.defeatBoss();
      window.__nuclear_commando_debug.advanceBossDeath(BOSS_DEATH_TOTAL_DURATION + 0.25);
    }
    if (DEBUG_SCENARIO === "next-level") {
      window.__nuclear_commando_debug.skipToBoss();
      window.__nuclear_commando_debug.defeatBoss();
      window.__nuclear_commando_debug.advanceBossDeath(BOSS_DEATH_TOTAL_DURATION + 3.8);
    }
    if (DEBUG_SCENARIO === "boss-death-check") window.__nuclear_commando_debug.setupBossDeathCheck(0.58);
    if (DEBUG_SCENARIO === "boss-death-finish-check") window.__nuclear_commando_debug.setupBossDeathCheck(BOSS_DEATH_DURATION + 0.8);
    if (DEBUG_SCENARIO === "player-death-fall-check") window.__nuclear_commando_debug.setupPlayerDeathCheck(0.18);
    if (DEBUG_SCENARIO === "player-death-check") window.__nuclear_commando_debug.setupPlayerDeathCheck(0.56);
    if (DEBUG_SCENARIO === "boss-damage-flash-check") window.__nuclear_commando_debug.setupBossDamageFlashCheck();
    if (DEBUG_SCENARIO === "enemy-damage-flash-check") window.__nuclear_commando_debug.setupEnemyDamageFlashCheck();
    if (DEBUG_SCENARIO === "objective-damage-flash-check") window.__nuclear_commando_debug.setupObjectiveDamageFlashCheck(0, 2);
    if (DEBUG_SCENARIO === "aim-lock-check") window.__nuclear_commando_debug.setupAimLockCheck();
    if (DEBUG_SCENARIO === "crouch-check") window.__nuclear_commando_debug.setupCrouchCheck();
    if (DEBUG_SCENARIO === "crouch-aimlock-forward-check") window.__nuclear_commando_debug.setupCrouchAimLockCheck("forward", 1, false);
    if (DEBUG_SCENARIO === "crouch-aimlock-up-check") window.__nuclear_commando_debug.setupCrouchAimLockCheck("up", 1, false);
    if (DEBUG_SCENARIO === "crouch-aimlock-up-fire-check") window.__nuclear_commando_debug.setupCrouchAimLockCheck("up", 1, true);
    if (DEBUG_SCENARIO === "crouch-aimlock-diag-fire-check") window.__nuclear_commando_debug.setupCrouchAimLockCheck("diag", 1, true);
    if (DEBUG_SCENARIO === "up-right-check") window.__nuclear_commando_debug.setupUpPoseCheck(1, false);
    if (DEBUG_SCENARIO === "up-left-check") window.__nuclear_commando_debug.setupUpPoseCheck(-1, false);
    if (DEBUG_SCENARIO === "up-right-recoil-check") window.__nuclear_commando_debug.setupUpPoseCheck(1, true);
    if (DEBUG_SCENARIO === "up-left-recoil-check") window.__nuclear_commando_debug.setupUpPoseCheck(-1, true);
    if (DEBUG_SCENARIO === "diag-right-check") window.__nuclear_commando_debug.setupDiagPoseCheck(1, true);
    if (DEBUG_SCENARIO === "scale-forward-check") window.__nuclear_commando_debug.setupScaleCheck("forward");
    if (DEBUG_SCENARIO === "scale-up-check") window.__nuclear_commando_debug.setupScaleCheck("up");
    if (DEBUG_SCENARIO === "ground-aimlock-diag-check") window.__nuclear_commando_debug.setupGroundAimLockDiagCheck(1, false);
    if (DEBUG_SCENARIO === "ground-aimlock-diag-fire-check") window.__nuclear_commando_debug.setupGroundAimLockDiagCheck(1, true);
    if (DEBUG_SCENARIO === "turn-blend-check") window.__nuclear_commando_debug.setupTurnBlendCheck();
    if (DEBUG_SCENARIO === "down-right-check") window.__nuclear_commando_debug.setupDownPoseCheck(1, false, false);
    if (DEBUG_SCENARIO === "down-left-check") window.__nuclear_commando_debug.setupDownPoseCheck(-1, false, false);
    if (DEBUG_SCENARIO === "air-down-right-check") window.__nuclear_commando_debug.setupDownPoseCheck(1, true, false);
    if (DEBUG_SCENARIO === "jump-aim-check") window.__nuclear_commando_debug.setupJumpAimCheck(1, "diag", true);
    if (DEBUG_SCENARIO === "climb-left-diag-check") window.__nuclear_commando_debug.setupClimbAimCheck("diag", -1, true);
    if (DEBUG_SCENARIO === "climb-left-forward-check") window.__nuclear_commando_debug.setupClimbAimCheck("forward", -1, true);
    if (DEBUG_SCENARIO === "climb-left-up-check") window.__nuclear_commando_debug.setupClimbAimCheck("up", -1, true);
    if (DEBUG_SCENARIO === "climb-left-down-check") window.__nuclear_commando_debug.setupClimbAimCheck("down", -1, true);
    if (DEBUG_SCENARIO === "climb-left-downdiag-check") window.__nuclear_commando_debug.setupClimbAimCheck("downDiag", -1, true);
    if (DEBUG_SCENARIO === "climb-right-diag-check") window.__nuclear_commando_debug.setupClimbAimCheck("diag", 1, true);
    if (DEBUG_SCENARIO === "climb-right-forward-check") window.__nuclear_commando_debug.setupClimbAimCheck("forward", 1, true);
    if (DEBUG_SCENARIO === "climb-right-up-check") window.__nuclear_commando_debug.setupClimbAimCheck("up", 1, true);
    if (DEBUG_SCENARIO === "climb-right-down-check") window.__nuclear_commando_debug.setupClimbAimCheck("down", 1, true);
    if (DEBUG_SCENARIO === "climb-right-downdiag-check") window.__nuclear_commando_debug.setupClimbAimCheck("downDiag", 1, true);
    if (DEBUG_SCENARIO === "climb-idle-check") window.__nuclear_commando_debug.setupClimbMotionCheck(false);
    if (DEBUG_SCENARIO === "climb-moving-check") window.__nuclear_commando_debug.setupClimbMotionCheck(true);
    if (DEBUG_SCENARIO === "hang-aimlock-diag-check") window.__nuclear_commando_debug.setupHangAimCheck("diag", true);
    if (DEBUG_SCENARIO === "hang-forward-check") window.__nuclear_commando_debug.setupHangAimCheck("forward", false);
    if (DEBUG_SCENARIO === "hang-idle-check") window.__nuclear_commando_debug.setupHangMotionCheck(false);
    if (DEBUG_SCENARIO === "hang-moving-check") window.__nuclear_commando_debug.setupHangMotionCheck(true);
    if (DEBUG_SCENARIO === "hang-drop-check") window.__nuclear_commando_debug.setupHangDropCheck();
    if (DEBUG_SCENARIO === "prone-check") window.__nuclear_commando_debug.setupProneCheck(false);
    if (DEBUG_SCENARIO === "prone-fire-check") window.__nuclear_commando_debug.setupProneCheck(true);
    if (DEBUG_SCENARIO === "checkpoint-check") window.__nuclear_commando_debug.setupCheckpointCheck(0);
    if (DEBUG_SCENARIO === "vertical-scroll-check") window.__nuclear_commando_debug.setupTowerAscentCheck("mid");
    if (DEBUG_SCENARIO === "tower-ascent-check") window.__nuclear_commando_debug.setupTowerAscentCheck("mid");
    if (DEBUG_SCENARIO === "tower-summit-check") window.__nuclear_commando_debug.setupTowerAscentCheck("summit");
    if (DEBUG_SCENARIO === "tower-rooftop-check") window.__nuclear_commando_debug.setupTowerAscentCheck("roof");
    if (DEBUG_SCENARIO === "level1-extended-check") window.__nuclear_commando_debug.setupLevelSectionCheck(0, 4);
    if (DEBUG_SCENARIO === "level2-extended-check") window.__nuclear_commando_debug.setupLevelSectionCheck(1, 3);
    if (DEBUG_SCENARIO === "level3-extended-check") window.__nuclear_commando_debug.setupLevelSectionCheck(2, 3);
    if (DEBUG_SCENARIO === "objective-prop-check") window.__nuclear_commando_debug.setupObjectivePropCheck(0, 0);
    if (DEBUG_SCENARIO === "objective-prop-l1-factory-check") window.__nuclear_commando_debug.setupObjectivePropCheck(0, 1);
    if (DEBUG_SCENARIO === "objective-prop-l1-reactor-check") window.__nuclear_commando_debug.setupObjectivePropCheck(0, 2);
    if (DEBUG_SCENARIO === "objective-prop-l2-check") window.__nuclear_commando_debug.setupObjectivePropCheck(1, 0);
    if (DEBUG_SCENARIO === "objective-prop-l2-reactor-check") window.__nuclear_commando_debug.setupObjectivePropCheck(1, 2);
    if (DEBUG_SCENARIO === "objective-prop-l3-check") window.__nuclear_commando_debug.setupObjectivePropCheck(2, 0);
    if (DEBUG_SCENARIO === "objective-prop-l3-reactor-check") window.__nuclear_commando_debug.setupObjectivePropCheck(2, 2);
    if (DEBUG_SCENARIO === "objective-death-check") window.__nuclear_commando_debug.setupObjectiveDeathCheck(0, 0, 0.68);
    if (DEBUG_SCENARIO === "objective-reactor-death-check") window.__nuclear_commando_debug.setupObjectiveDeathCheck(1, 2, 0.72);
    if (DEBUG_SCENARIO === "crate-destroy-check") window.__nuclear_commando_debug.setupCrateDestroyCheck();
    if (DEBUG_SCENARIO === "shield-pickup-check") window.__nuclear_commando_debug.setupShieldPickupCheck(true);
    if (DEBUG_SCENARIO === "shield-absorb-check") window.__nuclear_commando_debug.setupShieldAbsorbCheck();
    if (DEBUG_SCENARIO === "enemy-recoil-check") window.__nuclear_commando_debug.setupEnemyRecoilCheck();
    if (DEBUG_SCENARIO === "drone-check") window.__nuclear_commando_debug.setupDroneCheck(false);
    if (DEBUG_SCENARIO === "drone-attack-check") window.__nuclear_commando_debug.setupDroneCheck(true);
    if (DEBUG_SCENARIO === "boss-style-check") window.__nuclear_commando_debug.setupBossStyleCheck("giantskull");
    if (DEBUG_SCENARIO === "boss-ironskull-check") window.__nuclear_commando_debug.setupBossStyleCheck("ironskull");
    if (DEBUG_SCENARIO === "boss-skulltank-check") window.__nuclear_commando_debug.setupBossStyleCheck("skulltank");
    if (DEBUG_SCENARIO === "boss-demonspider-check") window.__nuclear_commando_debug.setupBossStyleCheck("demonspider");
    if (DEBUG_SCENARIO === "boss-cyberbrute-check") window.__nuclear_commando_debug.setupBossStyleCheck("cyberbrute");
    if (DEBUG_SCENARIO === "mech-style-check") window.__nuclear_commando_debug.setupMechStyleCheck("crawler");
    if (DEBUG_SCENARIO === "mech-walker-check") window.__nuclear_commando_debug.setupMechStyleCheck("walker");
    if (DEBUG_SCENARIO === "muzzle-check") window.__nuclear_commando_debug.setupMuzzleCheck();
    if (DEBUG_SCENARIO === "laser-beam-check") window.__nuclear_commando_debug.setupLaserBeamCheck();
    if (DEBUG_SCENARIO === "blood-check") window.__nuclear_commando_debug.setupBloodCheck();
    if (DEBUG_SCENARIO === "audio-duck-check") window.__nuclear_commando_debug.setupAudioDuckCheck();
    if (DEBUG_SCENARIO === "smart-bomb-check") window.__nuclear_commando_debug.setupSmartBombCheck(2.15);
    if (DEBUG_SCENARIO === "smart-bomb-fade-check") window.__nuclear_commando_debug.setupSmartBombCheck(4.45);
    if (DEBUG_SCENARIO === "trooper-respawn-check") window.__nuclear_commando_debug.setupTrooperRespawnCheck();
    if (DEBUG_SCENARIO === "corpse-stack-check") window.__nuclear_commando_debug.setupCorpseStackCheck();
    if (DEBUG_SCENARIO === "bomb-pickup-check") window.__nuclear_commando_debug.setupBombPickupCheck(false);
    if (DEBUG_SCENARIO === "bomb-collect-check") window.__nuclear_commando_debug.setupBombPickupCheck(true);
    if (DEBUG_SCENARIO === "bomb-refill-check") window.__nuclear_commando_debug.setupBombRefillCheck();
  }

  function runDebugScenarioWhenReady(tries = 120) {
    if (spritesReady || tries <= 0) {
      setTimeout(runDebugScenario, 0);
      return;
    }
    requestAnimationFrame(() => runDebugScenarioWhenReady(tries - 1));
  }

  function finishLevel() {
    if (state.levelIndex >= LEVELS.length - 1) {
      state.mode = "campaignComplete";
      playMusic(audioState.map.campaignClear, { restart: true, loop: false });
      say(`<strong>Operation Complete</strong><br>Score: ${Math.floor(state.score)}<br>Press Enter to replay.`, 999);
      return;
    }
    state.mode = "levelClear";
    state.transitionT = 3.4;
    playMusic(audioState.map.stageClear, { restart: true, loop: false });
    say(`<strong>${state.level.name} cleared.</strong><br>Moving to ${LEVELS[state.levelIndex + 1].name}.`, 3.4);
  }

  function loseLife() {
    state.playerDeath = null;
    state.lives -= 1;
    if (state.lives <= 0) {
      state.mode = "gameOver";
      playMusic(audioState.map.gameOver, { restart: true, loop: false });
      say("<strong>Mission Failed</strong><br>Press Enter to restart campaign.", 999);
      return;
    }
    const p = state.player;
    const checkpoint = state.checkpoint || null;
    const arenaStart = state.bossActive && state.level?.boss ? state.level.boss.arenaStart + 48 : 60;
    if (checkpoint) {
      p.x = Math.max(arenaStart, checkpoint.x);
      p.y = typeof checkpoint.y === "number" ? checkpoint.y : terrainY(p.x + 10) - p.h;
      p.supportType = checkpoint.support || "terrain";
    } else {
      p.x = Math.max(arenaStart, p.x - 180);
      p.y = terrainY(p.x + 10) - p.h;
      p.supportType = "terrain";
    }
    p.vx = 0;
    p.vy = 0;
    p.crouching = false;
    p.prone = false;
    p.climbing = false;
    p.climbId = null;
    p.climbCombat = false;
    p.climbAimMode = "forward";
    p.climbMoving = false;
    p.hanging = false;
    p.hangId = null;
    p.hangCombat = false;
    p.hangAimMode = "forward";
    p.hangMoving = false;
    p.dropTimer = 0;
    p.downLatch = false;
    p.hp = p.maxHp;
    p.invuln = 1.4;
    p.shieldHits = 0;
    p.shieldFlashT = 0;
    state.bullets = [];
    state.enemyBullets = [];
    state.smartBombs = [];
    state.mode = "playing";
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
      playSfxEvent("pickupWeapon", { volumeMul: 0.88, throttleMs: 120, duckAmount: 0.78, duckHold: 0.1, duckRelease: 6.4 });
      say(`<strong>${meta.label}</strong> unlocked.`, 1.8);
      return;
    }
    slot.level = clamp(slot.level + 1, 1, 3);
    if (Number.isFinite(slot.ammo)) {
      slot.ammo += meta.pickup;
    }
    p.weapon = w;
    playSfxEvent("weaponUpgrade", { volumeMul: 0.9, throttleMs: 120, duckAmount: 0.74, duckHold: 0.12, duckRelease: 6.2 });
    say(`<strong>${meta.label}</strong> upgraded to Mk-${slot.level}.`, 1.4);
  }

  function grantSmartBombs(count = 1) {
    const p = state.player;
    if (!p) return 0;
    const before = p.smartBombs;
    p.smartBombs = clamp(before + count, 0, SMART_BOMB_STOCK);
    const gained = p.smartBombs - before;
    if (gained <= 0) return 0;
    playSfxEvent("pickupWeapon", { volumeMul: 0.82, throttleMs: 120, duckAmount: 0.76, duckHold: 0.08, duckRelease: 6.2 });
    say(`<strong>Smart Bomb</strong><br>${p.smartBombs}/${SMART_BOMB_STOCK} in reserve.`, 1.2);
    return gained;
  }

  function grantShield(hits = SHIELD_HITS_PER_PICKUP) {
    const p = state.player;
    if (!p) return 0;
    const before = p.shieldHits || 0;
    p.shieldHits = clamp(before + hits, 0, MAX_SHIELD_HITS);
    const gained = p.shieldHits - before;
    if (gained <= 0) return 0;
    p.shieldFlashT = 0.32;
    playSfxEvent("pickupWeapon", { volumeMul: 0.8, throttleMs: 120, duckAmount: 0.78, duckHold: 0.08, duckRelease: 6.2 });
    say(`<strong>Energy Shield</strong><br>${p.shieldHits} hits buffered.`, 1.2);
    return gained;
  }

  function absorbPlayerHit(color = "#8ef7ff", boomSize = 18) {
    const p = state.player;
    if (!p || p.shieldHits <= 0) return false;
    p.shieldHits = Math.max(0, p.shieldHits - 1);
    p.shieldFlashT = 0.28;
    p.invuln = Math.max(p.invuln, 0.38);
    playSfxEvent("playerHit", { volumeMul: 0.46, throttleMs: 110, duckAmount: 0.7, duckHold: 0.08, duckRelease: 6.2 });
    boom(p.x + p.w * 0.5, p.y + p.h * 0.44, boomSize, color);
    if (p.shieldHits <= 0) {
      say("<strong>Shield Down</strong>", 0.85);
    }
    return true;
  }

  function flashEnemyDamage(enemy, amount = 0.18) {
    if (!enemy || enemy.dying) return;
    enemy.damageFlashT = Math.max(enemy.damageFlashT || 0, amount);
  }

  function flashObjectiveDamage(objective, amount = 0.24) {
    if (!objective || objective.destroyed) return;
    if (objective.kind !== "reactor" && objective.kind !== "centrifuge") return;
    objective.damageFlashT = Math.max(objective.damageFlashT || 0, amount);
  }

  function startPlayerDeathSequence() {
    const p = state.player;
    if (!p || state.playerDeath || state.mode !== "playing") return false;
    const render = getPlayerRenderState(p);
    const sprite = getPlayerSpriteState(p, render);
    const spriteKey = sprite.frames > 1 ? pickAnimKey(sprite.key, sprite.frames, sprite.fps, sprite.phase) : sprite.key;
    const hitDir = normalizeVec(p.vx || p.face, p.vy - 0.18);
    state.mode = "playerDeath";
    state.bullets = [];
    state.enemyBullets = [];
    state.smartBombs = [];
    p.hp = 0;
    p.invuln = 99;
    p.fireCd = 99;
    p.muzzleFlashT = 0;
    p.crouching = false;
    p.prone = false;
    p.climbing = false;
    p.climbId = null;
    p.climbCombat = false;
    p.climbAimMode = "forward";
    p.climbMoving = false;
    p.hanging = false;
    p.hangId = null;
    p.hangCombat = false;
    p.hangAimMode = "forward";
    p.hangMoving = false;
    p.dropTimer = 0;
    p.shieldHits = 0;
    p.shieldFlashT = 0;
    state.playerDeath = {
      t: 0,
      duration: PLAYER_DEATH_TOTAL_DURATION,
      fallDuration: PLAYER_DEATH_FALL_DURATION,
      burstTimer: 0.08,
      flashT: 0.18,
      detonated: false,
      hidden: false,
      bodyX: p.x,
      bodyY: p.y,
      bodyW: p.w,
      bodyH: p.h,
      renderOffsetX: render.sx - p.x,
      renderOffsetY: render.sy - p.y,
      renderW: render.sw,
      renderH: render.sh,
      spriteKey,
      flipScale: render.flipScale,
      vx: (p.vx || hitDir.x * 120) * 0.35,
      vy: Math.min(-180, p.vy - 160),
      rot: 0,
      vr: (p.face || 1) * 4.8,
      face: p.face || 1,
    };
    playSfxEvent("playerDeath", { volumeMul: 0.92, throttleMs: 120, duckAmount: 0.34, duckHold: 0.24, duckRelease: 4.8 });
    spawnBloodBurst(p.x + p.w * 0.52, p.y + p.h * 0.4, hitDir.x, hitDir.y - 0.2, 14, 210, 1.15);
    boom(p.x + p.w * 0.5, p.y + p.h * 0.45, 18, "#ffb7b7");
    say("<strong>Nuclear Commando Down</strong><br>Critical suit breach.", PLAYER_DEATH_TOTAL_DURATION);
    return true;
  }

  function getPlayerDeathWhiteoutAlpha() {
    const seq = state.playerDeath;
    if (!seq) return 0;
    return clamp((seq.flashT || 0) * 0.72, 0, seq.detonated ? 0.85 : 0.36);
  }

  function boom(x, y, size, color) {
    state.explosions.push({ x, y, size, t: 0, ttl: 0.45, color });
    if (size >= 180) {
      playSfxEvent("nuclearBlast", { volumeMul: 0.95, throttleMs: 1400, duckAmount: 0.18, duckHold: 0.42, duckRelease: 2.8 });
    } else if (size >= 52) {
      playSfxEvent("bigExplosion", { volumeMul: 0.82, throttleMs: 110, duckAmount: 0.36, duckHold: 0.22, duckRelease: 4.2 });
    } else if (size >= 16) {
      playSfxEvent("explosion", { volumeMul: 0.7, throttleMs: 70, duckAmount: 0.55, duckHold: 0.12, duckRelease: 5.8 });
    }
  }

  function getActiveBoss() {
    return state.enemies.find((e) => e.kind === "boss") || null;
  }

  function getDyingBoss() {
    return state.enemies.find((e) => e.kind === "boss" && e.dying) || null;
  }

  function getBossDeathScreenShake() {
    const seq = state.bossDeath;
    if (!seq) return { x: 0, y: 0 };
    const t = seq.t || 0;
    const finalSecond = Math.max(0, t - Math.max(0, BOSS_DEATH_DURATION - 1));
    const whiteT = Math.max(0, t - BOSS_DEATH_DURATION);
    const preBlast = clamp(finalSecond / 1, 0, 1);
    const blastKick = whiteT > 0 ? Math.exp(-whiteT * 2.8) : 0;
    const amplitude = preBlast * 7 + blastKick * 16;
    if (amplitude <= 0.01) return { x: 0, y: 0 };
    return {
      x: Math.sin(state.levelClock * 55 + 0.8) * amplitude,
      y: Math.cos(state.levelClock * 48 + 1.3) * amplitude * 0.62,
    };
  }

  function getBossWhiteoutAlpha() {
    const seq = state.bossDeath;
    if (!seq) return 0;
    const whiteT = Math.max(0, (seq.t || 0) - BOSS_DEATH_DURATION);
    if (whiteT <= 0) return 0;
    const hold = 0.65;
    const ramp = 0.18;
    if (whiteT < ramp) return clamp(whiteT / ramp, 0, 1);
    if (whiteT < hold) return 1;
    return clamp(1 - (whiteT - hold) / Math.max(0.001, BOSS_WHITEOUT_DURATION - hold), 0, 1);
  }

  function getSmartBombRadius(bomb) {
    const growT = clamp((bomb?.t || 0) / Math.max(0.001, bomb?.growDuration || SMART_BOMB_GROW_DURATION), 0, 1);
    return (bomb?.maxRadius || SMART_BOMB_MAX_RADIUS) * Math.pow(growT, 1.08);
  }

  function getSmartBombWhiteoutAlphaFor(bomb) {
    if (!bomb) return 0;
    const flashStart = bomb.growDuration || SMART_BOMB_GROW_DURATION;
    const flashDuration = bomb.flashDuration || SMART_BOMB_FLASH_DURATION;
    const flashEnd = flashStart + flashDuration;
    const holdEnd = flashEnd + (bomb.whiteoutHold || SMART_BOMB_WHITEOUT_HOLD);
    const fadeDuration = bomb.fadeDuration || SMART_BOMB_FADE_DURATION;
    if (bomb.t <= 0) return 0;
    if (bomb.t < flashStart) return 0;
    if (bomb.t < flashEnd) return Math.pow(clamp((bomb.t - flashStart) / Math.max(0.001, flashDuration), 0, 1), 0.55);
    if (bomb.t < holdEnd) return 1;
    return Math.pow(clamp(1 - ((bomb.t - holdEnd) / Math.max(0.001, fadeDuration)), 0, 1), 0.68);
  }

  function getSmartBombWhiteoutAlpha() {
    let alpha = 0;
    for (const bomb of state.smartBombs) alpha = Math.max(alpha, getSmartBombWhiteoutAlphaFor(bomb));
    return alpha;
  }

  function spawnBossDeathBurst(boss, seq, intensity = 0) {
    if (!boss) return;
    const cx = boss.x + boss.w * 0.5;
    const cy = boss.y + boss.h * 0.46;
    const px = cx + rand(-boss.w * 0.48, boss.w * 0.48);
    const py = cy + rand(-boss.h * 0.38, boss.h * 0.42);
    const size = lerp(22, 76, intensity) * rand(0.7, 1.16);
    const color = Math.random() < 0.18 ? "#fff0b2" : Math.random() < 0.58 ? "#ffb05a" : "#ff684b";
    boom(px, py, size, color);
    if (Math.random() < 0.42 + intensity * 0.42) {
      const sx = px + rand(-46, 46);
      const sy = py + rand(-36, 34);
      boom(sx, sy, size * rand(0.35, 0.65), "#ffd37d");
    }
    seq.flashT = Math.max(seq.flashT || 0, 0.08 + intensity * 0.12);
  }

  function startBossDeathSequence(boss) {
    if (!boss || boss.dying || state.bossDeath) return false;
    state.score += 2600;
    state.combo += 1;
    state.comboTimer = 2.2;
    state.bossActive = false;
    state.bossDefeated = true;
    state.mode = "bossDeath";
    state.bullets = [];
    state.enemyBullets = [];
    boss.hp = 0;
    boss.vx = 0;
    boss.fireCd = 999;
    boss.attackT = 0;
    boss.dying = true;
    boss.deathT = 0;
    state.bossDeath = {
      t: 0,
      duration: BOSS_DEATH_TOTAL_DURATION,
      burstTimer: 0,
      flashT: 0,
      detonated: false,
      name: boss.bossName || state.level?.boss?.name || "Boss",
    };
    spawnBossDeathBurst(boss, state.bossDeath, 0.18);
    boom(boss.x + boss.w * 0.5, boss.y + boss.h * 0.5, 72, "#ffd37d");
    say(`<strong>${state.bossDeath.name}</strong><br>Critical overload. Clear the blast radius.`, BOSS_DEATH_TOTAL_DURATION);
    return true;
  }

  function getObjectiveDeathDuration(objective) {
    if (!objective) return OBJECTIVE_DEATH_DURATION;
    if (objective.kind === "reactor") return OBJECTIVE_REACTOR_DEATH_DURATION;
    if (objective.kind === "centrifuge") return OBJECTIVE_CENTRIFUGE_DEATH_DURATION;
    return OBJECTIVE_DEATH_DURATION;
  }

  function getObjectiveDeathSequence(objectiveId) {
    return state.objectiveDeaths.find((seq) => seq.id === objectiveId) || null;
  }

  function spawnObjectiveDeathBurst(seq, intensity = 0.3) {
    if (!seq) return;
    const cx = seq.x + seq.w * (0.5 + rand(-0.18, 0.18));
    const cy = seq.y + seq.h * (0.48 + rand(-0.16, 0.14));
    const maxSpan = Math.max(seq.w, seq.h);
    const size = lerp(maxSpan * 0.18, maxSpan * 0.56, clamp(intensity, 0, 1));
    const hot = seq.kind === "reactor" ? "#fff6cc" : seq.kind === "centrifuge" ? "#e7fff4" : "#ffe8b6";
    const main = seq.kind === "reactor" ? "#9dfd87" : seq.kind === "centrifuge" ? "#9ef6ff" : "#ffb067";
    const ember = seq.kind === "reactor" ? "#ffcf74" : "#ff9358";
    boom(cx, cy, size, hot);
    boom(cx + rand(-18, 18), cy + rand(-14, 14), size * rand(0.48, 0.72), main);
    if (intensity > 0.45) {
      boom(cx + rand(-24, 24), cy + rand(-18, 18), size * rand(0.32, 0.55), ember);
    }
    seq.flashT = Math.max(seq.flashT || 0, 0.08 + intensity * 0.18);
  }

  function startObjectiveDeathSequence(objective, source = "bullet") {
    if (!objective) return null;
    const existing = getObjectiveDeathSequence(objective.id);
    if (existing) return existing;
    const seq = {
      id: objective.id,
      label: objective.label,
      kind: objective.kind,
      x: objective.x,
      y: objective.y,
      w: objective.w,
      h: objective.h,
      t: 0,
      duration: getObjectiveDeathDuration(objective),
      burstTimer: 0,
      flashT: 0,
      source,
    };
    state.objectiveDeaths.push(seq);
    spawnObjectiveDeathBurst(seq, source === "smartBomb" ? 0.4 : 0.24);
    return seq;
  }

  function getObjectiveWhiteoutAlpha() {
    let alpha = 0;
    for (const seq of state.objectiveDeaths) {
      const progress = clamp(seq.t / Math.max(0.001, seq.duration), 0, 1);
      const flash = Math.min(0.2, (seq.flashT || 0) * 0.62);
      let wave = 0;
      if (progress >= 0.62) {
        const local = clamp((progress - 0.62) / 0.38, 0, 1);
        wave = local < 0.34
          ? lerp(0, seq.kind === "reactor" ? 0.26 : 0.18, local / 0.34)
          : lerp(seq.kind === "reactor" ? 0.26 : 0.18, 0, (local - 0.34) / 0.66);
      }
      alpha = Math.max(alpha, flash, wave);
    }
    return clamp(alpha, 0, 0.28);
  }

  function updateObjectiveDeathSequences(dt) {
    if (!state.objectiveDeaths.length) return;
    const remaining = [];
    for (const seq of state.objectiveDeaths) {
      seq.t += dt;
      seq.flashT = Math.max(0, (seq.flashT || 0) - dt);
      seq.burstTimer -= dt;
      const progress = clamp(seq.t / Math.max(0.001, seq.duration), 0, 1);
      const burstRate = progress < 0.55 ? 0.15 : 0.09;
      while (seq.burstTimer <= 0 && progress < 0.92) {
        seq.burstTimer += burstRate;
        spawnObjectiveDeathBurst(seq, 0.24 + progress * 0.58);
      }
      if (seq.t < seq.duration) {
        remaining.push(seq);
      }
    }
    state.objectiveDeaths = remaining;
  }

  function updatePlayerDeathSequence(dt) {
    const seq = state.playerDeath;
    if (!seq) return;
    seq.t += dt;
    seq.flashT = Math.max(0, (seq.flashT || 0) - dt);
    const fallT = clamp(seq.t / Math.max(0.001, seq.fallDuration), 0, 1);
    if (seq.t < seq.fallDuration) {
      seq.vy += BLOOD_GRAVITY * 0.88 * dt;
      seq.bodyX += seq.vx * dt;
      seq.bodyY += seq.vy * dt;
      seq.rot = lerp(0, seq.face > 0 ? 1.18 : -1.18, fallT);
      seq.vr *= Math.exp(-3.2 * dt);
      const supportY = supportYForBody({ x: seq.bodyX, y: seq.bodyY, w: seq.bodyW, h: seq.bodyH }, true);
      if (seq.bodyY >= supportY) {
        seq.bodyY = supportY;
        seq.vx *= 0.18;
        seq.vy = 0;
      }
    } else if (!seq.detonated) {
      seq.vx *= Math.exp(-5.2 * dt);
      seq.burstTimer -= dt;
      const progress = clamp((seq.t - seq.fallDuration) / Math.max(0.001, PLAYER_DEATH_EXPLODE_DURATION), 0, 1);
      const burstInterval = lerp(0.16, 0.05, progress);
      while (seq.burstTimer <= 0) {
        seq.burstTimer += burstInterval;
        const cx = seq.bodyX + seq.bodyW * (0.5 + rand(-0.18, 0.18));
        const cy = seq.bodyY + seq.bodyH * (0.44 + rand(-0.14, 0.18));
        boom(cx, cy, lerp(16, 42, progress) * rand(0.82, 1.1), Math.random() < 0.4 ? "#fff0bf" : "#ff9368");
        if (Math.random() < 0.68) boom(cx + rand(-14, 14), cy + rand(-10, 10), lerp(10, 22, progress), "#ff684e");
        seq.flashT = Math.max(seq.flashT, 0.12 + progress * 0.18);
      }
      if (progress >= 0.88) {
        seq.detonated = true;
        seq.hidden = true;
        seq.flashT = Math.max(seq.flashT, 1.05);
        boom(seq.bodyX + seq.bodyW * 0.5, seq.bodyY + seq.bodyH * 0.46, 120, "#fff8d6");
        boom(seq.bodyX + seq.bodyW * 0.42, seq.bodyY + seq.bodyH * 0.58, 82, "#ffb26a");
        boom(seq.bodyX + seq.bodyW * 0.56, seq.bodyY + seq.bodyH * 0.32, 68, "#ff714a");
      }
    }
    if (seq.t >= seq.duration) {
      loseLife();
    }
  }

  function updateDamageFlashes(dt) {
    for (const objective of state.objectives) {
      if (typeof objective.damageFlashT === "number") objective.damageFlashT = Math.max(0, objective.damageFlashT - dt);
    }
  }

  function destroyLevelObstacle(obstacle, source = "bullet") {
    if (!obstacle || obstacle.destroyed || obstacle.kind !== "crate") return false;
    obstacle.hp = 0;
    obstacle.destroyed = true;
    const cx = obstacle.x + obstacle.w * 0.5;
    const cy = obstacle.y + obstacle.h * 0.48;
    boom(cx, cy, 28, "#ffe2ba");
    boom(cx + rand(-8, 8), cy + rand(-6, 6), 18, source === "smartBomb" ? "#fff1c7" : "#ff965b");
    boom(cx + rand(-12, 12), cy + rand(-10, 10), 14, "#ffd48a");
    return true;
  }

  function damageLevelObstacle(obstacle, dmg = 0, source = "bullet") {
    if (!obstacle || obstacle.destroyed || obstacle.kind !== "crate") return false;
    obstacle.hp = Math.max(0, (obstacle.hp || obstacle.maxHp || CRATE_HP) - Math.max(0, dmg));
    if (obstacle.hp <= 0) {
      destroyLevelObstacle(obstacle, source);
      return true;
    }
    boom(
      obstacle.x + obstacle.w * 0.5 + rand(-4, 4),
      obstacle.y + obstacle.h * 0.48 + rand(-4, 4),
      10,
      "#ffd7aa",
    );
    return false;
  }

  function destroyObjective(o, source = "bullet") {
    if (!o || o.destroyed) return false;
    o.hp = 0;
    o.destroyed = true;
    state.score += 700;
    playSfxEvent("objectiveDestroy", { volumeMul: 0.9, throttleMs: 110, duckAmount: 0.4, duckHold: 0.2, duckRelease: 4.6 });
    const size = source === "smartBomb" ? 64 : 48;
    const hot = o.kind === "reactor" ? "#ecffd2" : o.kind === "centrifuge" ? "#e4ffff" : (source === "smartBomb" ? "#fff1c7" : "#ffdfba");
    const main = o.kind === "reactor" ? "#96ff7a" : o.kind === "centrifuge" ? "#7fe7ff" : "#ff9f74";
    boom(o.x + o.w * 0.5, o.y + o.h * 0.5, size, hot);
    boom(o.x + o.w * 0.5, o.y + o.h * 0.5, size * 0.7, main);
    startObjectiveDeathSequence(o, source);
    if (o.reward) {
      state.pickups.push({ id: `o-${o.id}`, type: "weapon", weapon: o.reward, x: o.x + o.w * 0.5, y: o.y + o.h * 0.5, w: 24, h: 24, vy: -180, bob: rand(0, Math.PI * 2) });
    }
    say(`<strong>${o.label}</strong> disabled. Weak point: ${o.weak}.`, 1.7);
    return true;
  }

  function pushLimited(list, value, limit) {
    list.push(value);
    while (list.length > limit) list.shift();
  }

  function spawnBloodBurst(x, y, dirX = 1, dirY = 0, count = 8, speed = 180, spread = 1) {
    const aim = normalizeVec(dirX, dirY);
    for (let i = 0; i < count; i++) {
      const angle = Math.atan2(aim.y, aim.x) + rand(-spread, spread);
      const velocity = speed * rand(0.45, 1.15);
      pushLimited(state.bloodParticles, {
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - rand(25, 90),
        r: rand(1.6, 3.8),
        ttl: rand(0.45, 0.95),
        t: 0,
        alpha: rand(0.65, 0.95),
        color: Math.random() < 0.35 ? "#ff5448" : Math.random() < 0.55 ? "#c71f25" : "#7d0a14",
      }, MAX_BLOOD_PARTICLES);
    }
  }

  function resolveTrooperDeathBase(corpse) {
    const suffix = corpse.variant ? `_${corpse.variant}` : "";
    const preferred = `enemy_trooper${suffix}_death`;
    if (hasSpriteKey(`${preferred}_0`) || hasSpriteKey(preferred)) return preferred;
    if (hasSpriteKey("enemy_trooper_death_0") || hasSpriteKey("enemy_trooper_death")) return "enemy_trooper_death";
    return resolveTrooperSpriteBase({ kind: "trooper", variant: corpse.variant, attackT: 0, x: corpse.x, y: corpse.y, w: corpse.w, h: corpse.h });
  }

  function spawnTrooperCorpse(enemy, sourceBullet = null) {
    const shotDir = sourceBullet ? normalizeVec(sourceBullet.vx, sourceBullet.vy) : { x: enemy.dir || 1, y: -0.15 };
    const corpse = {
      id: `corpse-${Math.floor((state.levelClock || 0) * 1000)}-${Math.floor(Math.random() * 99999)}`,
      kind: "trooper",
      variant: enemy.variant || "",
      x: enemy.x,
      y: enemy.y,
      w: enemy.w,
      h: enemy.h,
      vx: shotDir.x * rand(18, 62),
      vy: -rand(70, 160),
      rot: shotDir.x * rand(-0.22, 0.22),
      vr: shotDir.x * rand(-2.8, 2.8),
      t: 0,
      landed: false,
      flip: getEnemyFacingFlip(enemy),
      poolT: 0.12,
      poolTarget: rand(0.9, 1.25),
      poolScaleX: rand(20, 34),
      poolScaleY: rand(10, 18),
      splats: Array.from({ length: 8 }, () => ({
        ox: rand(-26, 26),
        oy: rand(-3, 6),
        rx: rand(2.5, 8.5),
        ry: rand(1.5, 4.8),
        a: rand(0.22, 0.52),
      })),
      supportCorpseId: null,
    };
    pushLimited(state.corpses, corpse, MAX_CORPSES);
    spawnBloodBurst(enemy.x + enemy.w * 0.44, enemy.y + enemy.h * 0.38, shotDir.x, shotDir.y - 0.25, 24, 255, 1.35);
  }

  function scheduleTrooperRespawn(enemy) {
    if (!enemy || enemy.kind !== "trooper") return false;
    const delay = typeof enemy.respawnAfter === "number" ? enemy.respawnAfter : TROOPER_RESPAWN_DELAY;
    if (!(delay > 0)) return false;
    const spawnSpec = enemy.spawnSpec
      ? { ...enemy.spawnSpec }
      : {
          t: "trooper",
          id: enemy.spawnId || `trooper-${Math.round(enemy.x)}-${Math.round(enemy.surfaceY ?? enemy.y)}`,
          x: enemy.spawnX ?? enemy.x,
          surfaceY: enemy.surfaceY,
          patrolMin: enemy.patrolMin,
          patrolMax: enemy.patrolMax,
          variant: enemy.variant,
          variantSeed: enemy.variantSeed,
          respawnAfter: delay,
        };
    const respawnId = spawnSpec.id || enemy.spawnId || `trooper-${Math.round(spawnSpec.x)}-${Math.round(spawnSpec.surfaceY ?? 0)}`;
    if (state.respawnQueue.some((ticket) => ticket.id === respawnId)) return false;
    state.respawnQueue.push({
      id: respawnId,
      due: state.levelClock + delay,
      spawn: { ...spawnSpec, id: respawnId, respawnAfter: delay },
    });
    return true;
  }

  function destroyEnemyWithSmartBomb(enemy, bomb) {
    if (!enemy || enemy.hp <= 0 || enemy.dying) return false;
    if (enemy.kind === "boss") return startBossDeathSequence(enemy);
    state.score += enemy.kind === "mech" ? 320 : 120;
    state.combo += 1;
    state.comboTimer = 2.2;
    enemy.hp = 0;
    const cx = enemy.x + enemy.w * 0.5;
    const cy = enemy.y + enemy.h * 0.48;
    const dirX = cx - bomb.x;
    const dirY = cy - bomb.y;
    if (enemy.kind === "trooper") {
      spawnTrooperCorpse(enemy, { vx: dirX || enemy.dir || 1, vy: dirY - 0.15 });
      scheduleTrooperRespawn(enemy);
      spawnBloodBurst(cx, cy, dirX || enemy.dir || 1, dirY - 0.22, 18, 220, 1.1);
      boom(cx, cy, 28, "#ffe6aa");
      boom(cx + rand(-8, 8), cy + rand(-8, 8), 18, "#ff8654");
    } else if (enemy.kind === "mech") {
      boom(cx, cy, 52, "#fff0b2");
      boom(cx + rand(-16, 16), cy + rand(-12, 12), 38, "#ff8d5d");
      boom(cx + rand(-20, 20), cy + rand(-16, 16), 28, "#ffd27a");
    } else if (enemy.kind === "turret") {
      boom(cx, cy, 34, "#ffe9ba");
      boom(cx + rand(-10, 10), cy + rand(-6, 6), 24, "#ff8c58");
    } else {
      boom(cx, cy, 24, "#ffe2ad");
      boom(cx + rand(-8, 8), cy + rand(-8, 8), 18, "#ff8d65");
    }
    spawnDrop(enemy);
    return true;
  }

  function deploySmartBomb() {
    const p = state.player;
    if (!p || state.mode !== "playing" || p.smartBombs <= 0) return false;
    p.smartBombs -= 1;
    const originX = p.x + p.w * 0.5 + (p.face > 0 ? 10 : -10);
    const originY = p.y + p.h * 0.42;
    state.smartBombs.push({
      x: originX,
      y: originY,
      t: 0,
      duration: SMART_BOMB_DURATION,
      growDuration: SMART_BOMB_GROW_DURATION,
      flashDuration: SMART_BOMB_FLASH_DURATION,
      whiteoutHold: SMART_BOMB_WHITEOUT_HOLD,
      fadeDuration: SMART_BOMB_FADE_DURATION,
      maxRadius: SMART_BOMB_MAX_RADIUS,
      pulseT: 0,
      flashed: false,
    });
    boom(originX, originY, 22, "#fff4b8");
    playSfxEvent("bigExplosion", { volumeMul: 0.9, throttleMs: 100, duckAmount: 0.28, duckHold: 0.22, duckRelease: 3.8 });
    say(`<strong>Smart Bomb</strong><br>${p.smartBombs} remaining.`, 1.1);
    return true;
  }

  function spawnEnemy(spawn) {
    const base = { x: spawn.x, y: spawn.y || 0, vx: 0, vy: 0, fireCd: rand(0.5, 1.3), wave: rand(0, Math.PI * 2), drop: 0.18, damageFlashT: 0 };
    const surfaceY = typeof spawn.surfaceY === "number" ? spawn.surfaceY : null;
    const patrolMin = typeof spawn.patrolMin === "number" ? spawn.patrolMin : null;
    const patrolMax = typeof spawn.patrolMax === "number" ? spawn.patrolMax : null;
    const spawnSpec = { ...spawn };
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
        spawnId: spawn.id || null,
        spawnX: spawn.x,
        variantSeed: spawn.variantSeed,
        respawnAfter: typeof spawn.respawnAfter === "number" ? spawn.respawnAfter : TROOPER_RESPAWN_DELAY,
        spawnSpec,
      });
    } else if (spawn.t === "drone") {
      state.enemies.push({ ...base, kind: "drone", w: 34, h: 24, y: spawn.y || 250, baseY: spawn.y || 250, hp: 56, maxHp: 56, speed: 112 });
    } else if (spawn.t === "turret") {
      state.enemies.push({ ...base, kind: "turret", w: 36, h: 38, y: (surfaceY ?? terrainY(spawn.x)) - 38, surfaceY, hp: 130, maxHp: 130, speed: 0, fireCd: rand(0.3, 0.9), drop: 0.1 });
    } else if (spawn.t === "mech") {
      const spriteStyle = spawn.spriteStyle || "crawler";
      const dims = MECH_STYLE_DIMS[spriteStyle] || MECH_STYLE_DIMS.crawler;
      const w = spawn.w || dims.w;
      const h = spawn.h || dims.h;
      state.enemies.push({ ...base, kind: "mech", spriteStyle, w, h, y: (surfaceY ?? terrainY(spawn.x)) - h, surfaceY, patrolMin, patrolMax, hp: spawn.hp || 290, maxHp: spawn.hp || 290, speed: spawn.speed || 54, fireCd: rand(0.7, 1.1), drop: 0.24, dir: 1 });
    } else if (spawn.t === "boss") {
      const spriteStyle = spawn.spriteStyle || LEVEL_BOSS_STYLE[state.levelIndex] || "cyberbrute";
      const dims = BOSS_STYLE_DIMS[spriteStyle] || BOSS_STYLE_DIMS.cyberbrute;
      const w = spawn.w || dims.w;
      const h = spawn.h || dims.h;
      state.enemies.push({
        ...base,
        kind: "boss",
        spriteStyle,
        w,
        h,
        y: terrainY(spawn.x) - h,
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
    enemy.attackT = Math.max(enemy.attackT || 0, getEnemyAttackWindow(enemy));
    const p = state.player;
    const muzzle = getEnemyMuzzlePoint(enemy);
    const sx = muzzle.x, sy = muzzle.y;
    const tx = p.x + p.w * 0.5, ty = p.y + p.h * 0.45;
    const dx = tx - sx, dy = ty - sy;
    const d = Math.hypot(dx, dy) || 1;
    enemy.shotAimX = dx / d;
    enemy.shotAimY = dy / d;
    playSfxEvent("enemyFire", {
      volumeMul: enemy.kind === "boss" ? 0.82 : 0.64,
      throttleMs: enemy.kind === "boss" ? 120 : 70,
      duckAmount: enemy.kind === "boss" ? 0.42 : 0.72,
      duckHold: enemy.kind === "boss" ? 0.16 : 0.08,
      duckRelease: enemy.kind === "boss" ? 4.4 : 6.8,
    });
    if (enemy.kind === "boss") {
      const baseAngle = Math.atan2(dy, dx);
      for (const angle of [-0.24, -0.08, 0.08, 0.24]) {
        const shot = baseAngle + angle;
        state.enemyBullets.push({ x: sx, y: sy, vx: Math.cos(shot) * 420, vy: Math.sin(shot) * 420, r: 5 * BULLET_RADIUS_SCALE, ttl: 2.4, dmg: 16, color: "#ffae63" });
      }
      return;
    }
    const speed = enemy.kind === "mech" ? 440 : enemy.kind === "turret" ? 390 : 340;
    state.enemyBullets.push({
      x: sx,
      y: sy,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      r: (enemy.kind === "mech" ? 5 : 4) * BULLET_RADIUS_SCALE,
      ttl: 2,
      dmg: enemy.kind === "mech" ? 18 : 10,
      color: enemy.kind === "drone" ? "#8dff45" : enemy.kind === "turret" ? "#ff8f6a" : "#ff5969",
    });
  }

  function activateBossEncounter() {
    const boss = state.level?.boss;
    if (!boss || state.bossActive || state.bossDefeated) return;
    state.bossActive = true;
    spawnEnemy({ t: "boss", ...boss });
    playSfxEvent("bossAlarm", { volumeMul: 0.88, throttleMs: 160, duckAmount: 0.34, duckHold: 0.24, duckRelease: 4 });
    playMusic(state.levelIndex === 1 ? (audioState.map.bossAlt || audioState.map.boss) : audioState.map.boss, { restart: true, loop: true });
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
    const p = state.player;
    const bombNeed = p ? clamp((SMART_BOMB_STOCK - p.smartBombs) / SMART_BOMB_STOCK, 0, 1) : 0;
    const bombDropChance = 0.12 + bombNeed * 0.28;
    const pick = Math.random() < bombDropChance
      ? "bomb"
      : ["SPREAD", "LASER", "FLAME", "med"][Math.floor(Math.random() * 4)];
    state.pickups.push({
      id: `${pick}-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      type: pick === "med" || pick === "bomb" ? pick : "weapon",
      weapon: pick === "med" || pick === "bomb" ? undefined : pick,
      amount: pick === "bomb" ? 1 : undefined,
      x: enemy.x + enemy.w * 0.5,
      y: enemy.y,
      w: 24,
      h: 24,
      vy: pick === "med" ? -140 : pick === "bomb" ? -150 : -160,
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

    if (weapon === "RIFLE") add(0, 1, 1, 2.35 * BULLET_RADIUS_SCALE, 1.2, 1);
    if (weapon === "LASER") add(0, 1.1, 1, 1.65 * BULLET_RADIUS_SCALE, 1.3, meta.pierce[lvl - 1]);
    if (weapon === "SPREAD") {
      const pellets = meta.pellets[lvl - 1], cone = meta.cone[lvl - 1];
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0.5 : i / (pellets - 1);
        add(lerp(-cone * 0.5, cone * 0.5, t), 1, 0.92, 2.4 * BULLET_RADIUS_SCALE, 0.85, 1);
      }
    }
    if (weapon === "FLAME") {
      for (let i = 0; i < 3; i++) {
        add(rand(-0.2, 0.2), rand(0.9, 1.05), rand(0.84, 1.08), meta.radius[lvl - 1] * BULLET_RADIUS_SCALE, rand(meta.ttl[lvl - 1] * 0.8, meta.ttl[lvl - 1] * 1.15), 1);
      }
    }

    p.fireCd = meta.cd[lvl - 1];
    p.muzzleFlashT = weapon === "FLAME" ? 0.11 : 0.08;
    playSfxEvent("playerFire", {
      volumeMul: weapon === "FLAME" ? 0.5 : weapon === "LASER" ? 0.7 : 0.78,
      throttleMs: weapon === "FLAME" ? 30 : 55,
      duckAmount: weapon === "FLAME" ? 0.78 : weapon === "LASER" ? 0.68 : 0.72,
      duckHold: weapon === "FLAME" ? 0.06 : 0.08,
      duckRelease: weapon === "FLAME" ? 9.2 : 7.8,
    });
    if (Number.isFinite(slot.ammo)) slot.ammo = Math.max(0, slot.ammo - 1);
  }

  function updatePlayer(dt) {
    const p = state.player;
    p.shieldFlashT = Math.max(0, (p.shieldFlashT || 0) - dt);
    const left = !!keys.ArrowLeft;
    const right = !!keys.ArrowRight;
    const upHeld = !!keys.ArrowUp;
    const downHeld = !!keys.ArrowDown;
    const downPressed = downHeld && !p.downLatch;
    const jumpHeld = !!keys.Space;
    const shootHeld = !!keys.KeyZ;
    const aimLockHeld = isAimLockActive(p);
    const prevOnGround = p.onGround;
    const prevRect = { x: p.x, y: p.y, w: p.w, h: p.h };
    const climbTouch = findClimbableForRect(prevRect);
    const hangTouch = findHangableForRect(prevRect);
    const wantsDrop = jumpHeld && !p.jumpLatch && p.onGround && p.supportType === "platform" && downHeld;
    let desiredFace = p.face;
    if (!p.climbing) {
      p.climbCombat = false;
    p.climbAimMode = "forward";
      p.climbMoving = false;
    }
    if (!p.hanging) {
      p.hangCombat = false;
      p.hangAimMode = "forward";
      p.hangMoving = false;
    }

    if (wantsDrop) {
      p.onGround = false;
      p.supportType = null;
      p.dropTimer = PLAYER_DROP_THROUGH;
      p.vy = Math.max(p.vy, 120);
      p.crouching = false;
      p.prone = false;
    }

    if (!p.climbing && climbTouch && !wantsDrop && (upHeld || (downHeld && !p.onGround))) {
      const climbFacing = getClimbFacingSign(climbTouch);
      p.climbing = true;
      p.climbId = climbTouch.id;
      p.hanging = false;
      p.hangId = null;
      p.crouching = false;
      p.prone = false;
      p.onGround = false;
      p.supportType = "climb";
      p.vx = 0;
      p.vy = 0;
      p.face = climbFacing;
      p.visualFace = climbFacing;
      p.x = clamp(climbTouch.x + climbTouch.w * 0.5 - p.w * 0.5, 0, state.level.length - p.w);
    }

    if (!p.hanging && !p.climbing && p.dropTimer <= 0 && hangTouch && !p.onGround && p.vy <= 260 && (jumpHeld || upHeld || shootHeld)) {
      p.hanging = true;
      p.hangId = hangTouch.id;
      p.climbing = false;
      p.climbId = null;
      p.onGround = false;
      p.supportType = "hang";
      p.vx = 0;
      p.vy = 0;
      p.y = getHangAttachY(hangTouch);
      p.x = clamp(p.x, hangTouch.x - p.w * 0.3, hangTouch.x + hangTouch.w - p.w * 0.7);
    }

    if (p.hanging) {
      const hang = levelHangables().find((h) => h.id === p.hangId) || hangTouch;
      if (!hang) {
        p.hanging = false;
        p.hangId = null;
      } else if (downHeld && !aimLockHeld) {
        p.hanging = false;
        p.hangId = null;
        p.hangCombat = false;
        p.supportType = null;
        p.onGround = false;
        p.dropTimer = Math.max(p.dropTimer, PLAYER_HANG_RELEASE);
        p.vx = 0;
        p.vy = Math.max(p.vy, 180);
        p.airT = 0;
      } else if (jumpHeld && !p.jumpLatch) {
        const launchDir = left === right ? p.face : (right ? 1 : -1);
        p.hanging = false;
        p.hangId = null;
        p.supportType = null;
        p.vx = launchDir * (downHeld ? 120 : 240);
        p.vy = downHeld ? 80 : -780;
        p.airT = 0;
        playSfxEvent("playerJump", { volumeMul: 0.72, throttleMs: 90, duckAmount: 0.86, duckHold: 0.05, duckRelease: 8.8 });
      } else {
        const hangMove = aimLockHeld ? 0 : ((right ? 1 : 0) - (left ? 1 : 0));
        p.hangMoving = Math.abs(hangMove) > 0.01;
        if (hangMove) p.face = hangMove > 0 ? 1 : -1;
        p.x = clamp(p.x + hangMove * PLAYER_HANG_SPEED * dt, hang.x - p.w * 0.3, hang.x + hang.w - p.w * 0.7);
        p.y = getHangAttachY(hang);
        p.vx = 0;
        p.vy = 0;
        p.onGround = false;
        p.supportType = "hang";
        p.airT = 0;
        if (aimLockHeld) {
          p.hangCombat = true;
          if (upHeld && left !== right) {
            p.hangAimMode = "diag";
            p.aimX = p.face * 0.72;
            p.aimY = -0.72;
          } else if (upHeld) {
            p.hangAimMode = "up";
            p.aimX = 0;
            p.aimY = -1;
          } else if (downHeld && left !== right) {
            p.hangAimMode = "downDiag";
            p.aimX = p.face * 0.72;
            p.aimY = 0.72;
          } else if (downHeld) {
            p.hangAimMode = "down";
            p.aimX = 0;
            p.aimY = 1;
          } else {
            if (left !== right) p.face = right ? 1 : -1;
            p.hangAimMode = "forward";
            p.aimX = p.face;
            p.aimY = 0;
          }
        } else {
          p.hangCombat = shootHeld;
          if (left !== right) p.face = right ? 1 : -1;
          p.hangAimMode = "forward";
          p.aimX = p.face;
          p.aimY = 0;
        }
      }
    }

    if (p.hanging) {
      p.invuln = Math.max(0, p.invuln - dt);
      p.fireCd = Math.max(0, p.fireCd - dt);
      p.dropTimer = Math.max(0, p.dropTimer - dt);
      p.muzzleFlashT = Math.max(0, p.muzzleFlashT - dt);
      p.visualFace = damp(typeof p.visualFace === "number" ? p.visualFace : p.face, p.face, FACE_LERP, dt);
      p.jumpLatch = jumpHeld;
      p.downLatch = downHeld;
      if (shootHeld && p.fireCd <= 0) spawnPlayerBullets();
      return;
    }

    if (p.climbing) {
      const climb = levelClimbables().find((c) => c.id === p.climbId) || climbTouch;
      if (!climb) {
        p.climbing = false;
        p.climbId = null;
      } else {
        const climbFacing = getClimbFacingSign(climb);
        const forwardHeld = climbFacing > 0 ? right : left;
        p.face = climbFacing;
        p.visualFace = climbFacing;

        if (jumpHeld && !p.jumpLatch) {
          const launchDir = left !== right ? (right ? 1 : -1) : climbFacing;
          p.climbing = false;
          p.climbId = null;
          p.vx = launchDir * 240;
          p.vy = -760;
          p.face = launchDir;
          p.supportType = null;
          playSfxEvent("playerJump", { volumeMul: 0.72, throttleMs: 90, duckAmount: 0.86, duckHold: 0.05, duckRelease: 8.8 });
        } else {
          const climbDirInput = (downHeld ? 1 : 0) - (upHeld ? 1 : 0);
          const lockClimbMotion = shootHeld;
          const climbDir = lockClimbMotion ? 0 : climbDirInput;
          p.climbMoving = Math.abs(climbDir) > 0.01;
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
          let canClimbShoot = false;
          if (shootHeld && upHeld && forwardHeld) {
            p.climbAimMode = "diag";
            p.aimX = climbFacing * 0.72;
            p.aimY = -0.72;
            canClimbShoot = true;
          } else if (shootHeld && upHeld) {
            p.climbAimMode = "up";
            p.aimX = 0;
            p.aimY = -1;
            canClimbShoot = true;
          } else if (shootHeld && downHeld && forwardHeld && climbFacing > 0) {
            p.climbAimMode = "downDiag";
            p.aimX = climbFacing * 0.72;
            p.aimY = 0.72;
            canClimbShoot = true;
          } else if (shootHeld && !downHeld) {
            p.climbAimMode = "forward";
            p.aimX = climbFacing;
            p.aimY = 0;
            canClimbShoot = true;
          } else {
            p.climbAimMode = "forward";
            p.aimX = climbFacing;
            p.aimY = 0;
          }
          p.climbCombat = canClimbShoot;
        }
      }
    }

    if (p.climbing) {
      p.invuln = Math.max(0, p.invuln - dt);
      p.fireCd = Math.max(0, p.fireCd - dt);
      p.dropTimer = Math.max(0, p.dropTimer - dt);
      p.muzzleFlashT = Math.max(0, p.muzzleFlashT - dt);
      p.visualFace = damp(typeof p.visualFace === "number" ? p.visualFace : p.face, p.face, FACE_LERP, dt);
      p.jumpLatch = jumpHeld;
      p.downLatch = downHeld;
      if (shootHeld && p.climbCombat && p.fireCd <= 0) spawnPlayerBullets();
      return;
    }

    if (p.onGround && !wantsDrop && downPressed) {
      if (p.prone) {
        p.prone = false;
        p.crouching = true;
      } else if (p.crouching) {
        p.prone = true;
        p.crouching = false;
      }
    }

    if (p.prone && p.onGround) {
      p.vx = 0;
      if (left !== right) desiredFace = right ? 1 : -1;
      if (upHeld) {
        p.prone = false;
        p.crouching = true;
      }
    } else if (aimLockHeld && p.onGround) {
      p.crouching = downHeld && !wantsDrop;
      p.vx = 0;
      if (left !== right) desiredFace = right ? 1 : -1;
    } else if (downHeld && p.onGround && !upHeld && !wantsDrop) {
      p.crouching = true;
      p.vx = 0;
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

    if (jumpHeld && !p.jumpLatch && p.onGround && !p.crouching && !p.prone && !wantsDrop) {
      p.vy = -860;
      p.onGround = false;
      p.supportType = null;
      p.airT = 0;
      playSfxEvent("playerJump", { volumeMul: 0.72, throttleMs: 90, duckAmount: 0.86, duckHold: 0.05, duckRelease: 8.8 });
    }
    p.jumpLatch = jumpHeld;
    if (!jumpHeld && p.vy < 0) p.vy *= 0.62;

    if (left !== right) p.face = desiredFace;
    if (aimLockHeld && p.onGround) {
      if (left !== right) p.face = desiredFace;
      if (p.prone) {
        p.aimX = p.face;
        p.aimY = 0;
      } else if (p.crouching) {
        if (upHeld) {
          if (left !== right) {
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
      } else if (upHeld) {
        if (left !== right) {
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
    } else if (upHeld) {
      if (left !== right) {
        p.face = desiredFace;
        p.aimX = p.face * 0.72;
        p.aimY = -0.72;
      } else {
        p.aimX = 0;
        p.aimY = -1;
      }
    } else if (downHeld && !p.onGround) {
      if (left !== right) {
        p.face = desiredFace;
        p.aimX = p.face * 0.72;
        p.aimY = 0.72;
      } else {
        p.aimX = 0;
        p.aimY = 1;
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
      p.prone = false;
      p.airT += dt;
    }
    p.y = nextYRect.y;
    if (!prevOnGround && p.onGround) p.airT = 0;

    p.invuln = Math.max(0, p.invuln - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.muzzleFlashT = Math.max(0, p.muzzleFlashT - dt);
    p.visualFace = damp(typeof p.visualFace === "number" ? p.visualFace : p.face, p.face, FACE_LERP, dt);
    if (Math.abs(p.visualFace) < 0.08) p.visualFace = p.face * 0.08;
    p.downLatch = downHeld;
    if (shootHeld && p.fireCd <= 0) spawnPlayerBullets();
  }

  function updateSpawns() {
    const front = state.cameraX + W + 160;
    while (state.pending.length && state.pending[0].x <= front) {
      spawnEnemy(state.pending.shift());
    }
  }

  function updateRespawns() {
    if (!state.respawnQueue.length) return;
    const remaining = [];
    for (const ticket of state.respawnQueue) {
      if (ticket.due > state.levelClock) {
        remaining.push(ticket);
        continue;
      }
      if (ticket.spawn?.t === "trooper" && state.enemies.some((enemy) => enemy.kind === "trooper" && enemy.spawnId && enemy.spawnId === ticket.id)) {
        continue;
      }
      spawnEnemy(ticket.spawn);
    }
    state.respawnQueue = remaining;
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dying) {
        e.deathT = (e.deathT || 0) + dt;
        e.vx = 0;
        e.attackT = 0;
        continue;
      }
      e.fireCd -= dt;
      if (typeof e.attackT === "number") e.attackT = Math.max(0, e.attackT - dt);
      if (typeof e.damageFlashT === "number") e.damageFlashT = Math.max(0, e.damageFlashT - dt);
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
    state.enemies = state.enemies.filter((e) => e.dying || (e.hp > 0 && (e.kind === "boss" || e.x > state.cameraX - 240)));
  }

  function updateBullets(dt) {
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
      for (const obstacle of levelObstacles()) {
        if (!circleRect({ x: b.x, y: b.y, r: b.r }, obstacle)) continue;
        if (obstacle.kind === "crate") {
          damageLevelObstacle(obstacle, b.dmg, "bullet");
        }
        b.ttl = 0;
        break;
      }
    }
    state.bullets = state.bullets.filter((b) => b.ttl > 0 && b.x > state.cameraX - 120 && b.x < state.cameraX + W + 220 && b.y > state.cameraY - 60 && b.y < state.cameraY + H + 60);

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
    state.enemyBullets = state.enemyBullets.filter((b) => b.ttl > 0 && b.x > state.cameraX - 120 && b.x < state.cameraX + W + 220 && b.y > state.cameraY - 50 && b.y < state.cameraY + H + 50);
  }

  function updateSmartBombs(dt) {
    if (!state.smartBombs.length) return;
    for (const bomb of state.smartBombs) {
      bomb.t += dt;
      bomb.pulseT += dt;
      const radius = getSmartBombRadius(bomb);
      const circle = { x: bomb.x, y: bomb.y, r: radius };
      const growDone = bomb.t >= (bomb.growDuration || SMART_BOMB_GROW_DURATION);

      for (const e of state.enemies) {
        if (e.hp <= 0 || e.dying) continue;
        if (!circleRect(circle, getEnemyCombatRect(e))) continue;
        destroyEnemyWithSmartBomb(e, bomb);
      }

      for (const o of state.objectives) {
        if (o.destroyed) continue;
        if (!circleRect(circle, o)) continue;
        destroyObjective(o, "smartBomb");
      }

      for (const bullet of state.enemyBullets) {
        if (bullet.ttl <= 0) continue;
        const dx = bullet.x - bomb.x;
        const dy = bullet.y - bomb.y;
        if (dx * dx + dy * dy > Math.pow(radius + bullet.r, 2)) continue;
        bullet.ttl = 0;
        boom(bullet.x, bullet.y, 12, "#fff3c4");
      }

      if (growDone && !bomb.flashed) {
        bomb.flashed = true;
        boom(bomb.x, bomb.y, 320, "#fffbe8");
        boom(bomb.x + rand(-44, 44), bomb.y + rand(-32, 32), 180, "#ffd289");
        boom(bomb.x + rand(-58, 58), bomb.y + rand(-42, 42), 132, "#ff9462");
      }

      if (!growDone && bomb.pulseT >= 0.11 && radius > 60) {
        bomb.pulseT = 0;
        const angle = rand(0, Math.PI * 2);
        boom(
          bomb.x + Math.cos(angle) * radius * rand(0.42, 0.9),
          bomb.y + Math.sin(angle) * radius * rand(0.42, 0.9),
          rand(14, 24),
          Math.random() < 0.5 ? "#fff7da" : "#ffca7f",
        );
      }
    }
    state.enemyBullets = state.enemyBullets.filter((b) => b.ttl > 0);
    state.enemies = state.enemies.filter((e) => e.dying || e.hp > 0);
    state.smartBombs = state.smartBombs.filter((bomb) => bomb.t < bomb.duration);
  }

  function resolveCombat() {
    const p = state.player;
    const playerCombatRect = getPlayerCombatRect(p);

    for (const b of state.bullets) {
      for (const e of state.enemies) {
        if (e.hp <= 0 || e.dying) continue;
        if (!circleRect({ x: b.x, y: b.y, r: b.r }, getEnemyCombatRect(e))) continue;
        if (e.kind === "trooper") {
          spawnBloodBurst(b.x, b.y, b.vx, b.vy, e.hp - b.dmg <= 0 ? 6 : 4, 145, 0.95);
        }
        flashEnemyDamage(e, 0.24);
        e.hp -= b.dmg;
        b.pierce -= 1;
        if (e.hp <= 0) {
          if (e.kind === "boss") {
            startBossDeathSequence(e);
          } else {
            state.score += e.kind === "mech" ? 320 : 120;
            state.combo += 1;
            state.comboTimer = 2.2;
            boom(e.x + e.w * 0.5, e.y + e.h * 0.5, e.kind === "mech" ? 32 : 20, "#ffd37d");
            if (e.kind === "trooper") {
              spawnTrooperCorpse(e, b);
              scheduleTrooperRespawn(e);
            }
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
        flashObjectiveDamage(o, b.weapon === o.weak ? 0.32 : 0.22);
        o.hp -= b.dmg * (b.weapon === o.weak ? 1.65 : 1);
        b.pierce -= 1;
        if (o.hp <= 0) {
          destroyObjective(o, "bullet");
        }
        if (b.pierce <= 0) {
          b.ttl = 0;
          break;
        }
      }
    }

    state.enemies = state.enemies.filter((e) => e.dying || e.hp > 0);

    for (const b of state.enemyBullets) {
      if (p.invuln > 0) continue;
      if (!circleRect({ x: b.x, y: b.y, r: b.r }, playerCombatRect)) continue;
      if (absorbPlayerHit("#97f7ff", 16)) {
        b.ttl = 0;
        continue;
      }
      p.hp -= b.dmg;
      p.invuln = 0.9;
      b.ttl = 0;
      playSfxEvent("playerHit", { volumeMul: 0.8, throttleMs: 140, duckAmount: 0.58, duckHold: 0.14, duckRelease: 5.6 });
      spawnBloodBurst(b.x, b.y, b.vx, b.vy, 7, 180, 1.1);
      boom(b.x, b.y, 12, "#ff8f94");
    }

    for (const e of state.enemies) {
      if (e.dying) continue;
      if (p.invuln > 0) continue;
      if (!rectHit(getEnemyCombatRect(e), playerCombatRect)) continue;
      if (absorbPlayerHit(e.kind === "boss" ? "#c7fbff" : e.kind === "mech" ? "#a7f4ff" : "#8ef7ff", e.kind === "boss" ? 22 : 18)) {
        continue;
      }
      p.hp -= e.kind === "boss" ? 24 : e.kind === "mech" ? 20 : 10;
      p.invuln = 0.9;
      playSfxEvent("playerHit", { volumeMul: 0.8, throttleMs: 140, duckAmount: 0.58, duckHold: 0.14, duckRelease: 5.6 });
      p.vx = e.x > p.x ? -250 : 250;
      p.vy = -280;
      spawnBloodBurst(p.x + p.w * 0.5, p.y + p.h * 0.42, e.x - p.x, -0.3, 9, 210, 1.25);
      boom(p.x + p.w * 0.5, p.y + p.h * 0.5, 14, "#ffced1");
    }
    if (p.hp <= 0) startPlayerDeathSequence();
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
      } else if (c.type === "bomb") {
        if (grantSmartBombs(c.amount || 1) <= 0) return true;
      } else if (c.type === "shield") {
        if (grantShield(c.amount || SHIELD_HITS_PER_PICKUP) <= 0) return true;
      } else {
        p.hp = clamp(p.hp + 46, 0, p.maxHp);
        playSfxEvent("pickupMed", { volumeMul: 0.86, throttleMs: 120, duckAmount: 0.82, duckHold: 0.08, duckRelease: 7.2 });
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
      if (absorbPlayerHit(hazard.kind === "acid" ? "#72ffd3" : "#b7f7ff", hazard.kind === "acid" ? 20 : 18)) continue;
      p.hp -= hazard.dmg || 18;
      p.invuln = 0.8;
      playSfxEvent("playerHit", { volumeMul: 0.76, throttleMs: 140, duckAmount: 0.58, duckHold: 0.14, duckRelease: 5.6 });
      p.vy = -280;
      p.vx = p.x + p.w * 0.5 < hazard.x + hazard.w * 0.5 ? -220 : 220;
      boom(p.x + p.w * 0.5, p.y + p.h * 0.55, 18, hazard.kind === "acid" ? "#67ffd4" : "#ffb56c");
    }
    if (p.hp <= 0) startPlayerDeathSequence();
  }

  function updateExplosions(dt) {
    for (const e of state.explosions) e.t += dt;
    state.explosions = state.explosions.filter((e) => e.t < e.ttl);
  }

  function updateBossDeathSequence(dt) {
    const seq = state.bossDeath;
    if (!seq) return;
    const boss = getDyingBoss();
    if (!boss && !seq.detonated) {
      state.bossDeath = null;
      finishLevel();
      return;
    }
    seq.t += dt;
    seq.flashT = Math.max(0, (seq.flashT || 0) - dt);
    if (!seq.detonated && boss) {
      const progress = clamp(seq.t / BOSS_DEATH_DURATION, 0, 1);
      const burstInterval = lerp(0.34, 0.06, progress);
      seq.burstTimer -= dt;
      while (seq.burstTimer <= 0) {
        spawnBossDeathBurst(boss, seq, progress);
        if (progress > 0.48) spawnBossDeathBurst(boss, seq, Math.min(1, progress + 0.12));
        if (progress > 0.82) {
          const pulseSize = lerp(56, 104, progress);
          boom(boss.x + boss.w * 0.5 + rand(-18, 18), boss.y + boss.h * 0.48 + rand(-22, 22), pulseSize, "#fff0b2");
        }
        seq.burstTimer += burstInterval;
      }
      if (Math.floor(seq.t * 4) !== Math.floor((seq.t - dt) * 4)) {
        boss.x = clamp(boss.x + rand(-2.4, 2.4), boss.arenaStart + 8, boss.arenaEnd - boss.w - 8);
        boss.y = terrainY(boss.x + boss.w * 0.5) - boss.h;
      }
      if (seq.t >= BOSS_DEATH_DURATION) {
        seq.detonated = true;
        seq.flashT = Math.max(seq.flashT || 0, 1.35);
        boom(boss.x + boss.w * 0.5, boss.y + boss.h * 0.46, 220, "#fff8d2");
        boom(boss.x + boss.w * 0.42, boss.y + boss.h * 0.58, 160, "#ffb061");
        boom(boss.x + boss.w * 0.56, boss.y + boss.h * 0.32, 144, "#ff7146");
        state.enemies = state.enemies.filter((e) => e !== boss);
      }
    }
    if (seq.t >= seq.duration) {
      state.bossDeath = null;
      finishLevel();
    }
  }

  function updateAftermath(dt) {
    const getCorpseSupport = (corpse) => {
      let bestY = supportYForBody(corpse);
      let supportCorpse = null;
      const left = corpse.x + 4;
      const right = corpse.x + corpse.w - 4;
      for (const other of state.corpses) {
        if (other === corpse || !other.landed) continue;
        if (!overlap1D(left, right, other.x + 6, other.x + other.w - 6, 0)) continue;
        const candidateY = other.y - corpse.h + CORPSE_STACK_OVERLAP;
        if (candidateY < bestY) {
          bestY = candidateY;
          supportCorpse = other;
        }
      }
      return { y: bestY, supportCorpse };
    };
    for (const corpse of state.corpses) {
      corpse.t += dt;
      if (!corpse.landed) {
        corpse.vy += BLOOD_GRAVITY * dt;
        corpse.x += corpse.vx * dt;
        corpse.y += corpse.vy * dt;
        corpse.rot += corpse.vr * dt;
        corpse.vx *= Math.exp(-2.4 * dt);
        corpse.vr *= Math.exp(-2.2 * dt);
        const support = getCorpseSupport(corpse);
        if (corpse.y >= support.y) {
          corpse.y = support.y;
          corpse.vx *= 0.14;
          corpse.vy = 0;
          corpse.vr = 0;
          corpse.rot *= 0.18;
          corpse.landed = true;
          corpse.supportCorpseId = support.supportCorpse ? support.supportCorpse.id : null;
          if (support.supportCorpse) {
            const stackNudge = (corpse.flip ? -4 : 4) + clamp(corpse.vx * 0.18, -6, 6);
            corpse.x = clamp(corpse.x + stackNudge, support.supportCorpse.x - 12, support.supportCorpse.x + 12);
          }
        }
      }
      corpse.poolT = Math.min(corpse.poolTarget, corpse.poolT + dt * 0.52);
    }

    for (const particle of state.bloodParticles) {
      particle.t += dt;
      particle.vy += BLOOD_GRAVITY * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (!particle.stuck) {
        const supportY = supportYForBody({ x: particle.x - particle.r, y: particle.y - particle.r, w: particle.r * 2, h: particle.r * 2 }, true);
        const floorY = supportY + particle.r;
        if (particle.y >= floorY) {
          particle.y = floorY;
          particle.vx *= 0.4;
          particle.vy *= -0.16;
          if (Math.abs(particle.vy) < 28) {
            particle.stuck = true;
            particle.vx = 0;
            particle.vy = 0;
          }
        }
      }
    }

    state.bloodParticles = state.bloodParticles.filter((particle) => particle.t < particle.ttl);
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
    const checkpoints = levelCheckpoints();
    const nextCheckpoint = checkpoints[getActiveCheckpointIndex() + 1] || checkpoints[0] || null;
    if (nextCheckpoint) {
      const playerCenterX = state.player.x + state.player.w * 0.5;
      const nearHeight = state.player.y >= nextCheckpoint.y - 220 && state.player.y <= nextCheckpoint.y + 180;
      if (playerCenterX >= nextCheckpoint.x - 6 && nearHeight) {
        activateCheckpoint(nextCheckpoint);
      }
    }
    const maxCamera = Math.max(0, state.level.length - W);
    const minCameraY = levelTop();
    const maxCameraY = Math.max(minCameraY, levelHeight() - H);
    const targetLead = state.player.face > 0 ? 180 : 120;
    state.cameraLead = damp(typeof state.cameraLead === "number" ? state.cameraLead : targetLead, targetLead, CAMERA_LEAD_LERP, dt);
    let targetCameraX = clamp(state.player.x - W * 0.35 + state.cameraLead, 0, maxCamera);
    let targetCameraY = clamp(state.player.y - H * 0.54, minCameraY, maxCameraY);
    if (boss && state.bossActive) {
      targetCameraX = clamp(Math.max(targetCameraX, boss.arenaStart - 120), 0, maxCamera);
      state.player.x = clamp(state.player.x, boss.arenaStart + 18, state.level.length - state.player.w - 18);
    }
    state.cameraX = clamp(damp(state.cameraX, targetCameraX, CAMERA_LERP, dt), 0, maxCamera);
    state.cameraY = clamp(damp(state.cameraY, targetCameraY, CAMERA_LERP, dt), minCameraY, maxCameraY);
    if (state.player.x > targetCameraX + W - 130) state.player.x = targetCameraX + W - 130;
  }

  function step(dt) {
    state.levelClock += dt;
    updateAudio(dt);
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
        playStageMusic(state.levelIndex, true);
      }
      return;
    }
    if (state.mode === "bossDeath") {
      updateDamageFlashes(dt);
      updateExplosions(dt);
      updateAftermath(dt);
      updateObjectiveDeathSequences(dt);
      updateBossDeathSequence(dt);
      return;
    }
    if (state.mode === "playerDeath") {
      updateDamageFlashes(dt);
      updateExplosions(dt);
      updateAftermath(dt);
      updateObjectiveDeathSequences(dt);
      updatePlayerDeathSequence(dt);
      return;
    }
    if (state.mode === "transition") {
      state.transitionT -= dt;
      if (state.transitionT <= 0) {
        clearSay();
        resetLevel(state.levelIndex + 1, true);
        state.mode = "playing";
        playStageMusic(state.levelIndex, true);
      }
      return;
    }
    if (state.mode !== "playing") return;
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) state.combo = 0;

    updateDamageFlashes(dt);
    updateSpawns();
    updateRespawns();
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateSmartBombs(dt);
    resolveCombat();
    if (state.mode === "bossDeath") {
      updateAftermath(dt);
      updateExplosions(dt);
      return;
    }
    if (state.mode === "playerDeath") {
      updateAftermath(dt);
      updateExplosions(dt);
      updateObjectiveDeathSequences(dt);
      return;
    }
    updateAftermath(dt);
    updatePickups(dt);
    updateHazards();
    if (state.mode === "playerDeath") {
      updateExplosions(dt);
      updateObjectiveDeathSequences(dt);
      return;
    }
    updateExplosions(dt);
    updateObjectiveDeathSequences(dt);
    updateFlow(dt);
  }

  function getSpriteDrawMetrics(key, x, y, w, h) {
    const hdKey = `${key}_hd`;
    const resolvedKey = sprites.has(hdKey) ? hdKey : (sprites.has(key) ? key : null);
    const px = Math.round(x);
    const py = Math.round(y);
    const pw = Math.max(1, Math.round(w));
    const ph = Math.max(1, Math.round(h));
    if (!resolvedKey) {
      return { resolvedKey: null, px, py, pw, ph, drawX: 0, drawY: 0, drawW: pw, drawH: ph, x: px, y: py, w: pw, h: ph };
    }
    const img = sprites.get(resolvedKey);
    const measuredBounds = spriteBounds.get(resolvedKey) || { sx: 0, sy: 0, sw: img.width || 1, sh: img.height || 1 };
    const useFullFrame = /^player_/.test(key) || /^enemy_trooper/.test(key);
    if (useFullFrame && img) {
      return {
        resolvedKey,
        px,
        py,
        pw,
        ph,
        drawX: 0,
        drawY: 0,
        drawW: pw,
        drawH: ph,
        x: px,
        y: py,
        w: pw,
        h: ph,
        img,
        bounds: { sx: 0, sy: 0, sw: img.width || 1, sh: img.height || 1 },
      };
    }
    const bounds = measuredBounds;
    const preserveAspect = /^(player_|enemy_|prop_)/.test(key);
    const srcAspect = Math.max(0.01, bounds.sw / Math.max(1, bounds.sh));
    const dstAspect = Math.max(0.01, pw / Math.max(1, ph));
    let drawX = 0;
    let drawY = 0;
    let drawW = pw;
    let drawH = ph;
    if (preserveAspect) {
      if (srcAspect > dstAspect) {
        drawW = pw;
        drawH = Math.max(1, Math.round(drawW / srcAspect));
        drawY = ph - drawH;
      } else {
        drawH = ph;
        drawW = Math.max(1, Math.round(drawH * srcAspect));
        drawX = Math.round((pw - drawW) * 0.5);
      }
    }
    return { resolvedKey, px, py, pw, ph, drawX, drawY, drawW, drawH, x: px + drawX, y: py + drawY, w: drawW, h: drawH, img, bounds };
  }

  function drawSprite(key, x, y, w, h, flip, fallback) {
    const metrics = getSpriteDrawMetrics(key, x, y, w, h);
    if (!metrics.resolvedKey) {
      fallback();
      return;
    }
    const { resolvedKey, img, bounds, px, py, pw, drawX, drawY, drawW, drawH } = metrics;
    const preserveAspect = /^(player_|enemy_|prop_)/.test(key);
    const scaleX = typeof flip === "number" ? flip : (flip ? -1 : 1);
    const facingSign = scaleX < 0 ? -1 : 1;
    const blendT = clamp((scaleX + 1) * 0.5, 0, 1);
    const useTurnBlend = preserveAspect && blendT > 0.02 && blendT < 0.98 && Math.abs(scaleX) < 0.995;
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = "low";
    const drawResolvedSprite = (mirror, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (mirror) {
        ctx.translate(px + pw, py);
        ctx.scale(-1, 1);
        ctx.drawImage(img, bounds.sx, bounds.sy, bounds.sw, bounds.sh, drawX, drawY, drawW, drawH);
      } else {
        ctx.drawImage(img, bounds.sx, bounds.sy, bounds.sw, bounds.sh, px + drawX, py + drawY, drawW, drawH);
      }
      ctx.restore();
    };
    if (useTurnBlend) {
      drawResolvedSprite(true, 1 - blendT);
      drawResolvedSprite(false, blendT);
    } else {
      drawResolvedSprite(facingSign < 0);
    }
    ctx.imageSmoothingEnabled = prevSmooth;
  }

  function drawBackdropLayer(imageKeys, options = {}) {
    const keys = Array.isArray(imageKeys) ? imageKeys : [imageKeys];
    const images = keys.map((key) => environmentImages.get(key)).filter(Boolean);
    if (!images.length) return false;
    const factorX = options.factorX ?? 0.18;
    const factorY = options.factorY ?? 0.08;
    const y = options.y ?? 0;
    const height = options.height ?? H;
    const alpha = options.alpha ?? 1;
    const spacing = options.spacing ?? 0.78;
    const scale = options.scale ?? 1;
    const composite = options.composite || "source-over";
    const camY = state.cameraY || 0;
    const span = W * spacing;
    const offset = -((state.cameraX * factorX) % span) - span;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = composite;
    for (let index = 0, x = offset; x < W + span * 2; index++, x += span) {
      const img = images[index % images.length];
      const targetH = height * scale;
      const coverScale = Math.max((span * 1.18) / img.width, targetH / img.height);
      const drawW = Math.round(img.width * coverScale);
      const drawH = Math.round(img.height * coverScale);
      const dx = Math.round(x + (span - drawW) * 0.5);
      const dy = Math.round(y - camY * factorY + (height - drawH) * 0.5);
      ctx.drawImage(img, dx, dy, drawW, drawH);
    }
    ctx.restore();
    return true;
  }

  function drawEnvironmentCrop(tileKey, dx, dy, dw, dh, alpha = 1, tileSetOverride = null) {
    const tileSet = getEnvironmentTileSet(tileSetOverride);
    const crop = tileSet[tileKey];
    if (!crop) return false;
    const img = environmentImages.get(crop.art);
    if (!img) return false;
    const mode = crop.mode || "stretch";
    ctx.save();
    ctx.globalAlpha = alpha;
    if (mode === "stretch") {
      ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, dx, dy, dw, dh);
      ctx.restore();
      return true;
    }
    const repeatX = mode.includes("x");
    const repeatY = mode.includes("y");
    let scale = crop.scale ?? 1;
    if (crop.scale == null) {
      if (crop.fit === "height") {
        scale = dh / crop.sh;
      } else if (crop.fit === "width") {
        scale = dw / crop.sw;
      } else if (crop.fit === "min") {
        scale = Math.min(dw / crop.sw, dh / crop.sh);
      } else if (crop.fit === "max") {
        scale = Math.max(dw / crop.sw, dh / crop.sh);
      }
    }
    const tileW = Math.max(1, Math.round(crop.sw * scale));
    const tileH = Math.max(1, Math.round(crop.sh * scale));
    const startX = repeatX ? dx : dx + Math.max(0, Math.round((dw - tileW) * 0.5));
    const startY = repeatY ? dy : dy + Math.max(0, Math.round((dh - tileH) * 0.5));
    const endX = repeatX ? dx + dw : startX + 1;
    const endY = repeatY ? dy + dh : startY + 1;
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();
    for (let yy = startY; yy < endY; yy += tileH) {
      for (let xx = startX; xx < endX; xx += tileW) {
        const drawW = repeatX ? Math.min(tileW, dx + dw - xx) : Math.min(tileW, dw);
        const drawH = repeatY ? Math.min(tileH, dy + dh - yy) : Math.min(tileH, dh);
        const srcW = Math.max(1, Math.round(crop.sw * (drawW / tileW)));
        const srcH = Math.max(1, Math.round(crop.sh * (drawH / tileH)));
        ctx.drawImage(img, crop.sx, crop.sy, srcW, srcH, xx, yy, drawW, drawH);
      }
    }
    ctx.restore();
    return true;
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

  function drawMuzzleBloom(x, y, aimX, aimY, radius = 18, palette = null, intensity = 1) {
    const glow = palette?.glow || "#ffe08c";
    const hot = palette?.hot || "#fff6db";
    const ember = palette?.ember || "#ff9c44";
    drawGlowCircle(x, y, radius * 1.7, glow, 0.18 * intensity);
    drawGlowCircle(x + aimX * radius * 0.15, y + aimY * radius * 0.15, radius, hot, 0.26 * intensity);
    drawGlowCircle(x - aimX * radius * 0.12, y - aimY * radius * 0.12, radius * 0.66, ember, 0.2 * intensity);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.82 * intensity;
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2.2, radius * 0.18), 0, Math.PI * 2);
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

  function traceTerrainPath(camY = 0) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    const start = Math.floor(state.cameraX / 28) * 28 - 28;
    for (let x = start; x <= state.cameraX + W + 28; x += 28) {
      ctx.lineTo(x - state.cameraX, terrainY(x) - camY);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
  }

  function drawTerrainTiles(tileSetOverride = null, camY = 0) {
    const tileSet = getEnvironmentTileSet(tileSetOverride);
    if (!tileSet.terrainFill && !tileSet.terrainTop) return;

    ctx.save();
    traceTerrainPath(camY);
    ctx.clip();
    if (tileSet.terrainFill) {
      const crop = tileSet.terrainFill;
      const img = environmentImages.get(crop.art);
      if (img) {
        const scale = crop.scale ?? 1;
        const tw = Math.max(1, Math.round(crop.sw * scale));
        const th = Math.max(1, Math.round(crop.sh * scale));
        const startWX = Math.floor(state.cameraX / tw) * tw - tw;
        const startWY = Math.floor(camY / th) * th - th;
        for (let wx = startWX; wx <= state.cameraX + W + tw; wx += tw) {
          for (let wy = startWY; wy <= camY + H + th; wy += th) {
            ctx.drawImage(
              img,
              crop.sx, crop.sy, crop.sw, crop.sh,
              Math.round(wx - state.cameraX),
              Math.round(wy - camY),
              tw,
              th,
            );
          }
        }
      }
    }
    if (tileSet.terrainTop) {
      const step = Math.max(36, tileSet.terrainTop.sw - 8);
      for (let wx = Math.floor(state.cameraX / step) * step - step; wx <= state.cameraX + W + step; wx += step) {
        const screenX = wx - state.cameraX;
        const screenY = terrainY(wx + step * 0.5) - camY - 18;
        drawEnvironmentCrop("terrainTop", screenX, screenY, tileSet.terrainTop.sw, tileSet.terrainTop.sh, 1, tileSetOverride);
      }
    }
    ctx.restore();
  }

  function drawSurfaceBackground(p) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, p.sky1); g.addColorStop(0.5, p.sky2); g.addColorStop(1, p.sky3);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawBackdropLayer("industrialZone", {
      factorX: 0.14,
      factorY: 0.02,
      y: 70,
      height: 276,
      alpha: 0.22,
      spacing: 0.9,
      scale: 1.16,
    });

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

    traceTerrainPath(0);
    const gg = ctx.createLinearGradient(0, 360, 0, H);
    gg.addColorStop(0, p.g1); gg.addColorStop(1, p.g2);
    ctx.fillStyle = gg;
    ctx.fill();
    drawTerrainTiles(p.structureTiles);

    ctx.fillStyle = "rgba(137, 176, 210, 0.1)";
    for (let i = -1; i < 9; i++) {
      const x = i * 140 - (state.cameraX * 0.35 % 140);
      ctx.fillRect(x + 24, 436, 58, 5);
    }
  }

  function drawCaveBackground(p) {
    const preset = CAVE_RENDER_PRESETS[p.caveVariant || "crystal"] || CAVE_RENDER_PRESETS.crystal;
    const camY = state.cameraY || 0;
    const sy = (y, factor = 1) => y - camY * factor;
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
    ctx.fillStyle = preset.topVeil || "rgba(14, 20, 32, 0.18)";
    ctx.fillRect(0, 0, W, 168);

    drawBackdropLayer(preset.crystalBackdrop || ["caveCrystal", "caveEmerald"], {
      factorX: 0.08,
      factorY: 0.06,
      y: preset.crystalY,
      height: preset.crystalHeight,
      alpha: preset.crystalAlpha,
      spacing: 0.86,
      scale: preset.crystalScale,
    });
    drawBackdropLayer(preset.glowBackdrop || ["caveEmerald"], {
      factorX: 0.16,
      factorY: 0.11,
      y: preset.glowY,
      height: preset.glowHeight,
      alpha: preset.glowAlpha,
      spacing: 0.98,
      scale: 1.12,
      composite: "screen",
    });
    drawBackdropLayer(preset.industrialBackdrop || ["industrialZone"], {
      factorX: 0.21,
      factorY: 0.14,
      y: preset.industrialY,
      height: preset.industrialHeight,
      alpha: preset.industrialAlpha,
      spacing: 0.88,
      scale: 1.2,
    });

    ctx.fillStyle = preset.atmosphericWash;
    ctx.fillRect(0, sy(preset.atmosphericBandY, 0.18), W, preset.atmosphericBandH);

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
      ctx.moveTo(x, sy(384, 0.18));
      ctx.lineTo(x + 58, sy(384 - rise, 0.18));
      ctx.lineTo(x + 145, sy(384 - rise * 0.62, 0.18));
      ctx.lineTo(x + 250, sy(384, 0.18));
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = p.glow;
    for (let i = -1; i < 8; i++) {
      const x = i * 210 - (glowShift % 210) + 105;
      const y = sy(230 + Math.sin(i * 1.9) * 22, 0.24);
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
      ctx.moveTo(x, sy(438, 0.36));
      ctx.lineTo(x + 48, sy(438 - ridge, 0.36));
      ctx.lineTo(x + 100, sy(438 - ridge * 0.56, 0.36));
      ctx.lineTo(x + 165, sy(438, 0.36));
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = p.roof1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = -40; x <= W + 40; x += 40) {
      const wx = x + state.cameraX * 0.24;
      const y = sy(66 + Math.sin(wx * 0.011) * 15 + Math.sin(wx * 0.027) * 10, 0.12);
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
      const y = sy(112 + Math.sin(wx * 0.014) * 21 + Math.sin(wx * 0.037) * 13, 0.18);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();

    for (let i = -2; i < 11; i++) {
      const x = i * 170 - (supportShift % 170);
      ctx.fillStyle = p.support;
      ctx.fillRect(x + 72, sy(160, 0.52), 26, 250);
      ctx.fillRect(x + 54, sy(156, 0.52), 62, 14);
      ctx.beginPath();
      ctx.moveTo(x + 54, sy(170, 0.52));
      ctx.lineTo(x + 38, sy(222, 0.52));
      ctx.lineTo(x + 50, sy(222, 0.52));
      ctx.lineTo(x + 64, sy(170, 0.52));
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 116, sy(170, 0.52));
      ctx.lineTo(x + 132, sy(222, 0.52));
      ctx.lineTo(x + 120, sy(222, 0.52));
      ctx.lineTo(x + 106, sy(170, 0.52));
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = p.cable;
    ctx.lineWidth = 2;
    for (let i = -1; i < 7; i++) {
      const sx = i * 220 - (cableShift % 220);
      const ex = sx + 220;
      ctx.beginPath();
      ctx.moveTo(sx, sy(142, 0.46));
      ctx.quadraticCurveTo(sx + 110, sy(165, 0.46), ex, sy(142, 0.46));
      ctx.stroke();

      const lx = sx + 110;
      const ly = sy(162, 0.46);
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

    traceTerrainPath(camY);
    const gg = ctx.createLinearGradient(0, sy(360), 0, H);
    gg.addColorStop(0, p.g1);
    gg.addColorStop(1, p.g2);
    ctx.fillStyle = gg;
    ctx.fill();
    drawTerrainTiles(p.structureTiles, camY);

    ctx.fillStyle = "rgba(140, 182, 211, 0.09)";
    for (let i = -1; i < 8; i++) {
      const x = i * 140 - (supportShift % 140);
      ctx.fillRect(x + 18, sy(446), 56, 5);
    }

    ctx.fillStyle = preset.dustColor || "rgba(143, 188, 220, 0.18)";
    for (let i = 0; i < 26; i++) {
      const wx = Math.floor(state.cameraX / 120) * 120 + i * 120 - 220;
      const x = wx - state.cameraX + Math.sin((wx + state.levelClock * 64) * 0.014) * 9;
      const y = sy(128 + (Math.sin(wx * 0.016 + state.levelClock * 0.72) + 1) * 130, 0.26);
      const r = 0.8 + (i % 3) * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = preset.nearFog || "rgba(84, 118, 145, 0.09)";
    ctx.fillRect(0, sy(296, 0.44), W, 162);
    ctx.fillStyle = preset.floorGlow;
    ctx.fillRect(0, sy(414, 0.86), W, 78);
    ctx.fillStyle = preset.bottomShade || "rgba(12, 20, 30, 0.26)";
    ctx.fillRect(0, sy(424, 0.9), W, H - sy(424, 0.9));
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

  function drawSceneryChunk(chunk) {
    const x = chunk.x - state.cameraX;
    if (x < -chunk.w - 80 || x > W + 80) return;
    const y = chunk.y;
    const tileSet = getEnvironmentTileSet(chunk.tileSetOverride ?? null);
    const alpha = chunk.solid === false ? (chunk.alpha ?? 0.28) : Math.max(chunk.alpha ?? 0.28, 0.97);
    const colW = chunk.colW ?? Math.max(24, Math.min(38, Math.round(chunk.w * 0.12)));
    const capH = chunk.capH ?? 18;
    const lipH = chunk.lipH ?? 14;
    const fill = setColorAlpha(chunk.fill || "rgba(14, 22, 30, 0.34)", chunk.solid === false ? 0.34 : 0.96);
    const line = setColorAlpha(chunk.line || "rgba(179, 214, 237, 0.16)", chunk.solid === false ? 0.16 : 0.42);
    const glow = chunk.glow || "#8be8ff";
    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, chunk.w, chunk.h);
    drawEnvironmentCrop("wallFace", x, y, chunk.w, chunk.h, alpha);
    if (chunk.top !== false) {
      drawEnvironmentCrop("platformTop", x, y - 3, chunk.w, capH, Math.min(1, alpha + 0.1));
    }
    if (chunk.bottom !== false) {
      drawEnvironmentCrop("platformBeam", x, y + chunk.h - lipH, chunk.w, lipH + 4, Math.min(1, alpha + 0.04));
    }
    if (chunk.columns !== false) {
      const columnKey = tileSet.columnFace ? "columnFace" : "supportFace";
      drawEnvironmentCrop(columnKey, x, y, colW, chunk.h, Math.min(1, alpha + 0.08), chunk.tileSetOverride ?? null);
      drawEnvironmentCrop(columnKey, x + chunk.w - colW, y, colW, chunk.h, Math.min(1, alpha + 0.08), chunk.tileSetOverride ?? null);
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    const ribSpacing = chunk.ribSpacing ?? 42;
    for (let yy = y + 24; yy < y + chunk.h - 18; yy += ribSpacing) {
      ctx.beginPath();
      ctx.moveTo(x + colW + 8, yy);
      ctx.lineTo(x + chunk.w - colW - 8, yy);
      ctx.stroke();
    }
    const lightCount = chunk.lights ?? Math.max(2, Math.min(5, Math.round(chunk.w / 220)));
    if (lightCount > 0) {
      for (let i = 0; i < lightCount; i++) {
        const lx = x + ((i + 1) / (lightCount + 1)) * chunk.w;
        const ly = y + (chunk.lightY ?? 26);
        drawGlowCircle(lx, ly + 4, 28, glow, 0.08);
        ctx.fillStyle = glow;
        ctx.fillRect(lx - 3, ly - 2, 6, 10);
      }
    }
    if (chunk.kind === "shaft") {
      ctx.fillStyle = setColorAlpha("rgba(12, 18, 27, 0.22)", chunk.solid === false ? 0.22 : 0.88);
      const innerW = chunk.innerW ?? Math.max(110, Math.round(chunk.w * 0.22));
      ctx.fillRect(x + (chunk.w - innerW) * 0.5, y + 12, innerW, chunk.h - 24);
    }
    if (chunk.kind === "alcove") {
      ctx.fillStyle = setColorAlpha("rgba(12, 18, 27, 0.2)", chunk.solid === false ? 0.2 : 0.84);
      ctx.fillRect(x + 22, y + chunk.h * 0.38, chunk.w - 44, Math.max(18, chunk.h * 0.2));
    }
    if (chunk.coreGlow) {
      drawGlowCircle(
        x + chunk.w * 0.5,
        y + chunk.h * (chunk.coreGlowY ?? 0.5),
        chunk.coreGlowRadius ?? Math.min(chunk.w, chunk.h) * 0.24,
        chunk.coreGlow,
        chunk.coreGlowAlpha ?? 0.08,
      );
    }
    ctx.restore();
  }

  function drawDetailProps() {
    for (const prop of levelDetailProps()) {
      const def = DETAIL_PROP_DEFS[prop.kind];
      if (!def) continue;
      const w = prop.w || def.w;
      const h = prop.h || def.h;
      const x = prop.x - state.cameraX - w * 0.5 + (prop.dx || 0);
      const snappedGroundY = prop.snapToGround === false
        ? prop.y
        : terrainY(prop.x) + (prop.terrainLift || 0);
      const groundY = snappedGroundY + (prop.floorOffset ?? def.floorOffset ?? 0);
      const y = groundY - h + (prop.dy || 0);
      if (x < -w - 40 || x > W + 40) continue;
      drawShadowBlob(x + w * 0.5, groundY + 4, Math.max(16, w * 0.34), Math.max(6, h * 0.08), prop.shadow ?? def.shadow ?? 0.2);
      if (def.glow) {
        drawGlowCircle(x + w * 0.5, y + h * (def.glowY ?? 0.5), def.glowRadius ?? Math.max(w, h) * 0.28, def.glow, prop.glowAlpha ?? def.glowAlpha ?? 0.08);
      }
      ctx.save();
      ctx.globalAlpha = prop.alpha ?? 0.96;
      drawAnimSprite(def.baseKey, def.frames, def.fps, (prop.phase ?? 0) + prop.x * 0.0027, x, y, w, h, false, () => {
        ctx.fillStyle = "rgba(90, 109, 128, 0.7)";
        ctx.fillRect(x, y, w, h);
      });
      ctx.restore();
    }
  }

  function drawTraversal() {
    const p = state.level.palette;
    const steel = p.theme === "cave" ? "#6e8298" : "#7c90a4";
    const steelDark = p.theme === "cave" ? "#2c3947" : "#304152";

    for (const chunk of levelScenery()) {
      drawSceneryChunk(chunk);
    }

    drawDetailProps();

    for (const climb of levelClimbables()) {
      const x = climb.x - state.cameraX;
      if (x < -60 || x > W + 40) continue;
      ctx.fillStyle = "rgba(18, 24, 34, 0.9)";
      ctx.fillRect(x - 4, climb.y, climb.w + 8, climb.h);
      ctx.fillStyle = steelDark;
      ctx.fillRect(x, climb.y, 5, climb.h);
      ctx.fillRect(x + climb.w - 5, climb.y, 5, climb.h);
      ctx.fillStyle = steel;
      for (let y = climb.y + 10; y < climb.y + climb.h; y += 14) {
        ctx.fillRect(x + 5, y, climb.w - 10, 3);
      }
      drawGlowCircle(x + climb.w * 0.5, climb.y + 8, 18, "#8be8ff", 0.08);
      drawEnvironmentCrop("supportFace", x, climb.y, climb.w, climb.h, 1, "industrial");
    }

    for (const platform of levelPlatforms()) {
      const x = platform.x - state.cameraX;
      if (x < -platform.w - 30 || x > W + 30) continue;
      drawShadowBlob(x + platform.w * 0.5, platform.y + 6, platform.w * 0.42, 10, 0.18);
      drawEnvironmentCrop("platformTop", x, platform.y - 8, platform.w, 24, 1);
      drawEnvironmentCrop("platformBeam", x, platform.y + 6, platform.w, platform.h + 28, 1);
    }

    for (const hang of levelHangables()) {
      const x = hang.x - state.cameraX;
      if (x < -hang.w - 40 || x > W + 40) continue;
      const y = hang.y;
      const h = Math.max(8, hang.h + 4);
      drawShadowBlob(x + hang.w * 0.5, y + h * 0.7, hang.w * 0.28, 4, 0.12);
      ctx.save();
      drawEnvironmentCrop("hangBar", x, y, hang.w, h, 1);
      ctx.fillStyle = "rgba(255, 231, 124, 0.18)";
      ctx.fillRect(x + 2, y + 1, Math.max(0, hang.w - 4), 2);
      ctx.strokeStyle = "rgba(12, 16, 24, 0.85)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, hang.w - 1), Math.max(3, h - 1));
      ctx.restore();
    }

    for (const checkpoint of levelCheckpoints()) {
      const x = checkpoint.x - state.cameraX;
      if (x < -48 || x > W + 48) continue;
      const active = checkpoint.id === state.checkpointId;
      const y = checkpoint.y + 6;
      drawGlowCircle(x + 5, y - 28, active ? 32 : 18, active ? "#76f1ff" : "#ffcc73", active ? 0.26 : 0.14);
      ctx.fillStyle = active ? "#d7fbff" : "#f3c889";
      ctx.fillRect(x, y - 34, 10, 34);
      ctx.fillStyle = active ? "#49cde2" : "#b5732d";
      ctx.fillRect(x - 4, y - 34, 18, 4);
      ctx.fillStyle = active ? "#7bf4ff" : "#ffd27a";
      ctx.beginPath();
      ctx.moveTo(x + 10, y - 32);
      ctx.lineTo(x + 26, y - 25);
      ctx.lineTo(x + 10, y - 18);
      ctx.closePath();
      ctx.fill();
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
        drawEnvironmentCrop("supportFace", x, obstacle.y, obstacle.w, obstacle.h, 0.4);
      } else if (obstacle.kind === "barrier") {
        ctx.fillStyle = "#394557";
        ctx.fillRect(x, obstacle.y, obstacle.w, obstacle.h);
        ctx.fillStyle = "#d7b15d";
        ctx.fillRect(x + 6, obstacle.y + 10, obstacle.w - 12, 7);
        ctx.fillStyle = "#262d38";
        ctx.fillRect(x + 10, obstacle.y + 24, obstacle.w - 20, obstacle.h - 34);
        drawEnvironmentCrop("wallFace", x, obstacle.y, obstacle.w, obstacle.h, 0.34);
      } else {
        ctx.fillStyle = "#5b4637";
        ctx.fillRect(x, obstacle.y, obstacle.w, obstacle.h);
        ctx.fillStyle = "#8a6b50";
        ctx.fillRect(x + 4, obstacle.y + 4, obstacle.w - 8, obstacle.h - 8);
        ctx.strokeStyle = "#2f241c";
        ctx.strokeRect(x + 6.5, obstacle.y + 6.5, obstacle.w - 13, obstacle.h - 13);
        drawEnvironmentCrop("wallFace", x, obstacle.y, obstacle.w, obstacle.h, 0.18);
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
      const deathSeq = getObjectiveDeathSequence(o.id);
      if (o.destroyed && !deathSeq) continue;
      const x = o.x - state.cameraX;
      if (x < -220 || x > W + 120) continue;
      const scale = 1.24;
      const sw = o.w * scale;
      const sh = o.h * scale;
      const sx = x - (sw - o.w) * 0.5;
      const sy = o.y - (sh - o.h);
      const ratio = o.hp / o.maxHp;
      const meltdownPulse = deathSeq ? 0.58 + Math.sin(state.levelClock * 24 + o.x * 0.013) * 0.26 : 1;
      drawEntityShadow(sx, sy + sh - 4, sw, 12, 0.28);
      const objectiveStyle = OBJECTIVE_SPRITE_STYLES[o.spriteStyle || o.kind] || OBJECTIVE_SPRITE_STYLES[o.kind] || { baseKey: `objective_${o.kind}`, frames: 1, fps: 0 };
      ctx.save();
      if (deathSeq) {
        ctx.globalAlpha = 0.7 + meltdownPulse * 0.22;
      }
      drawAnimSprite(objectiveStyle.baseKey, objectiveStyle.frames, objectiveStyle.fps, o.x * 0.01, sx, sy, sw, sh, false, () => {
        ctx.fillStyle = o.destroyed && !deathSeq ? "#30343a" : "#8b99ad";
        ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = o.destroyed && !deathSeq ? "#4e5058" : "#bbc9e0";
        ctx.fillRect(sx + 8, sy + 8, sw - 16, sh - 16);
      });
      const hitFlash = Math.max(0, o.damageFlashT || 0);
      if (hitFlash > 0 && !deathSeq) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.86, hitFlash * 2.8);
        ctx.filter = "brightness(0) saturate(0) invert(1)";
        drawAnimSprite(objectiveStyle.baseKey, objectiveStyle.frames, objectiveStyle.fps, o.x * 0.01, sx, sy, sw, sh, false, () => {});
        ctx.restore();
      }
      if (deathSeq) {
        const hotGlow = o.kind === "reactor" ? "#9dff88" : o.kind === "centrifuge" ? "#a6f4ff" : "#ffbc72";
        drawGlowCircle(sx + sw * 0.5, sy + sh * 0.48, sw * (0.34 + meltdownPulse * 0.18), hotGlow, 0.1 + meltdownPulse * 0.06);
      } else if (!o.destroyed) {
        const weakGlow = o.weak === "LASER" ? "#54f3ff" : o.weak === "FLAME" ? "#ff9042" : o.weak === "SPREAD" ? "#ffd447" : "#f1f7ff";
        drawGlowCircle(sx + sw * 0.5, sy + sh * 0.48, sw * 0.42, weakGlow, 0.08);
        ctx.fillStyle = "rgba(15,21,30,0.8)";
        ctx.fillRect(sx, sy - 20, sw, 8);
        ctx.fillStyle = weakGlow;
        ctx.fillRect(sx + 1, sy - 19, Math.max(0, (sw - 2) * ratio), 6);
      }
      ctx.restore();
      ctx.fillStyle = "#e7f4ff";
      ctx.font = "12px Trebuchet MS";
      ctx.fillText(o.label, sx, sy - 28);
      if (!o.destroyed) {
        ctx.fillStyle = "#9bd1ff";
        ctx.fillText(`Weak: ${o.weak}`, sx, sy - 12);
      }
    }
  }

  function drawAftermath() {
    for (const corpse of state.corpses) {
      const poolX = corpse.x + corpse.w * 0.48 - state.cameraX;
      const poolY = corpse.y + corpse.h - 2;
      const poolProgress = Math.min(1, corpse.poolT / Math.max(0.001, corpse.poolTarget));
      drawGlowCircle(poolX, poolY - 1, corpse.poolScaleX * (0.8 + poolProgress * 0.6), "#7d0a14", 0.08 * poolProgress);
      ctx.save();
      ctx.fillStyle = `rgba(78, 0, 8, ${0.26 + poolProgress * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(poolX, poolY, corpse.poolScaleX * poolProgress, corpse.poolScaleY * poolProgress, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(184, 22, 32, ${0.14 + poolProgress * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(poolX + corpse.poolScaleX * 0.14, poolY - 1, corpse.poolScaleX * 0.42 * poolProgress, corpse.poolScaleY * 0.33 * poolProgress, 0.06, 0, Math.PI * 2);
      ctx.fill();
      for (const splat of corpse.splats) {
        ctx.globalAlpha = splat.a * poolProgress;
        ctx.beginPath();
        ctx.ellipse(poolX + splat.ox, poolY + splat.oy, splat.rx * poolProgress, splat.ry * poolProgress, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const corpse of state.corpses) {
      const render = getEnemyRenderState(corpse);
      const sx = render.sx - state.cameraX;
      const sy = render.sy;
      if (sx < -render.sw - 80 || sx > W + 80) continue;
      drawEntityShadow(sx, sy, render.sw, render.sh, 0.18);
      const deathBase = resolveTrooperDeathBase(corpse);
      const hasDeathStrip = deathBase.includes("_death");
      const frame = hasDeathStrip
        ? Math.min(ANIM.enemy.trooper_death.frames - 1, Math.floor(Math.min(corpse.t * ANIM.enemy.trooper_death.fps, ANIM.enemy.trooper_death.frames - 1)))
        : 0;
      if (!corpse.landed) {
        drawSprite(hasDeathStrip ? `${deathBase}_${frame}` : deathBase, sx, sy, render.sw, render.sh, corpse.flip, () => {
          ctx.save();
          ctx.translate(sx + render.sw * 0.5, sy + render.sh * 0.72);
          ctx.rotate(corpse.rot);
          ctx.fillStyle = "#7a3a34";
          ctx.fillRect(-render.sw * 0.36, -render.sh * 0.16, render.sw * 0.72, render.sh * 0.24);
          ctx.restore();
        });
      } else {
        const palette = corpse.variant === "olive"
          ? { body: "#5a7242", accent: "#b0d170", metal: "#96ab91" }
          : corpse.variant === "crimson"
            ? { body: "#8d4b4f", accent: "#ff9a86", metal: "#bda6ad" }
            : corpse.variant === "navy"
              ? { body: "#4f628e", accent: "#a9d5ff", metal: "#a9b5c9" }
              : { body: "#7b5448", accent: "#ffb562", metal: "#c7c2b8" };
        const dir = corpse.flip ? -1 : 1;
        ctx.save();
        ctx.translate(sx + render.sw * 0.48, sy + render.sh * 0.68);
        if (dir < 0) ctx.scale(-1, 1);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(36, 23, 22, 0.65)";
        ctx.beginPath();
        ctx.ellipse(0, render.sh * 0.01, render.sw * 0.22, render.sh * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.body;
        ctx.fillRect(-render.sw * 0.18, -render.sh * 0.045, render.sw * 0.27, render.sh * 0.085);
        ctx.fillRect(render.sw * 0.02, -render.sh * 0.055, render.sw * 0.13, render.sh * 0.045);
        ctx.fillRect(-render.sw * 0.04, render.sh * 0.02, render.sw * 0.12, render.sh * 0.03);
        ctx.fillRect(render.sw * 0.08, render.sh * 0.005, render.sw * 0.14, render.sh * 0.026);
        ctx.fillStyle = palette.metal;
        ctx.fillRect(-render.sw * 0.24, -render.sh * 0.022, render.sw * 0.22, render.sh * 0.022);
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(render.sw * 0.13, -render.sh * 0.028, render.sh * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-render.sw * 0.03, -render.sh * 0.05, render.sw * 0.06, render.sh * 0.012);
        ctx.restore();
      }
    }

    for (const particle of state.bloodParticles) {
      const alpha = Math.max(0, 1 - particle.t / particle.ttl) * particle.alpha;
      const x = particle.x - state.cameraX;
      if (x < -32 || x > W + 32) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEnemies() {
    for (const e of state.enemies) {
      const render = getEnemyRenderState(e);
      const recoil = getEnemyRecoilOffset(e);
      const flip = render.flip;
      const sw = render.sw;
      const sh = render.sh;
      const deathSeq = e.kind === "boss" && e.dying ? state.bossDeath : null;
      const deathProgress = deathSeq ? clamp((deathSeq.t || 0) / Math.max(0.001, deathSeq.duration || BOSS_DEATH_DURATION), 0, 1) : 0;
      const deathJitter = deathSeq ? lerp(1.2, 7.4, deathProgress) : 0;
      const shakeX = deathSeq ? Math.sin(state.levelClock * 42 + e.x * 0.03) * deathJitter : 0;
      const shakeY = deathSeq ? Math.cos(state.levelClock * 36 + e.y * 0.04) * deathJitter * 0.45 : 0;
      const sx = render.sx - state.cameraX + recoil.x + shakeX;
      const sy = render.sy + recoil.y + shakeY;
      if (e.kind === "drone") {
        const gy = terrainY(e.x + e.w * 0.5);
        drawShadowBlob(sx + sw * 0.5, gy - 1, sw * 0.5, 6, 0.22);
      } else {
        drawEntityShadow(sx, sy, sw, sh, 0.25);
      }
      const spriteState = getEnemySpriteState(e);
      const baseKey = spriteState.baseKey;
      const anim = { frames: spriteState.frames || 1, fps: spriteState.fps || 0 };
      const phase = (e.x * 0.013 + e.y * 0.007 + (e.wave || 0)) % 11;
      ctx.save();
      if (deathSeq) ctx.globalAlpha = 0.74 + Math.sin(state.levelClock * 54) * 0.12;
      drawAnimSprite(baseKey, anim.frames, anim.fps, phase, sx, sy, sw, sh, flip, () => {
        if (e.kind === "trooper") { ctx.fillStyle = "#f15d5d"; ctx.fillRect(sx, sy, sw, sh); }
        else if (e.kind === "drone") { ctx.fillStyle = "#f7b267"; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = "#201f2a"; ctx.fillRect(sx + 6, sy + 4, sw - 12, 8); }
        else if (e.kind === "turret") { ctx.fillStyle = "#d6617c"; ctx.fillRect(sx, sy, sw, sh); ctx.fillRect(sx + 10, sy - 8, 16, 8); }
        else if (e.kind === "boss") { ctx.fillStyle = "#ff9b57"; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = "#352133"; ctx.fillRect(sx + 10, sy + 8, sw - 20, sh - 18); }
        else { ctx.fillStyle = "#ff9169"; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = "#352133"; ctx.fillRect(sx + 8, sy + 10, sw - 16, 20); }
      });
      ctx.restore();
      const hitFlash = Math.max(0, e.damageFlashT || 0);
      if (hitFlash > 0 && !deathSeq) {
        ctx.save();
        const maxAlpha = e.kind === "boss" ? 0.34 : e.kind === "mech" ? 0.28 : 0.22;
        const gain = e.kind === "boss" ? 1.55 : e.kind === "mech" ? 1.42 : 1.28;
        ctx.globalAlpha = Math.min(maxAlpha, hitFlash * gain);
        ctx.globalCompositeOperation = "screen";
        ctx.filter = "grayscale(1) brightness(3.1) contrast(1.05)";
        drawAnimSprite(baseKey, anim.frames, anim.fps, phase, sx, sy, sw, sh, flip, () => {});
        ctx.restore();
      }
      if (deathSeq) {
        drawGlowCircle(sx + sw * 0.5, sy + sh * 0.44, sw * (0.54 + deathProgress * 0.2), "#ff9c61", 0.16 + deathProgress * 0.08);
        drawGlowCircle(sx + sw * 0.52, sy + sh * 0.46, sw * (0.34 + deathProgress * 0.14), "#fff0b2", 0.12 + deathProgress * 0.06);
      }
      ctx.fillStyle = "rgba(10,12,16,0.78)";
      ctx.fillRect(sx, sy - 8, sw, 4);
      ctx.fillStyle = deathSeq ? "#ffd58d" : "#ff8d9a";
      const barRatio = deathSeq ? Math.max(0, 1 - deathProgress) : clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillRect(sx + 1, sy - 7, Math.max(0, (sw - 2) * barRatio), 2);
      if (e.kind === "boss") {
        ctx.fillStyle = deathSeq ? "#fff0bc" : "#ffd98a";
        ctx.font = "bold 14px Trebuchet MS";
        ctx.fillText(deathSeq ? `${e.bossName} MELTDOWN` : e.bossName, sx + 6, sy - 16);
      }
      if (!deathSeq && (e.kind === "trooper" || e.kind === "drone" || e.kind === "turret" || e.kind === "mech" || e.kind === "boss") && (e.attackT || 0) > 0.04) {
        const muzzle = getEnemyMuzzlePoint(e, recoil.x, recoil.y);
        const aim = getEnemyAimVector(e);
        const flashLead = MUZZLE_FLASH_FORWARD_OFFSET + (e.kind === "boss" ? 1.5 : e.kind === "mech" ? 1 : e.kind === "drone" ? 0.5 : 0);
        drawMuzzleBloom(muzzle.x - state.cameraX + aim.x * flashLead, muzzle.y + aim.y * flashLead, aim.x, aim.y, e.kind === "boss" ? 24 : e.kind === "mech" ? 20 : e.kind === "drone" ? 13 : 15, {
          glow: e.kind === "drone" ? "#98ff63" : e.kind === "turret" ? "#ffbb96" : "#ffdf8f",
          hot: "#fff6de",
          ember: e.kind === "drone" ? "#54ff2c" : e.kind === "turret" ? "#ff8446" : "#ffaf4f",
        }, 0.92);
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
      const aura = c.type === "med"
        ? "#76f2ab"
        : c.type === "bomb"
          ? "#fff0a6"
          : c.type === "shield"
            ? "#89f7ff"
          : c.weapon === "LASER"
            ? "#65f3ff"
            : c.weapon === "FLAME"
              ? "#ff9e49"
              : "#ffe163";
      drawGlowCircle(sx + sw * 0.5, sy + sh * 0.5, sw * 0.95, aura, 0.16);
      drawEntityShadow(sx, sy, sw, sh, 0.18);
      if (c.type === "med") {
        drawAnimSprite("pickup_med", ANIM.pickup.frames, ANIM.pickup.fps, c.bob, sx, sy, sw, sh, false, () => {
          ctx.fillStyle = "#74df98"; ctx.fillRect(sx, sy, sw, sh);
          ctx.fillStyle = "#1a4630"; ctx.fillRect(sx + 9, sy + 4, 6, 16); ctx.fillRect(sx + 4, sy + 9, 16, 6);
        });
      } else if (c.type === "bomb") {
        const cx = sx + sw * 0.5;
        const cy = sy + sh * 0.56;
        const r = sw * 0.34;
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.fillStyle = "#212734";
        ctx.strokeStyle = "#f9f0a7";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#121722";
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.15, cy - r * 0.9);
        ctx.quadraticCurveTo(cx + r * 0.95, cy - r * 1.35, cx + r * 1.08, cy - r * 1.88);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.25, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff5bf";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + r * 1.05, cy - r * 1.9);
        ctx.lineTo(cx + r * 1.34, cy - r * 2.22);
        ctx.moveTo(cx + r * 1.08, cy - r * 2.28);
        ctx.lineTo(cx + r * 1.42, cy - r * 1.96);
        ctx.stroke();
        ctx.restore();
      } else if (c.type === "shield") {
        const cx = sx + sw * 0.5;
        const cy = sy + sh * 0.52;
        const r = sw * 0.34;
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#c7ffff";
        ctx.fillStyle = "rgba(26, 49, 76, 0.82)";
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI * 0.5 + (Math.PI * 2 * i) / 6;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r * 1.06;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#78f6ff";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.74);
        ctx.lineTo(cx + r * 0.58, cy - r * 0.1);
        ctx.lineTo(cx + r * 0.34, cy + r * 0.72);
        ctx.lineTo(cx - r * 0.34, cy + r * 0.72);
        ctx.lineTo(cx - r * 0.58, cy - r * 0.1);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
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
      if (b.weapon === "LASER") {
        const aim = normalizeVec(b.vx, b.vy);
        const beamBack = 52;
        const beamFront = 16;
        const x0 = x - aim.x * beamBack;
        const y0 = b.y - aim.y * beamBack;
        const x1 = x + aim.x * beamFront;
        const y1 = b.y + aim.y * beamFront;
        ctx.save();
        ctx.globalAlpha = 0.34;
        ctx.strokeStyle = "#62efff";
        ctx.lineWidth = 9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.globalAlpha = 0.62;
        ctx.strokeStyle = "#bdfcff";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.globalAlpha = 0.92;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.restore();
        drawGlowCircle(x, b.y, 20, "#7ff7ff", 0.2);
        drawGlowCircle(x1, y1, 10, "#d9ffff", 0.2);
        continue;
      }
      const outerGlow = b.weapon === "LASER" ? "#8ff7ff" : b.weapon === "FLAME" ? "#ffb15b" : b.weapon === "SPREAD" ? "#ffe772" : "#d8ebff";
      const coreGlow = b.weapon === "LASER" ? "#ebffff" : b.weapon === "FLAME" ? "#ffe0ac" : "#ffffff";
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = outerGlow;
      ctx.lineWidth = Math.max(0.55, b.r * 0.9);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, b.y);
      ctx.stroke();
      ctx.restore();
      drawGlowCircle(x, b.y, b.r * 4.8, outerGlow, 0.34);
      drawGlowCircle(x, b.y, b.r * 2.5, coreGlow, 0.22);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(x, b.y, Math.max(0.8, b.r * 0.45), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const b of state.enemyBullets) {
      const x = b.x - state.cameraX;
      const tx = x - b.vx * 0.015;
      const ty = b.y - b.vy * 0.015;
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = Math.max(0.55, b.r * 0.9);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, b.y);
      ctx.stroke();
      ctx.restore();
      drawGlowCircle(x, b.y, b.r * 2.8, b.color, 0.2);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    const p = state.player;
    const death = state.playerDeath;
    if (death) {
      const sx = death.bodyX + death.renderOffsetX - state.cameraX;
      const sy = death.bodyY + death.renderOffsetY;
      if (!death.hidden) {
        drawEntityShadow(sx, sy, death.renderW, death.renderH, 0.22);
        ctx.save();
        ctx.translate(sx + death.renderW * 0.5, sy + death.renderH * 0.68);
        ctx.rotate(death.rot);
        ctx.translate(-(sx + death.renderW * 0.5), -(sy + death.renderH * 0.68));
        drawSprite(death.spriteKey, sx, sy, death.renderW, death.renderH, death.flipScale, () => {
          ctx.fillStyle = "#f1f8ff";
          ctx.fillRect(sx, sy, death.renderW, death.renderH);
        });
        if ((death.flashT || 0) > 0.02) {
          ctx.globalAlpha = Math.min(0.9, (death.flashT || 0) * 0.9);
          ctx.filter = "brightness(0) saturate(0) invert(1)";
          drawSprite(death.spriteKey, sx, sy, death.renderW, death.renderH, death.flipScale, () => {});
        }
        ctx.restore();
      }
      return;
    }
    const render = getPlayerRenderState(p);
    const sprite = getPlayerSpriteState(p, render);
    const aim = getPlayerAimVector(p);
    const recoilT = clamp(p.muzzleFlashT / (p.weapon === "FLAME" ? 0.11 : 0.08), 0, 1);
    const recoilEnabled = p.muzzleFlashT > 0 && (render.key === "player_idle" || render.key === "player_run");
    const recoilStrength = recoilEnabled ? 3.2 : 0;
    const recoilX = -aim.x * recoilStrength * recoilT;
    const recoilY = 0;
    const sw = render.sw;
    const sh = render.sh;
    const sx = render.sx - state.cameraX + recoilX;
    const sy = render.sy + recoilY;
    drawEntityShadow(sx, sy, sw, sh, 0.26);
    if (p.shieldHits > 0) {
      const pulse = 0.5 + Math.sin(state.levelClock * 8 + sx * 0.03) * 0.5;
      const flash = p.shieldFlashT > 0 ? p.shieldFlashT * 1.8 : 0;
      const auraAlpha = 0.08 + pulse * 0.04 + flash * 0.16;
      const ringAlpha = 0.24 + pulse * 0.08 + flash * 0.22;
      drawGlowCircle(sx + sw * 0.5, sy + sh * 0.48, sw * (0.44 + pulse * 0.06), "#86f4ff", auraAlpha);
      ctx.save();
      ctx.globalAlpha = Math.min(1, ringAlpha);
      ctx.strokeStyle = "#d8ffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * 0.5 + (Math.PI * 2 * i) / 6;
        const px = sx + sw * 0.5 + Math.cos(a) * sw * 0.26;
        const py = sy + sh * 0.48 + Math.sin(a) * sh * 0.3;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    const flipScale = render.flipScale;
    drawAnimSprite(sprite.key, sprite.frames, sprite.fps, sprite.phase, sx, sy, sw, sh, flipScale, () => {
      ctx.fillStyle = p.invuln > 0 && Math.floor(state.levelClock * 18) % 2 === 0 ? "#ffd8d8" : "#f1f8ff";
      if (render.key === "player_crouch") {
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

    if (p.muzzleFlashT > 0) {
      const muzzle = getPlayerMuzzlePoint(p);
      const flashLead = MUZZLE_FLASH_FORWARD_OFFSET + (p.weapon === "FLAME" ? 1 : 0);
      drawMuzzleBloom(muzzle.x - state.cameraX + aim.x * flashLead, muzzle.y + aim.y * flashLead, aim.x, aim.y, p.weapon === "FLAME" ? 22 : 18, {
        glow: p.weapon === "LASER" ? "#96f5ff" : "#ffe08c",
        hot: "#fff7e2",
        ember: p.weapon === "FLAME" ? "#ff7b34" : "#ffae4b",
      }, p.weapon === "FLAME" ? 1.15 : 1);
    }
  }

  function drawEffects() {
    for (const bomb of state.smartBombs) {
      const radius = getSmartBombRadius(bomb);
      const centerX = bomb.x - state.cameraX;
      const centerY = bomb.y;
      const growT = clamp(bomb.t / Math.max(0.001, bomb.growDuration || SMART_BOMB_GROW_DURATION), 0, 1);
      const preFlash = bomb.t < (bomb.growDuration || SMART_BOMB_GROW_DURATION);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawGlowCircle(centerX, centerY, radius * (0.78 + growT * 0.28), "#fff6ce", preFlash ? (0.06 + growT * 0.06) : 0.18);
      drawGlowCircle(centerX, centerY, radius * (0.4 + growT * 0.24), "#fffef3", preFlash ? (0.08 + growT * 0.05) : 0.24);
      if (preFlash) {
        ctx.strokeStyle = `rgba(255, 250, 222, ${lerp(0.18, 0.94, growT).toFixed(3)})`;
        ctx.lineWidth = Math.max(3, 12 * (1 - growT) + 2);
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(12, radius - ctx.lineWidth * 0.5), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
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
    const deathSeq = state.bossDeath;
    const boss = getDyingBoss();
    if (deathSeq && boss) {
      const p = clamp(deathSeq.t / Math.max(0.001, deathSeq.duration), 0, 1);
      const pulse = 0.5 + Math.sin(state.levelClock * 18) * 0.5;
      drawGlowCircle(boss.x + boss.w * 0.5 - state.cameraX, boss.y + boss.h * 0.5, boss.w * (0.9 + p * 0.6), "#ff8f5e", 0.1 + pulse * 0.08);
      drawGlowCircle(boss.x + boss.w * 0.5 - state.cameraX, boss.y + boss.h * 0.48, boss.w * (0.54 + p * 0.32), "#fff0b2", 0.08 + pulse * 0.06);
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
    ctx.fillText(`Shield: ${p.shieldHits}`, 660, 30);
    ctx.fillText(`Bombs: ${p.smartBombs}`, 660, 52);

    const hp = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = "rgba(18,23,32,0.9)";
    ctx.fillRect(760, 24, 180, 16);
    ctx.fillStyle = hp > 0.45 ? "#5ef0a3" : hp > 0.2 ? "#ffd447" : "#ff6b57";
    ctx.fillRect(762, 26, 176 * hp, 12);
    ctx.fillStyle = "#ecf6ff";
    ctx.font = "bold 12px Trebuchet MS";
    ctx.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, 784, 53);

    const boss = getActiveBoss();
    if (boss) {
      const deathSeq = boss.dying ? state.bossDeath : null;
      const barRatio = deathSeq
        ? Math.max(0, 1 - deathSeq.t / Math.max(0.001, deathSeq.duration || BOSS_DEATH_DURATION))
        : clamp(boss.hp / boss.maxHp, 0, 1);
      ctx.fillStyle = "rgba(18,23,32,0.9)";
      ctx.fillRect(W * 0.5 - 170, 82, 340, 16);
      ctx.fillStyle = deathSeq ? "#ffcf84" : "#ff9567";
      ctx.fillRect(W * 0.5 - 168, 84, 336 * barRatio, 12);
      ctx.fillStyle = "#fff0d8";
      ctx.font = "bold 13px Trebuchet MS";
      ctx.fillText(deathSeq ? `${boss.bossName} CORE MELTDOWN` : boss.bossName, W * 0.5 - 104, 78);
    }

    if (state.combo >= 2 && state.comboTimer > 0) {
      ctx.fillStyle = "#ffd447";
      ctx.font = "bold 16px Trebuchet MS";
      ctx.fillText(`Combo x${state.combo}`, W * 0.5 - 45, 98);
    }

    if (state.mode === "paused" && !debugHidePauseOverlay) {
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
    const smartBombWhiteout = getSmartBombWhiteoutAlpha();
    const objectiveWhiteout = getObjectiveWhiteoutAlpha();
    const playerDeathWhiteout = getPlayerDeathWhiteoutAlpha();
    if (state.bossDeath) {
      const p = clamp(state.bossDeath.t / Math.max(0.001, state.bossDeath.duration), 0, 1);
      const pulse = 0.5 + Math.sin(state.levelClock * 22) * 0.5;
      const whiteout = Math.max(getBossWhiteoutAlpha(), smartBombWhiteout, objectiveWhiteout);
      ctx.fillStyle = `rgba(255, 180, 112, ${(0.02 + Math.min(1, p * 1.4) * 0.05 + pulse * 0.03).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      if ((state.bossDeath.flashT || 0) > 0) {
        ctx.fillStyle = `rgba(255, 244, 202, ${Math.min(0.24, state.bossDeath.flashT * 0.9).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (whiteout > 0) {
        ctx.fillStyle = `rgba(255,255,255,${whiteout.toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (smartBombWhiteout > 0 || objectiveWhiteout > 0 || playerDeathWhiteout > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(smartBombWhiteout, objectiveWhiteout, playerDeathWhiteout).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
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
    ctx.fillText("Hang Bars: Jump, Up, or Fire into overhead bars", 190, 370);
    ctx.fillText("Drop From Bars: Hold Down", 190, 394);
    ctx.fillText("Shoot: Z   Aim Lock: Hold X   Smart Bomb: C", 190, 418);
    ctx.fillText("Crouch Lock: Hold Down + X   Cycle Weapons: A / B", 190, 442);
    ctx.fillText("Pause: P   Fullscreen: F   Mute: M", 190, 466);
    ctx.fillText("Audio Lab: open audio-lab.html to preview and remap SFX", 190, 490);

    ctx.fillStyle = "#ffd447";
    ctx.font = "bold 20px Trebuchet MS";
    ctx.fillText("Press Enter or click Start Operation", 254, 514);
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
    const shake = getBossDeathScreenShake();
    ctx.save();
    ctx.translate(shake.x, shake.y - state.cameraY);
    drawTraversal();
    drawAftermath();
    drawObjectives();
    drawExtraction();
    drawPickups();
    drawEnemies();
    drawBullets();
    drawPlayer();
    drawEffects();
    ctx.restore();
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
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyZ", "KeyX", "KeyC", "KeyA", "KeyB"].includes(e.code)) {
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
    if (e.code === "KeyM") {
      toggleMute();
      return;
    }

    if (state.mode === "splash") {
      if (e.code === "Enter") {
        unlockAudio();
        startCampaign();
      }
      return;
    }

    if (state.mode === "playing" || state.mode === "paused") {
      if (e.code === "KeyP") state.mode = state.mode === "playing" ? "paused" : "playing";
      if (!e.repeat && e.code === "KeyA") cycleWeapon(-1);
      if (!e.repeat && e.code === "KeyB") cycleWeapon(1);
      if (!e.repeat && e.code === "KeyC" && state.mode === "playing") deploySmartBomb();
      return;
    }

    if ((state.mode === "gameOver" || state.mode === "campaignComplete") && e.code === "Enter") {
      startCampaign();
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyZ", "KeyX", "KeyC", "KeyA", "KeyB"].includes(e.code)) {
      e.preventDefault();
    }
  }

  window.render_game_to_text = () => {
    const p = state.player;
    const boss = getActiveBoss();
    const payload = {
      coordinateSystem: { origin: "top-left", xDirection: "right", yDirection: "down" },
      mode: state.mode,
      level: {
        index: state.levelIndex,
        name: state.level.name,
        cameraX: Math.round(state.cameraX),
        cameraY: Math.round(state.cameraY),
        height: levelHeight(),
        top: levelTop(),
        extractionReady: state.extractionReady,
        bossActive: state.bossActive,
        bossDefeated: state.bossDefeated,
        platforms: levelPlatforms().length,
        climbables: levelClimbables().length,
        hangables: levelHangables().length,
        hazards: levelHazards().length,
      },
      player: {
        x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy),
        hp: Math.round(p.hp), maxHp: p.maxHp, onGround: p.onGround, crouching: p.crouching, prone: p.prone, climbing: p.climbing, hanging: p.hanging,
        muzzleFlash: p.muzzleFlashT > 0, aimLock: isAimLockActive(p), facing: p.face, visualFacing: Number((typeof p.visualFace === "number" ? p.visualFace : p.face).toFixed(2)),
        pose: getPlayerPoseKey(p),
        support: p.supportType || null,
        aim: { x: Number((p.aimX || 0).toFixed(2)), y: Number((p.aimY || 0).toFixed(2)), mode: getPlayerAimMode(p) },
        activeWeapon: p.weapon,
        ammo: Number.isFinite(p.bag?.[p.weapon]?.ammo) ? Math.floor(p.bag[p.weapon].ammo) : "INF",
        shieldHits: p.shieldHits || 0,
        smartBombs: p.smartBombs,
        climbMoving: !!p.climbMoving,
        hangMoving: !!p.hangMoving,
      },
      objectives: state.objectives.slice(0, 8).map((o) => ({ id: o.id, label: o.label, x: Math.round(o.x), y: Math.round(o.y), hp: Math.round(o.hp), maxHp: o.maxHp, destroyed: o.destroyed, weakness: o.weak, damageFlashT: Number((o.damageFlashT || 0).toFixed(2)) })),
      objectiveDeaths: state.objectiveDeaths.slice(0, 8).map((seq) => ({ id: seq.id, kind: seq.kind, t: Number(seq.t.toFixed(2)), duration: seq.duration, flashT: Number((seq.flashT || 0).toFixed(2)) })),
      obstacles: (state.level?.obstacles || []).slice(0, 12).map((o) => ({ id: o.id, kind: o.kind, hp: o.maxHp ? Math.round(o.hp) : null, maxHp: o.maxHp || null, destroyed: !!o.destroyed })),
      enemies: state.enemies.slice(0, 16).map((e) => ({ kind: e.kind, variant: e.variant || null, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp), damageFlashT: Number((e.damageFlashT || 0).toFixed(2)) })),
      boss: boss ? { name: boss.bossName, hp: Math.round(boss.hp), maxHp: boss.maxHp, x: Math.round(boss.x), y: Math.round(boss.y), dying: !!boss.dying } : null,
      bossDeath: state.bossDeath ? { t: Number(state.bossDeath.t.toFixed(2)), duration: state.bossDeath.duration, name: state.bossDeath.name, whiteoutAlpha: Number(getBossWhiteoutAlpha().toFixed(2)), detonated: !!state.bossDeath.detonated } : null,
      playerDeath: state.playerDeath ? { t: Number(state.playerDeath.t.toFixed(2)), duration: state.playerDeath.duration, detonated: !!state.playerDeath.detonated, hidden: !!state.playerDeath.hidden, whiteoutAlpha: Number(getPlayerDeathWhiteoutAlpha().toFixed(2)) } : null,
      smartBombs: state.smartBombs.map((bomb) => ({ x: Math.round(bomb.x), y: Math.round(bomb.y), t: Number(bomb.t.toFixed(2)), radius: Math.round(getSmartBombRadius(bomb)), whiteoutAlpha: Number(getSmartBombWhiteoutAlphaFor(bomb).toFixed(2)) })),
      respawns: state.respawnQueue.slice(0, 8).map((ticket) => ({ id: ticket.id, dueIn: Number(Math.max(0, ticket.due - state.levelClock).toFixed(2)), x: Math.round(ticket.spawn?.x ?? 0) })),
      bullets: { player: state.bullets.length, enemy: state.enemyBullets.length },
      aftermath: { corpses: state.corpses.length, stackedCorpses: state.corpses.filter((corpse) => !!corpse.supportCorpseId).length, bloodParticles: state.bloodParticles.length },
      pickups: state.pickups.slice(0, 10).map((c) => ({ type: c.type, weapon: c.weapon || null, x: Math.round(c.x), y: Math.round(c.y) })),
      checkpoint: state.checkpoint ? { id: state.checkpoint.id, x: Math.round(state.checkpoint.x), y: Math.round(state.checkpoint.y) } : null,
      audio: {
        enabled: !!audioState.manifest,
        unlocked: audioState.unlocked,
        muted: audioState.muted,
        currentMusicKey: audioState.currentMusicKey || null,
        desiredMusicKey: audioState.desiredMusicKey || null,
        duck: Number(audioState.musicDuck.toFixed(2)),
        duckTarget: Number(audioState.musicDuckTarget.toFixed(2)),
      },
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
      state.objectiveDeaths = [];
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
      state.enemies = [];
      state.pending = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = boss.arenaStart + 48;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.cameraX = clamp(state.player.x - W * 0.34, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.48, levelTop(), Math.max(levelTop(), levelHeight() - H));
      activateBossEncounter();
      updateFlow(DT);
      return true;
    },
    defeatBoss() {
      const boss = getActiveBoss();
      if (!boss) return false;
      return startBossDeathSequence(boss);
    },
    advanceBossDeath(seconds = BOSS_DEATH_TOTAL_DURATION + 0.25) {
      let remaining = Math.max(0, seconds);
      while (remaining > 0 && (state.mode === "bossDeath" || state.mode === "levelClear" || state.mode === "transition")) {
        const slice = Math.min(DT, remaining);
        step(slice);
        remaining -= slice;
      }
      render();
      return true;
    },
    setupBossDeathCheck(progress = 0.58) {
      clearSay();
      debugHidePauseOverlay = true;
      this.skipToBoss();
      if (!this.defeatBoss()) return false;
      const seconds = progress <= 1 ? Math.max(0, progress) * BOSS_DEATH_DURATION : Math.max(0, progress);
      this.advanceBossDeath(seconds);
      if (state.mode === "bossDeath") state.mode = "paused";
      render();
      return true;
    },
    setupPlayerDeathCheck(progress = 0.56) {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(0, false);
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 420;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 90;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.hp = 0;
      state.player.invuln = 0;
      startPlayerDeathSequence();
      let remaining = PLAYER_DEATH_TOTAL_DURATION * clamp(progress, 0, 1);
      while (remaining > 0 && state.mode === "playerDeath") {
        const slice = Math.min(DT, remaining);
        step(slice);
        remaining -= slice;
      }
      if (state.mode === "playerDeath") state.mode = "paused";
      render();
      return true;
    },
    setupBossDamageFlashCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(0, false);
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const bossSpec = state.level?.boss;
      if (!bossSpec) return false;
      spawnEnemy({ t: "boss", ...bossSpec });
      const boss = getActiveBoss();
      if (!boss) return false;
      state.bossActive = true;
      state.player.x = Math.max(72, boss.x - 220);
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      flashEnemyDamage(boss, 0.28);
      state.cameraX = clamp(boss.x - W * 0.32, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(boss.y - H * 0.4, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupEnemyDamageFlashCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(0, false);
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 320;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      spawnEnemy({ t: "trooper", x: 480, surfaceY: terrainY(480), variant: "crimson" });
      spawnEnemy({ t: "drone", x: 610, y: 280 });
      spawnEnemy({ t: "turret", x: 760, surfaceY: terrainY(760) });
      spawnEnemy({ t: "mech", x: 900, surfaceY: terrainY(900), spriteStyle: "crawler", patrolMin: 860, patrolMax: 980 });
      for (const enemy of state.enemies) flashEnemyDamage(enemy, enemy.kind === "mech" ? 0.24 : 0.2);
      state.cameraX = clamp(360 - W * 0.08, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.45, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupObjectiveDamageFlashCheck(levelIndex = 0, objectiveIndex = 0) {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(levelIndex, false);
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const objective = state.objectives[objectiveIndex] || state.objectives.find((item) => item.kind === "reactor" || item.kind === "centrifuge") || state.objectives[0];
      if (!objective) return false;
      state.player.x = Math.max(72, objective.x - 240);
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      flashObjectiveDamage(objective, 0.3);
      state.cameraX = clamp(objective.x - W * 0.38, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(objective.y - H * 0.54, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupMuzzleCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 460;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.aimX = 1;
      state.player.aimY = 0;
      state.player.weapon = "RIFLE";
      state.player.fireCd = 0;
      spawnEnemy({ t: "trooper", x: 420, surfaceY: terrainY(434), variant: "crimson" });
      spawnPlayerBullets();
      const trooper = state.enemies[0];
      if (trooper) fireEnemy(trooper);
      state.mode = "paused";
      render();
      return true;
    },
    setupLaserBeamCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 360;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.aimX = 1;
      state.player.aimY = 0;
      state.player.weapon = "LASER";
      state.player.bag.LASER.unlocked = true;
      state.player.bag.LASER.level = 2;
      state.player.bag.LASER.ammo = Infinity;
      state.player.fireCd = 0;
      spawnPlayerBullets();
      state.mode = "paused";
      render();
      return true;
    },
    setupAimLockCheck() {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 460;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.debugAimLock = true;
      keys.ArrowRight = true;
      keys.ArrowUp = true;
      updatePlayer(DT);
      keys.ArrowRight = false;
      keys.ArrowUp = false;
      state.mode = "paused";
      render();
      return true;
    },
    setupSmartBombCheck(progress = 0.52) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.smartBombs = [];
      state.player.x = 260;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.smartBombs = SMART_BOMB_STOCK;
      spawnEnemy({ t: "trooper", x: 352, surfaceY: terrainY(366), variant: "crimson" });
      spawnEnemy({ t: "trooper", x: 448, surfaceY: terrainY(462), variant: "olive" });
      spawnEnemy({ t: "mech", x: 548, surfaceY: terrainY(572), spriteStyle: "crawler", patrolMin: 520, patrolMax: 620 });
      state.objectives.push({ id: "smart-bomb-core", label: "Dummy Reactor", x: 414, y: terrainY(432) - 84, w: 88, h: 84, hp: 140, maxHp: 140, weak: "LASER", destroyed: false, reward: null });
      state.enemyBullets.push({ x: 330, y: state.player.y + 20, vx: 80, vy: -20, r: 2.5 * BULLET_RADIUS_SCALE, ttl: 2, dmg: 8, color: "#ff5969" });
      deploySmartBomb();
      let remaining = Math.max(0, progress);
      while (remaining > 0) {
        const slice = Math.min(DT, remaining);
        step(slice);
        remaining -= slice;
      }
      state.mode = "paused";
      render();
      return true;
    },
    setupBombPickupCheck(collect = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.smartBombs = [];
      state.player.x = 220;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.smartBombs = 2;
      state.pickups.push({
        id: "debug-bomb-pickup",
        type: "bomb",
        amount: 1,
        x: state.player.x + (collect ? state.player.w * 0.5 : 72),
        y: state.player.y + 8,
        w: 24,
        h: 24,
        vy: 0,
        bob: 0.8,
      });
      if (collect) updatePickups(DT);
      state.mode = "paused";
      render();
      return true;
    },
    setupBombRefillCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(0, false);
      state.mode = "playing";
      state.player.smartBombs = 1;
      state.transitionT = 0.01;
      state.mode = "levelClear";
      step(0.02);
      state.mode = "paused";
      render();
      return true;
    },
    setupShieldPickupCheck(collect = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.smartBombs = [];
      state.player.x = 220;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.shieldHits = 0;
      state.player.shieldFlashT = 0;
      state.pickups.push({
        id: "debug-shield-pickup",
        type: "shield",
        amount: SHIELD_HITS_PER_PICKUP,
        x: state.player.x + (collect ? state.player.w * 0.5 : 72),
        y: state.player.y + 8,
        w: 24,
        h: 24,
        vy: 0,
        bob: 0.8,
      });
      if (collect) updatePickups(DT);
      state.mode = "paused";
      render();
      return true;
    },
    setupShieldAbsorbCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 220;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.player.shieldHits = 3;
      state.player.shieldFlashT = 0;
      state.enemyBullets.push({
        x: state.player.x + state.player.w * 0.5,
        y: state.player.y + state.player.h * 0.45,
        vx: -80,
        vy: 0,
        r: 2.5 * BULLET_RADIUS_SCALE,
        ttl: 1,
        dmg: 12,
        color: "#ff5969",
      });
      resolveCombat();
      state.mode = "paused";
      render();
      return true;
    },
    setupCrouchCheck() {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 460;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.crouching = true;
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.aimX = 1;
      state.player.aimY = 0;
      state.mode = "paused";
      render();
      return true;
    },
    setupCrouchAimLockCheck(mode = "forward", face = 1, firing = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 220;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.crouching = false;
      state.player.face = face;
      state.player.visualFace = face;
      state.player.aimX = face;
      state.player.aimY = 0;
      state.player.debugAimLock = false;
      state.player.muzzleFlashT = 0;
      state.player.fireCd = 0;
      keys.KeyX = true;
      keys.ArrowDown = true;
      if (mode === "up" || mode === "diag") keys.ArrowUp = true;
      if (mode === "forward" || mode === "diag") {
        if (face > 0) keys.ArrowRight = true;
        else keys.ArrowLeft = true;
      }
      if (firing) keys.KeyZ = true;
      updatePlayer(DT);
      keys.KeyX = false;
      keys.ArrowDown = false;
      keys.ArrowUp = false;
      keys.ArrowRight = false;
      keys.ArrowLeft = false;
      keys.KeyZ = false;
      state.mode = "paused";
      render();
      return true;
    },
    setupUpPoseCheck(face = 1, recoil = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 460;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = face;
      state.player.visualFace = face;
      state.player.aimX = 0;
      state.player.aimY = -1;
      state.player.muzzleFlashT = recoil ? 0.08 : 0;
      state.mode = "paused";
      render();
      return true;
    },
    setupDiagPoseCheck(face = 1, recoil = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 320;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 32;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = face;
      state.player.visualFace = face;
      state.player.aimX = face * 0.72;
      state.player.aimY = -0.72;
      state.player.muzzleFlashT = recoil ? 0.08 : 0;
      state.mode = "paused";
      render();
      return true;
    },
    setupScaleCheck(aimMode = "forward") {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 2720;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.crouching = false;
      state.player.climbing = false;
      state.player.hanging = false;
      state.player.muzzleFlashT = 0;
      state.player.aimX = aimMode === "up" ? 0 : 1;
      state.player.aimY = aimMode === "up" ? -1 : 0;
      spawnEnemy({ t: "trooper", x: 2840, surfaceY: terrainY(2854), variant: "olive" });
      state.cameraX = clamp(state.player.x - 180, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.45, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupGroundAimLockDiagCheck(face = 1, firing = false) {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 220;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.crouching = false;
      state.player.face = face;
      state.player.visualFace = face;
      state.player.aimX = face;
      state.player.aimY = 0;
      state.player.debugAimLock = false;
      state.player.muzzleFlashT = 0;
      state.player.fireCd = 0;
      keys.KeyX = true;
      keys.ArrowUp = true;
      if (face > 0) keys.ArrowRight = true;
      else keys.ArrowLeft = true;
      if (firing) keys.KeyZ = true;
      updatePlayer(DT);
      keys.KeyX = false;
      keys.ArrowUp = false;
      keys.ArrowRight = false;
      keys.ArrowLeft = false;
      keys.KeyZ = false;
      state.mode = "paused";
      render();
      return true;
    },
    setupTurnBlendCheck() {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 220;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = -1;
      state.player.visualFace = -0.18;
      state.player.aimX = 1;
      state.player.aimY = 0;
      state.mode = "paused";
      render();
      return true;
    },
    setupJumpAimCheck(face = 1, aimMode = "diag", recoil = true) {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 220;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h - 96;
      state.player.vx = face * 120;
      state.player.vy = -160;
      state.player.onGround = false;
      state.player.supportType = null;
      state.player.airT = 0.34;
      state.player.face = face;
      state.player.visualFace = face;
      if (aimMode === "up") {
        state.player.aimX = 0;
        state.player.aimY = -1;
      } else if (aimMode === "downDiag") {
        state.player.aimX = face * 0.72;
        state.player.aimY = 0.72;
      } else if (aimMode === "down") {
      state.player.aimX = -0.72;
      state.player.aimY = 0.72;
      } else {
        state.player.aimX = face * 0.72;
        state.player.aimY = -0.72;
      }
      state.player.muzzleFlashT = recoil ? 0.08 : 0;
      state.mode = "paused";
      render();
      return true;
    },
    setupDownPoseCheck(face = 1, airborne = false, recoil = false) {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 220;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h - (airborne ? 84 : 0);
      state.player.vx = airborne ? face * 36 : 0;
      state.player.vy = airborne ? 90 : 0;
      state.player.onGround = !airborne;
      state.player.supportType = airborne ? null : "terrain";
      state.player.crouching = false;
      state.player.face = face;
      state.player.visualFace = face;
      state.player.aimX = face * 0.72;
      state.player.aimY = 0.72;
      state.player.airT = airborne ? 0.24 : 0;
      state.player.muzzleFlashT = recoil ? 0.08 : 0;
      state.mode = "paused";
      render();
      return true;
    },
    setupClimbAimCheck(mode = "diag", facing = 1, firing = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const desiredSide = facing > 0 ? "left" : "right";
      const climb = levelClimbables().find((item) => (item.side || "left") === desiredSide) || levelClimbables()[0];
      state.player.x = climb.x + climb.w * 0.5 - state.player.w * 0.5;
      state.player.y = climb.y + 56;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = false;
      state.player.supportType = "climb";
      state.player.climbing = true;
      state.player.climbId = climb.id;
      const validMode = mode === "up" || mode === "diag" || mode === "forward" || (mode === "downDiag" && facing > 0);
      state.player.climbCombat = firing && validMode;
      state.player.climbMoving = false;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.player.weapon = "LASER";
      state.player.bag.LASER.unlocked = true;
      state.player.bag.LASER.level = 2;
      state.player.bag.LASER.ammo = Infinity;
      state.player.face = facing;
      state.player.visualFace = facing;
      state.player.climbAimMode = validMode ? mode : "forward";
      if (mode === "up") {
        state.player.aimX = 0;
        state.player.aimY = -1;
      } else if (mode === "downDiag") {
        state.player.aimX = facing * 0.72;
        state.player.aimY = 0.72;
      } else if (mode === "forward") {
        state.player.aimX = facing;
        state.player.aimY = 0;
      } else {
        state.player.aimX = facing * 0.72;
        state.player.aimY = -0.72;
      }
      if (!validMode) {
        state.player.aimX = facing;
        state.player.aimY = 0;
      }
      state.player.muzzleFlashT = firing && validMode ? 0.1 : 0;
      state.player.fireCd = 0;
      if (firing && validMode) {
        spawnPlayerBullets();
      }
      state.cameraX = clamp(state.player.x - W * 0.34, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.48, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupClimbMotionCheck(moving = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const climb = levelClimbables()[0];
      state.player.x = climb.x + climb.w * 0.5 - state.player.w * 0.5;
      state.player.y = climb.y + 68;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = false;
      state.player.supportType = "climb";
      state.player.climbing = true;
      state.player.climbId = climb.id;
      state.player.climbCombat = false;
      state.player.climbAimMode = "forward";
      state.player.climbMoving = moving;
      state.player.hanging = false;
      state.player.hangId = null;
      state.player.hangCombat = false;
      state.player.hangMoving = false;
      state.player.crouching = false;
      state.player.prone = false;
      state.player.debugAimLock = false;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.player.face = getClimbFacingSign(climb);
      state.player.visualFace = state.player.face;
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.aimX = 1;
      state.player.aimY = 0;
      state.cameraX = clamp(state.player.x - W * 0.34, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.48, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupHangAimCheck(mode = "diag", aimLock = true) {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const hang = levelHangables()[0];
      state.player.x = hang.x + hang.w * 0.35 - state.player.w * 0.5;
      state.player.y = getHangAttachY(hang);
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = false;
      state.player.supportType = "hang";
      state.player.hanging = true;
      state.player.hangId = hang.id;
      state.player.hangCombat = true;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.hangAimMode = mode;
      if (mode === "up") {
        state.player.aimX = 0;
        state.player.aimY = -1;
      } else if (mode === "downDiag") {
        state.player.aimX = 0.72;
        state.player.aimY = 0.72;
      } else if (mode === "down") {
        state.player.aimX = 0;
        state.player.aimY = 1;
      } else if (mode === "forward") {
        state.player.aimX = 1;
        state.player.aimY = 0;
      } else {
        state.player.aimX = 0.72;
        state.player.aimY = -0.72;
      }
      state.player.debugAimLock = aimLock;
      state.cameraX = clamp(state.player.x - W * 0.34, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.48, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupHangMotionCheck(moving = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const hang = levelHangables()[0];
      state.player.x = hang.x + hang.w * 0.32 - state.player.w * 0.5;
      state.player.y = getHangAttachY(hang);
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = false;
      state.player.supportType = "hang";
      state.player.hanging = true;
      state.player.hangId = hang.id;
      state.player.hangCombat = false;
      state.player.hangAimMode = "forward";
      state.player.hangMoving = moving;
      state.player.climbing = false;
      state.player.climbId = null;
      state.player.climbCombat = false;
      state.player.climbMoving = false;
      state.player.crouching = false;
      state.player.prone = false;
      state.player.debugAimLock = false;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.aimX = 1;
      state.player.aimY = 0;
      state.cameraX = clamp(state.player.x - W * 0.34, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.48, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupHangDropCheck() {
      this.setupHangAimCheck("forward", false);
      debugHidePauseOverlay = true;
      state.mode = "playing";
      render();
      return true;
    },
    setupProneCheck(firing = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 180;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.crouching = false;
      state.player.prone = true;
      state.player.climbing = false;
      state.player.climbId = null;
      state.player.climbCombat = false;
      state.player.climbMoving = false;
      state.player.hanging = false;
      state.player.hangId = null;
      state.player.hangCombat = false;
      state.player.hangMoving = false;
      state.player.debugAimLock = false;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.aimX = 1;
      state.player.aimY = 0;
      state.player.muzzleFlashT = firing ? 0.1 : 0;
      state.player.fireCd = 0;
      state.cameraX = clamp(state.player.x - W * 0.34, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.48, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupCheckpointCheck(index = 0) {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const checkpoint = levelCheckpoints()[index];
      state.player.x = checkpoint.x + 14;
      state.player.y = checkpoint.y;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = checkpoint.support || "platform";
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.player.face = 1;
      state.player.visualFace = 1;
      state.cameraX = clamp(state.player.x - W * 0.34, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.48, levelTop(), Math.max(levelTop(), levelHeight() - H));
      updateFlow(DT);
      state.mode = "paused";
      render();
      return true;
    },
    setupLevelSectionCheck(levelIndex = 0, checkpointIndex = 0) {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(levelIndex, false);
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const checkpoint = levelCheckpoints()[checkpointIndex] || levelCheckpoints()[0];
      if (!checkpoint) return false;
      state.player.x = checkpoint.x + 14;
      state.player.y = checkpoint.y;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = checkpoint.support || "platform";
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.player.face = 1;
      state.player.visualFace = 1;
      state.cameraX = clamp(state.player.x - W * 0.34, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.48, levelTop(), Math.max(levelTop(), levelHeight() - H));
      updateFlow(DT);
      state.mode = "paused";
      render();
      return true;
    },
    setupObjectivePropCheck(levelIndex = 0, objectiveIndex = 0) {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(levelIndex, false);
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const objective = state.objectives[objectiveIndex] || state.objectives[0];
      if (!objective) return false;
      state.player.x = Math.max(72, objective.x - 240);
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.cameraX = clamp(objective.x - W * 0.38, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(objective.y - H * 0.54, levelTop(), Math.max(levelTop(), levelHeight() - H));
      state.mode = "paused";
      render();
      return true;
    },
    setupObjectiveDeathCheck(levelIndex = 0, objectiveIndex = 0, progress = 0.68) {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(levelIndex, false);
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.objectiveDeaths = [];
      const objective = state.objectives[objectiveIndex] || state.objectives[0];
      if (!objective) return false;
      state.player.x = Math.max(72, objective.x - 240);
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.cameraX = clamp(objective.x - W * 0.38, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(objective.y - H * 0.54, levelTop(), Math.max(levelTop(), levelHeight() - H));
      destroyObjective(objective, "bullet");
      const seq = getObjectiveDeathSequence(objective.id);
      if (seq) {
        const target = seq.duration * clamp(progress, 0, 1);
        let remaining = target;
        while (remaining > 0) {
          const slice = Math.min(DT, remaining);
          step(slice);
          remaining -= slice;
        }
      }
      state.mode = "paused";
      render();
      return true;
    },
    setupCrateDestroyCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(0, false);
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const crate = (state.level?.obstacles || []).find((obstacle) => obstacle.kind === "crate");
      if (!crate) return false;
      state.player.x = Math.max(72, crate.x - 140);
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.cameraX = clamp(crate.x - W * 0.34, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(crate.y - H * 0.56, levelTop(), Math.max(levelTop(), levelHeight() - H));
      for (let i = 0; i < 10; i++) {
        state.bullets.push({
          x: crate.x + 6,
          y: crate.y + crate.h * 0.5,
          vx: 0,
          vy: 0,
          r: 2.35 * BULLET_RADIUS_SCALE,
          ttl: 0.2,
          dmg: WEAPONS.RIFLE.dmg[0],
          color: WEAPONS.RIFLE.color,
          weapon: "RIFLE",
          pierce: 1,
        });
        updateBullets(0);
      }
      for (let i = 0; i < 8; i++) updateExplosions(DT);
      state.mode = "paused";
      render();
      return true;
    },
    setupTowerAscentCheck(stage = "mid") {
      clearSay();
      debugHidePauseOverlay = true;
      resetLevel(1, false);
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      if (stage === "summit") {
        state.player.x = 5636;
        state.player.y = -848 - state.player.h;
      } else if (stage === "roof") {
        state.player.x = 6500;
        state.player.y = -848 - state.player.h;
      } else {
        state.player.x = 5636;
        state.player.y = -304 - state.player.h;
      }
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "platform";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.cameraX = clamp(state.player.x - W * 0.36, 0, Math.max(0, state.level.length - W));
      state.cameraY = clamp(state.player.y - H * 0.5, levelTop(), Math.max(levelTop(), levelHeight() - H));
      updateFlow(DT);
      state.mode = "paused";
      render();
      return true;
    },
    setupVerticalScrollCheck() {
      return this.setupTowerAscentCheck("mid");
    },
    setupEnemyRecoilCheck() {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 520;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = -1;
      state.player.visualFace = -1;
      state.player.aimX = -1;
      state.player.aimY = 0;
      state.enemies.push({
        kind: "trooper",
        variant: "olive",
        x: 332,
        y: terrainY(346) - 44,
        w: 28,
        h: 44,
        hp: 88,
        maxHp: 88,
        dir: 1,
        attackT: 0.34,
        shotAimX: 0.96,
        shotAimY: -0.22,
      });
      state.mode = "paused";
      render();
      return true;
    },
    setupDroneCheck(attacking = false) {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 200;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      state.enemies.push({
        kind: "drone",
        x: 430,
        y: 228,
        w: 34,
        h: 24,
        baseY: 228,
        hp: 56,
        maxHp: 56,
        speed: 112,
        wave: 0.2,
        fireCd: 0.6,
        attackT: attacking ? 0.22 : 0,
        shotAimX: -0.96,
        shotAimY: 0.08,
      });
      state.mode = "paused";
      render();
      return true;
    },
    setupBossStyleCheck(style = "giantskull") {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 170;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      state.player.hp = state.player.maxHp;
      state.player.invuln = 0;
      const bossDims = BOSS_STYLE_DIMS[style] || BOSS_STYLE_DIMS.cyberbrute;
      state.enemies.push({
        kind: "boss",
        spriteStyle: style,
        bossName: style,
        x: 430,
        y: terrainY(480) - bossDims.h,
        w: bossDims.w,
        h: bossDims.h,
        hp: 1600,
        maxHp: 1600,
        dir: -1,
        vx: 0,
        attackT: 0.24,
        shotAimX: -0.92,
        shotAimY: -0.1,
      });
      state.mode = "paused";
      render();
      return true;
    },
    setupMechStyleCheck(style = "crawler") {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 170;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      const mechDims = MECH_STYLE_DIMS[style] || MECH_STYLE_DIMS.crawler;
      state.enemies.push({
        kind: "mech",
        spriteStyle: style,
        x: 420,
        y: terrainY(450) - mechDims.h,
        w: mechDims.w,
        h: mechDims.h,
        hp: 290,
        maxHp: 290,
        dir: -1,
        vx: 0,
        attackT: 0.24,
        shotAimX: -0.88,
        shotAimY: -0.08,
      });
      state.mode = "paused";
      render();
      return true;
    },
    setupTrooperRespawnCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.respawnQueue = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 180;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      spawnEnemy({ t: "trooper", id: "debug-respawn", x: 372, surfaceY: terrainY(386), variant: "crimson", respawnAfter: TROOPER_RESPAWN_DELAY });
      const enemy = state.enemies[0];
      spawnTrooperCorpse(enemy, { vx: 220, vy: -40 });
      scheduleTrooperRespawn(enemy);
      state.enemies = [];
      let remaining = TROOPER_RESPAWN_DELAY + 0.2;
      while (remaining > 0) {
        const slice = Math.min(DT, remaining);
        step(slice);
        remaining -= slice;
      }
      state.mode = "paused";
      render();
      return true;
    },
    setupCorpseStackCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.respawnQueue = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 190;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      const baseEnemy = { kind: "trooper", variant: "crimson", x: 356, y: terrainY(370) - 44, w: 28, h: 44, dir: -1, attackT: 0 };
      spawnTrooperCorpse(baseEnemy, { vx: 80, vy: -30 });
      const baseCorpse = state.corpses[state.corpses.length - 1];
      baseCorpse.x = 360;
      baseCorpse.y = supportYForBody(baseCorpse);
      baseCorpse.vx = 0;
      baseCorpse.vy = 0;
      baseCorpse.vr = 0;
      baseCorpse.rot = 0;
      baseCorpse.landed = true;
      baseCorpse.poolT = baseCorpse.poolTarget;
      const topEnemy = { kind: "trooper", variant: "olive", x: 362, y: baseCorpse.y - 112, w: 28, h: 44, dir: -1, attackT: 0 };
      spawnTrooperCorpse(topEnemy, { vx: 18, vy: -10 });
      const topCorpse = state.corpses[state.corpses.length - 1];
      topCorpse.x = 362;
      topCorpse.y = baseCorpse.y - 112;
      topCorpse.vx = 12;
      topCorpse.vy = 0;
      topCorpse.rot = 0.08;
      topCorpse.vr = 0.42;
      for (let i = 0; i < 120; i++) updateAftermath(DT);
      state.mode = "paused";
      render();
      return true;
    },
    setupBloodCheck() {
      clearSay();
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      const enemy = {
        kind: "trooper",
        variant: "crimson",
        x: 360,
        y: terrainY(374) - 44,
        w: 28,
        h: 44,
        dir: -1,
        attackT: 0,
      };
      spawnTrooperCorpse(enemy, { vx: 380, vy: -40 });
      for (let i = 0; i < 44; i++) updateAftermath(1 / 60);
      state.mode = "paused";
      render();
      return true;
    },
    setupAudioDuckCheck() {
      clearSay();
      debugHidePauseOverlay = true;
      state.mode = "playing";
      state.enemies = [];
      state.pending = [];
      state.objectives = [];
      state.pickups = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.explosions = [];
      state.corpses = [];
      state.bloodParticles = [];
      state.player.x = 170;
      state.player.y = terrainY(state.player.x + state.player.w * 0.5) - state.player.h;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.supportType = "terrain";
      state.player.face = 1;
      state.player.visualFace = 1;
      unlockAudio();
      playStageMusic(0, true);
      triggerMusicDuck(0.34, 0.18, 4.2, 24);
      updateAudio(1 / 30);
      state.mode = "paused";
      render();
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

  async function loadEnvironmentArt() {
    const entries = Object.entries(ENV_ART_MANIFEST);
    await Promise.all(entries.map(([key, file]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        environmentImages.set(key, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `./assets/sprites/${file}`;
    })));
  }

  async function loadSprites() {
    spritesReady = false;
    try {
      await loadEnvironmentArt();
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
    } finally {
      spritesReady = true;
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
  initAudio();
  loadSprites();
  if (DEBUG_SCENARIO) {
    Promise.resolve().then(() => {
      if (state.mode === "splash") startCampaign();
    });
  }
  requestAnimationFrame(loop);
})();
