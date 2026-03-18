#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    host: process.env.COMFYUI_HOST || "http://127.0.0.1:8188",
    checkpoint: process.env.COMFYUI_CKPT || "",
    workflow: "tools/comfyui/workflow_sprite_template.json",
    pack: "tools/comfyui/sprite_prompt_pack.json",
    out: "assets/sprites/generated_hd",
    width: 1024,
    height: 1024,
    steps: 28,
    cfg: 6.5,
    sampler: "dpmpp_2m_sde",
    scheduler: "karras",
    denoise: 1,
    baseSeed: Date.now(),
    timeoutMs: 300000,
    pollMs: 1200,
    outputPrefix: "nuclear-commando/sprites",
    importToManifest: true,
    dryRun: false,
    force: false,
    limit: 0,
    basePrompt: "",
    negativePrompt: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--host" && next) {
      args.host = next;
      i += 1;
    } else if (arg === "--checkpoint" && next) {
      args.checkpoint = next;
      i += 1;
    } else if (arg === "--workflow" && next) {
      args.workflow = next;
      i += 1;
    } else if (arg === "--pack" && next) {
      args.pack = next;
      i += 1;
    } else if (arg === "--out" && next) {
      args.out = next;
      i += 1;
    } else if (arg === "--width" && next) {
      args.width = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--height" && next) {
      args.height = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--steps" && next) {
      args.steps = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--cfg" && next) {
      args.cfg = Number.parseFloat(next);
      i += 1;
    } else if (arg === "--sampler" && next) {
      args.sampler = next;
      i += 1;
    } else if (arg === "--scheduler" && next) {
      args.scheduler = next;
      i += 1;
    } else if (arg === "--denoise" && next) {
      args.denoise = Number.parseFloat(next);
      i += 1;
    } else if (arg === "--seed" && next) {
      args.baseSeed = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--timeout-ms" && next) {
      args.timeoutMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--poll-ms" && next) {
      args.pollMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--output-prefix" && next) {
      args.outputPrefix = next;
      i += 1;
    } else if (arg === "--base-prompt" && next) {
      args.basePrompt = next;
      i += 1;
    } else if (arg === "--negative-prompt" && next) {
      args.negativePrompt = next;
      i += 1;
    } else if (arg === "--limit" && next) {
      args.limit = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--no-import") {
      args.importToManifest = false;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--force") {
      args.force = true;
    }
  }

  return args;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findNodeIdByClass(workflow, classType, offset = 0) {
  const matches = Object.entries(workflow)
    .filter(([, node]) => node.class_type === classType)
    .map(([id]) => id);

  if (matches.length <= offset) {
    return null;
  }
  return matches[offset];
}

function requireNode(workflow, classType, offset = 0) {
  const nodeId = findNodeIdByClass(workflow, classType, offset);
  if (!nodeId) {
    throw new Error(`Workflow is missing required node class: ${classType}`);
  }
  return nodeId;
}

function buildWorkflow(template, options) {
  const workflow = deepClone(template);

  const kSamplerId = requireNode(workflow, "KSampler");
  const checkpointId = requireNode(workflow, "CheckpointLoaderSimple");
  const latentId = requireNode(workflow, "EmptyLatentImage");
  const decodeId = requireNode(workflow, "VAEDecode");
  const saveImageId = requireNode(workflow, "SaveImage");

  const kSampler = workflow[kSamplerId];
  const checkpoint = workflow[checkpointId];
  const latent = workflow[latentId];
  const decode = workflow[decodeId];
  const saveImage = workflow[saveImageId];

  checkpoint.inputs.ckpt_name = options.checkpoint;
  latent.inputs.width = options.width;
  latent.inputs.height = options.height;
  latent.inputs.batch_size = 1;

  kSampler.inputs.seed = options.seed;
  kSampler.inputs.steps = options.steps;
  kSampler.inputs.cfg = options.cfg;
  kSampler.inputs.sampler_name = options.sampler;
  kSampler.inputs.scheduler = options.scheduler;
  kSampler.inputs.denoise = options.denoise;
  kSampler.inputs.model = [checkpointId, 0];
  kSampler.inputs.latent_image = [latentId, 0];

  decode.inputs.samples = [kSamplerId, 0];
  decode.inputs.vae = [checkpointId, 2];

  const positiveId = kSampler.inputs.positive?.[0] || findNodeIdByClass(workflow, "CLIPTextEncode", 0);
  const negativeId = kSampler.inputs.negative?.[0] || findNodeIdByClass(workflow, "CLIPTextEncode", 1);
  if (!positiveId || !negativeId) {
    throw new Error("Workflow must include CLIPTextEncode nodes for positive and negative prompts.");
  }

  workflow[positiveId].inputs.text = options.positivePrompt;
  workflow[positiveId].inputs.clip = [checkpointId, 1];
  workflow[negativeId].inputs.text = options.negativePrompt;
  workflow[negativeId].inputs.clip = [checkpointId, 1];

  saveImage.inputs.images = [decodeId, 0];
  saveImage.inputs.filename_prefix = options.filenamePrefix;

  return { workflow, saveImageId };
}

