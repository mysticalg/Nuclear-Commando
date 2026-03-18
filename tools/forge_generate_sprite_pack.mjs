#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FRAME_COUNTS = {
  player_idle: 6,
  player_run: 8,
  player_jump: 2,
  player_crouch: 2,
  player_roll: 4,
  enemy_trooper: 6,
  enemy_drone: 4,
  enemy_turret: 3,
  enemy_mech: 6,
  objective_centrifuge: 2,
  objective_factory: 2,
  objective_reactor: 3,
  objective_radar: 2,
  pickup_med: 3,
  pickup_spread: 3,
  pickup_laser: 3,
  pickup_flame: 3,
  fx_muzzle_flash: 3,
  fx_explosion: 6,
};

function parseArgs(argv) {
  const args = {
    host: process.env.FORGE_HOST || "http://127.0.0.1:7860",
    apiPath: "/sdapi/v1/txt2img",
    img2imgPath: "/sdapi/v1/img2img",
    model: process.env.FORGE_MODEL || "",
    pack: "tools/comfyui/sprite_prompt_pack.json",
    out: "assets/sprites/generated_forge",
    guideDir: "assets/sprites/png16_frames",
    guideCacheDir: "assets/sprites/_forge_guides",
    width: 1024,
    height: 1024,
    steps: 30,
    cfg: 6.5,
    sampler: "DPM++ 2M SDE",
    seed: Date.now(),
    retries: 2,
    timeoutMs: 180000,
    importToManifest: true,
    overwrite: false,
    dryRun: false,
    limit: 0,
    basePrompt: "",
    negativePrompt: "",
    includeNegative: true,
    expandFrames: true,
    framePrefix: "single isolated video game sprite frame, exactly one subject only, centered composition, full silhouette visible",
    extraPrompt: "",
    postprocess: true,
    strictPrompts: true,
    useGuides: true,
    denoise: 0.34,
    stepsProvided: false,
    cfgProvided: false,
    samplerProvided: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--host" && next) {
      args.host = next;
      i += 1;
    } else if (arg === "--api-path" && next) {
      args.apiPath = next;
      i += 1;
    } else if (arg === "--img2img-path" && next) {
      args.img2imgPath = next;
      i += 1;
    } else if (arg === "--model" && next) {
      args.model = next;
      i += 1;
    } else if (arg === "--pack" && next) {
      args.pack = next;
      i += 1;
    } else if (arg === "--out" && next) {
      args.out = next;
      i += 1;
    } else if (arg === "--guide-dir" && next) {
      args.guideDir = next;
      i += 1;
    } else if (arg === "--guide-cache-dir" && next) {
      args.guideCacheDir = next;
      i += 1;
    } else if (arg === "--width" && next) {
      args.width = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--height" && next) {
      args.height = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--steps" && next) {
      args.steps = Number.parseInt(next, 10);
      args.stepsProvided = true;
      i += 1;
    } else if (arg === "--cfg" && next) {
      args.cfg = Number.parseFloat(next);
      args.cfgProvided = true;
      i += 1;
    } else if (arg === "--sampler" && next) {
      args.sampler = next;
      args.samplerProvided = true;
      i += 1;
    } else if (arg === "--seed" && next) {
      args.seed = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--retries" && next) {
      args.retries = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--timeout-ms" && next) {
      args.timeoutMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--limit" && next) {
      args.limit = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--base-prompt" && next) {
      args.basePrompt = next;
      i += 1;
    } else if (arg === "--negative-prompt" && next) {
      args.negativePrompt = next;
      i += 1;
    } else if (arg === "--extra-prompt" && next) {
      args.extraPrompt = next;
      i += 1;
    } else if (arg === "--frame-prefix" && next) {
      args.framePrefix = next;
      i += 1;
    } else if (arg === "--denoise" && next) {
      args.denoise = Number.parseFloat(next);
      i += 1;
    } else if (arg === "--no-import") {
      args.importToManifest = false;
    } else if (arg === "--overwrite") {
      args.overwrite = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--no-negative") {
      args.includeNegative = false;
    } else if (arg === "--no-expand-frames") {
      args.expandFrames = false;
    } else if (arg === "--no-postprocess") {
      args.postprocess = false;
    } else if (arg === "--no-strict-prompts") {
      args.strictPrompts = false;
    } else if (arg === "--no-guides") {
      args.useGuides = false;
    }
  }

  applyModelDefaults(args);
  return args;
}

function applyModelDefaults(args) {
  const model = String(args.model || "").toLowerCase();
  if (!model.includes("turbo")) return;
  if (!args.stepsProvided) args.steps = 6;
  if (!args.cfgProvided) args.cfg = 1.8;
  if (!args.samplerProvided) args.sampler = "Euler a";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function validateArgs(args, pack) {
  if (!Array.isArray(pack?.sprites) || pack.sprites.length === 0) {
    throw new Error("Prompt pack has no sprite entries.");
  }
  if (!Number.isFinite(args.width) || args.width <= 0) {
    throw new Error("--width must be a positive number.");
  }
  if (!Number.isFinite(args.height) || args.height <= 0) {
    throw new Error("--height must be a positive number.");
  }
  if (!Number.isFinite(args.denoise) || args.denoise < 0 || args.denoise > 1) {
    throw new Error("--denoise must be between 0 and 1.");
  }
}

function normalizedHost(host, apiPath) {
  const h = host.replace(/\/+$/, "");
  if (apiPath.startsWith("http://") || apiPath.startsWith("https://")) {
    return apiPath;
  }
  const p = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${h}${p}`;
}

function frameMotionHint(base, index, count) {
  if (base.includes("run") || base.includes("trooper") || base.includes("mech")) {
    return `walk/run cycle phase ${index + 1}/${count}`;
  }
  if (base.includes("jump")) {
    return `airborne jump arc phase ${index + 1}/${count}`;
  }
  if (base.includes("roll")) {
    return `combat roll spin phase ${index + 1}/${count}`;
  }
  if (base.includes("drone")) {
    return `hover rotor cycle phase ${index + 1}/${count}`;
  }
  if (base.includes("turret")) {
    return `recoil/idle motion phase ${index + 1}/${count}`;
  }
  if (base.includes("objective") || base.includes("pickup")) {
    return `status pulse phase ${index + 1}/${count}`;
  }
  if (base.includes("muzzle")) {
    return `muzzle flash burst phase ${index + 1}/${count}`;
  }
  if (base.includes("explosion")) {
    return `explosion growth phase ${index + 1}/${count}`;
  }
  return `animation phase ${index + 1}/${count}`;
}

function subjectPromptDiscipline(base) {
  if (base.startsWith("player_") || base === "enemy_trooper" || base === "enemy_mech") {
    return "exactly one full body character only, no duplicate figures, no turnaround sheet, no extra poses, no side thumbnails, no crowd";
  }
  if (base === "enemy_drone" || base === "enemy_turret") {
    return "exactly one machine subject only, isolated, no duplicate machines, no exploded diagram, no multi view layout";
  }
  if (base.startsWith("objective_")) {
    return "exactly one destructible base object only, isolated, centered, no environment scene, no extra props, no panel layout";
  }
  if (base.startsWith("pickup_") || base.startsWith("fx_")) {
    return "exactly one small game pickup or effect only, isolated, centered, no duplicates, no icon sheet, no UI atlas";
  }
  return "exactly one subject only, isolated, centered";
}

function backgroundPromptDiscipline() {
  return "plain flat off white studio backdrop, no floor line, no cast shadow, no gradient, no room, no cave, no scenery";
}

function spriteStylePrompt(base) {
  if (base.startsWith("pickup_") || base.startsWith("fx_")) {
    return "clean retro SNES game icon, bold outline, readable silhouette, crisp shading";
  }
  if (base.startsWith("objective_")) {
    return "SNES industrial sprite, crisp outline, readable shape language, compact pixel-art inspired shading";
  }
  return "SNES 16-bit side-scroller sprite, crisp black outline, readable limbs, compact cel shading, no painterly detail";
}

function dimensionsFor(base, args) {
  if (base.startsWith("player_") || base === "enemy_trooper") {
    return { width: 640, height: 896 };
  }
  if (base === "enemy_mech") {
    return { width: 768, height: 896 };
  }
  if (base.startsWith("objective_")) {
    return { width: 896, height: 640 };
  }
  if (base.startsWith("pickup_") || base.startsWith("fx_")) {
    return { width: 512, height: 512 };
  }
  return { width: args.width, height: args.height };
}

function inferKind(base) {
  if (base.startsWith("player_") || base === "enemy_trooper" || base === "enemy_mech") {
    return "character";
  }
  if (base.startsWith("objective_")) {
    return "objective";
  }
  if (base.startsWith("pickup_") || base.startsWith("fx_")) {
    return "icon";
  }
  return "object";
}

function guideCandidates(job) {
  const keys = [];
  keys.push(job.key);
  if (job.base) {
    keys.push(`${job.base}_hd`);
    keys.push(`${job.base}_0_hd`);
  }
  return [...new Set(keys)];
}

function findGuideSource(job, args) {
  if (!args.useGuides) return null;
  const root = path.resolve(args.guideDir);
  if (!fs.existsSync(root)) return null;
  for (const key of guideCandidates(job)) {
    const candidate = path.join(root, `${key}.png`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function prepareGuideImage(sourcePath, job, args) {
  const scriptPath = path.resolve("tools/prepare_forge_guides.py");
  const pythonCmd = process.env.FORGE_POSTPROCESS_PYTHON || "python";
  const outDir = path.resolve(args.guideCacheDir);
  ensureDir(outDir);
  const outPath = path.join(outDir, `${job.key}.png`);
  if (!args.overwrite && fs.existsSync(outPath)) {
    return outPath;
  }
  const run = spawnSync(
    pythonCmd,
    [
      scriptPath,
      "--src", sourcePath,
      "--out", outPath,
      "--width", String(job.width),
      "--height", String(job.height),
      "--kind", inferKind(job.base),
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  if (run.status !== 0) {
    throw new Error(`Guide preparation failed for ${job.key}: ${(run.stderr || run.stdout || "").trim()}`);
  }
  return outPath;
}

function encodePngDataUrl(filePath) {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function buildTxt2ImgPayload(job, args, negativePrompt, seed) {
  return {
    prompt: job.prompt,
    negative_prompt: args.includeNegative ? negativePrompt : "",
    steps: args.steps,
    cfg_scale: args.cfg,
    width: job.width,
    height: job.height,
    sampler_name: args.sampler,
    seed,
    batch_size: 1,
    n_iter: 1,
    save_images: false,
    send_images: true,
    do_not_save_grid: true,
    do_not_save_samples: true,
    restore_faces: false,
    override_settings: args.model ? { sd_model_checkpoint: args.model } : {},
    override_settings_restore_afterwards: true,
  };
}

function buildImg2ImgPayload(job, args, negativePrompt, seed, guidePath) {
  const guidedPrompt = [
    job.prompt,
    "preserve the exact subject count, pose, silhouette, weapon placement, and framing from the provided source sprite guide",
    "do not invent extra props, scenery, panels, or alternate poses",
  ].filter(Boolean).join(", ");
  return {
    init_images: [encodePngDataUrl(guidePath)],
    prompt: guidedPrompt,
    negative_prompt: args.includeNegative ? negativePrompt : "",
    denoising_strength: args.denoise,
    resize_mode: 0,
    steps: args.steps,
    cfg_scale: args.cfg,
    width: job.width,
    height: job.height,
    sampler_name: args.sampler,
    seed,
    batch_size: 1,
    n_iter: 1,
    save_images: false,
    send_images: true,
    do_not_save_grid: true,
    do_not_save_samples: true,
    include_init_images: false,
    restore_faces: false,
    override_settings: args.model ? { sd_model_checkpoint: args.model } : {},
    override_settings_restore_afterwards: true,
  };
}

function buildJobs(pack, args) {
  const basePrompt = args.basePrompt || pack.basePrompt || "";
  const negativePrompt = args.negativePrompt || pack.negativePrompt || "";
  const promptByBase = new Map();
  for (const sprite of pack.sprites) {
    const key = String(sprite.key || "").trim();
    const prompt = String(sprite.prompt || "").trim();
    if (!key || !prompt) continue;
    const base = key.endsWith("_hd") ? key.slice(0, -3) : key;
    promptByBase.set(base, prompt);
  }

  const jobs = [];
  const seen = new Set();

  function addJob(key, prompt, isFrame = false, frameIndex = 0, frameCount = 1) {
    if (seen.has(key)) return;
    seen.add(key);
    const base = key.endsWith("_hd") ? key.slice(0, -3).replace(/_\d+$/, "") : key.replace(/_\d+$/, "");
    const dims = dimensionsFor(base, args);
    jobs.push({ key, prompt, isFrame, frameIndex, frameCount, width: dims.width, height: dims.height, base });
  }

  if (args.expandFrames) {
    for (const [base, frameCount] of Object.entries(FRAME_COUNTS)) {
      const spritePrompt = promptByBase.get(base);
      if (!spritePrompt) continue;
      for (let i = 0; i < frameCount; i += 1) {
        const key = `${base}_${i}_hd`;
        const frameHint = frameMotionHint(base, i, frameCount);
        const prompt = [
          basePrompt,
          args.framePrefix,
          args.strictPrompts ? spriteStylePrompt(base) : "",
          args.strictPrompts ? subjectPromptDiscipline(base) : "",
          args.strictPrompts ? backgroundPromptDiscipline() : "",
          spritePrompt,
          frameHint,
          args.extraPrompt,
        ].filter(Boolean).join(", ");
        addJob(key, prompt, true, i, frameCount);
      }
      const baseKey = `${base}_hd`;
      const fallbackPrompt = [
        basePrompt,
        args.strictPrompts ? spriteStylePrompt(base) : "",
        args.strictPrompts ? subjectPromptDiscipline(base) : "",
        args.strictPrompts ? backgroundPromptDiscipline() : "",
        spritePrompt,
        args.extraPrompt,
      ].filter(Boolean).join(", ");
      addJob(baseKey, fallbackPrompt, false, 0, frameCount);
    }
  }

  for (const sprite of pack.sprites) {
    const key = String(sprite.key || "").trim();
    const base = key.endsWith("_hd") ? key.slice(0, -3) : key;
    const prompt = [
      basePrompt,
      args.strictPrompts ? spriteStylePrompt(base) : "",
      args.strictPrompts ? subjectPromptDiscipline(base) : "",
      args.strictPrompts ? backgroundPromptDiscipline() : "",
      sprite.prompt || "",
      args.extraPrompt,
    ].filter(Boolean).join(", ");
    if (key) addJob(key, prompt);
  }

  const limited = args.limit > 0 ? jobs.slice(0, args.limit) : jobs;
  return { jobs: limited, negativePrompt };
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function txt2img(endpoint, payload, retries, timeoutMs) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        timeoutMs,
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 800)}`);
      }
      const data = await res.json();
      if (!Array.isArray(data.images) || data.images.length === 0) {
        throw new Error("Forge returned no images.");
      }
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