async function postPrompt(host, prompt, clientId) {
  const res = await fetch(`${host}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, client_id: clientId }),
  });
  if (!res.ok) {
    throw new Error(`POST /prompt failed (${res.status})`);
  }
  return res.json();
}

async function getHistory(host, promptId) {
  const res = await fetch(`${host}/history/${promptId}`);
  if (!res.ok) {
    throw new Error(`GET /history/${promptId} failed (${res.status})`);
  }
  return res.json();
}

function extractImageFromHistory(historyPayload, promptId, preferredNodeId) {
  const item = historyPayload[promptId];
  if (!item || !item.outputs) {
    return null;
  }

  const preferred = item.outputs[preferredNodeId];
  if (preferred?.images?.length) {
    return preferred.images[0];
  }

  for (const output of Object.values(item.outputs)) {
    if (output?.images?.length) {
      return output.images[0];
    }
  }
  return null;
}

async function waitForImage(host, promptId, saveNodeId, timeoutMs, pollMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const history = await getHistory(host, promptId);
    const imageMeta = extractImageFromHistory(history, promptId, saveNodeId);
    if (imageMeta) {
      return imageMeta;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`Timed out waiting for prompt ${promptId}`);
}

async function downloadImage(host, imageMeta) {
  const params = new URLSearchParams({
    filename: imageMeta.filename,
    subfolder: imageMeta.subfolder || "",
    type: imageMeta.type || "output",
  });
  const res = await fetch(`${host}/view?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`GET /view failed (${res.status}) for ${imageMeta.filename}`);
  }
  const bytes = await res.arrayBuffer();
  return Buffer.from(bytes);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function assertConfig(args, pack) {
  if (!args.checkpoint) {
    throw new Error("Checkpoint is required. Set COMFYUI_CKPT or pass --checkpoint.");
  }
  if (!Array.isArray(pack.sprites) || pack.sprites.length === 0) {
    throw new Error("Sprite prompt pack is empty. Provide at least one sprite entry.");
  }
  if (!Number.isFinite(args.width) || args.width <= 0) {
    throw new Error("--width must be a positive number.");
  }
  if (!Number.isFinite(args.height) || args.height <= 0) {
    throw new Error("--height must be a positive number.");
  }
}

function importGeneratedSprites(outDir) {
  const importerPath = path.resolve("tools/import_comfyui_sprites.mjs");
  const run = spawnSync(process.execPath, [importerPath, "--from", outDir], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  if (run.status !== 0) {
    throw new Error("Sprite import step failed.");
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const workflowPath = path.resolve(args.workflow);
  const packPath = path.resolve(args.pack);
  const outDir = path.resolve(args.out);
  ensureDirectory(outDir);

  const template = readJson(workflowPath);
  const pack = readJson(packPath);
  assertConfig(args, pack);

  const sprites = args.limit > 0 ? pack.sprites.slice(0, args.limit) : pack.sprites;
  const basePrompt = args.basePrompt || pack.basePrompt || "";
  const negativePrompt = args.negativePrompt || pack.negativePrompt || "";
  const clientId = crypto.randomUUID();

  const report = {
    host: args.host,
    checkpoint: args.checkpoint,
    width: args.width,
    height: args.height,
    steps: args.steps,
    cfg: args.cfg,
    sampler: args.sampler,
    scheduler: args.scheduler,
    denoise: args.denoise,
    dryRun: args.dryRun,
    generated: [],
    skipped: [],
    failed: [],
  };

  console.log(`Preparing ${sprites.length} sprite prompt(s).`);

  for (let i = 0; i < sprites.length; i += 1) {
    const sprite = sprites[i];
    const key = sprite.key;
    const promptText = `${basePrompt}, ${sprite.prompt}`;
    const seed = Number.isFinite(args.baseSeed) ? args.baseSeed + i : Math.floor(Math.random() * 1000000000);
    const localFile = path.join(outDir, `${key}.png`);

    if (!args.force && fs.existsSync(localFile)) {
      console.log(`[skip] ${key} already exists`);
      report.skipped.push(key);
      continue;
    }

    const filenamePrefix = `${args.outputPrefix}/${key}`;
    const { workflow, saveImageId } = buildWorkflow(template, {
      checkpoint: args.checkpoint,
      width: args.width,
      height: args.height,
      steps: args.steps,
      cfg: args.cfg,
      sampler: args.sampler,
      scheduler: args.scheduler,
      denoise: args.denoise,
      seed,
      positivePrompt: promptText,
      negativePrompt,
      filenamePrefix,
    });

    if (args.dryRun) {
      console.log(`[dry-run] ${key} seed=${seed} prompt="${promptText}"`);
      report.generated.push({ key, seed, dryRun: true });
      continue;
    }

    try {
      console.log(`[queue] ${key}`);
      const queueResult = await postPrompt(args.host, workflow, clientId);
      const promptId = queueResult.prompt_id;
      if (!promptId) {
        throw new Error(`No prompt_id returned for ${key}`);
      }

      const imageMeta = await waitForImage(args.host, promptId, saveImageId, args.timeoutMs, args.pollMs);
      const imageBytes = await downloadImage(args.host, imageMeta);
      fs.writeFileSync(localFile, imageBytes);

      console.log(`[done] ${key} -> ${localFile}`);
      report.generated.push({
        key,
        seed,
        promptId,
        source: imageMeta,
        outputFile: localFile,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[fail] ${key}: ${message}`);
      report.failed.push({ key, message });
    }
  }

  const reportPath = path.join(outDir, "_generation_report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report written: ${reportPath}`);

  if (report.failed.length > 0) {
    console.error(`Generation completed with ${report.failed.length} failure(s).`);
  }

  if (!args.dryRun && args.importToManifest && report.generated.length > 0) {
    console.log("Importing generated sprites into manifest...");
    importGeneratedSprites(outDir);
  } else if (args.importToManifest && report.generated.length === 0) {
    console.log("No new sprites generated; skipping import.");
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