function saveBase64Png(base64Text, targetPath) {
  const clean = base64Text.includes(",") ? base64Text.split(",", 2)[1] : base64Text;
  const bytes = Buffer.from(clean, "base64");
  fs.writeFileSync(targetPath, bytes);
}

function importSprites(outDir) {
  const importerPath = path.resolve("tools/import_comfyui_sprites.mjs");
  const run = spawnSync(process.execPath, [importerPath, "--from", outDir, "--replace-existing"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (run.status !== 0) {
    throw new Error("Manifest import failed.");
  }
}

function postprocessSprites(outDir) {
  const scriptPath = path.resolve("tools/postprocess_forge_sprites.py");
  const pythonCmd = process.env.FORGE_POSTPROCESS_PYTHON || "python";
  const run = spawnSync(pythonCmd, [scriptPath, "--dir", outDir], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (run.status !== 0) {
    throw new Error("Forge sprite postprocess step failed.");
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const packPath = path.resolve(args.pack);
  const outDir = path.resolve(args.out);
  const endpoint = normalizedHost(args.host, args.apiPath);
  const img2imgEndpoint = normalizedHost(args.host, args.img2imgPath);

  ensureDir(outDir);
  const pack = readJson(packPath);
  validateArgs(args, pack);
  const { jobs, negativePrompt } = buildJobs(pack, args);

  const report = {
    createdAt: new Date().toISOString(),
    endpoint,
    model: args.model || null,
    width: args.width,
    height: args.height,
    steps: args.steps,
    cfg: args.cfg,
    sampler: args.sampler,
    expandFrames: args.expandFrames,
    dryRun: args.dryRun,
    generated: [],
    skipped: [],
    failed: [],
  };

  console.log(`Forge endpoint: ${endpoint}`);
  console.log(`Jobs: ${jobs.length}`);

  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const outputPath = path.join(outDir, `${job.key}.png`);
    if (!args.overwrite && fs.existsSync(outputPath)) {
      console.log(`[skip] ${job.key} already exists`);
      report.skipped.push(job.key);
      continue;
    }

    const seed = Number.isFinite(args.seed) ? args.seed + i : Math.floor(Math.random() * 1000000000);

    if (args.dryRun) {
      console.log(`[dry-run] ${job.key}`);
      report.generated.push({ key: job.key, seed, dryRun: true });
      continue;
    }

    try {
      const guideSource = findGuideSource(job, args);
      const guidePath = guideSource ? prepareGuideImage(guideSource, job, args) : null;
      const payload = guidePath
        ? buildImg2ImgPayload(job, args, negativePrompt, seed, guidePath)
        : buildTxt2ImgPayload(job, args, negativePrompt, seed);
      const targetEndpoint = guidePath ? img2imgEndpoint : endpoint;
      console.log(`[gen] ${job.key}${guidePath ? " [guided]" : ""}`);
      const data = await txt2img(targetEndpoint, payload, args.retries, args.timeoutMs);
      saveBase64Png(data.images[0], outputPath);
      report.generated.push({ key: job.key, outputPath, seed, width: job.width, height: job.height, guided: !!guidePath });
      console.log(`[ok] ${job.key} -> ${outputPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.failed.push({ key: job.key, message, seed });
      console.error(`[fail] ${job.key}: ${message}`);
    }
  }

  const reportPath = path.join(outDir, "_forge_report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report written: ${reportPath}`);

  if (!args.dryRun && args.postprocess && report.generated.length > 0) {
    console.log("Postprocessing generated Forge sprites...");
    postprocessSprites(outDir);
  }

  if (!args.dryRun && args.importToManifest && report.generated.length > 0) {
    console.log("Importing generated Forge sprites into manifest...");
    importSprites(outDir);
  } else if (args.importToManifest && report.generated.length === 0) {
    console.log("No new sprites generated; skipping manifest import.");
  }

  if (report.failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
