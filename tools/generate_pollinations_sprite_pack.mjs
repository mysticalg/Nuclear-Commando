#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    host: process.env.POLLINATIONS_HOST || "https://image.pollinations.ai/prompt",
    apiKey: process.env.POLLINATIONS_API_KEY || "",
    pack: "tools/comfyui/sprite_prompt_pack.json",
    out: "assets/sprites/generated_remote",
    model: "sana",
    width: 1024,
    height: 1024,
    timeoutMs: 120000,
    retries: 4,
    importToManifest: true,
    overwrite: false,
    dryRun: false,
    limit: 0,
    extraPrompt: "",
    nologo: false,
    extraQuery: "",
    includeNegative: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--host" && next) {
      args.host = next;
      i += 1;
    } else if (arg === "--api-key" && next) {
      args.apiKey = next;
      i += 1;
    } else if (arg === "--pack" && next) {
      args.pack = next;
      i += 1;
    } else if (arg === "--out" && next) {
      args.out = next;
      i += 1;
    } else if (arg === "--model" && next) {
      args.model = next;
      i += 1;
    } else if (arg === "--width" && next) {
      args.width = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--height" && next) {
      args.height = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--timeout-ms" && next) {
      args.timeoutMs = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--retries" && next) {
      args.retries = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--limit" && next) {
      args.limit = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === "--extra-prompt" && next) {
      args.extraPrompt = next;
      i += 1;
    } else if (arg === "--extra-query" && next) {
      args.extraQuery = next;
      i += 1;
    } else if (arg === "--include-negative") {
      args.includeNegative = true;
    } else if (arg === "--no-import") {
      args.importToManifest = false;
    } else if (arg === "--overwrite") {
      args.overwrite = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--no-nologo") {
      args.nologo = false;
    }
  }

  return args;
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildImageUrl(args, prompt) {
  const encodedPrompt = encodeURIComponent(prompt);
  const host = args.host.replace(/\/+$/, "");
  let base = "";
  if (host.includes("{prompt}")) {
    base = host.replace("{prompt}", encodedPrompt);
  } else if (host.endsWith("/prompt") || host.endsWith("/image")) {
    base = `${host}/${encodedPrompt}`;
  } else {
    base = `${host}/prompt/${encodedPrompt}`;
  }
  const qs = new URLSearchParams({
    model: args.model,
    width: String(args.width),
    height: String(args.height),
  });

  if (args.nologo) {
    qs.set("nologo", "true");
  }

  if (args.apiKey) {
    qs.set("key", args.apiKey);
  }

  if (args.extraQuery) {
    const extra = new URLSearchParams(args.extraQuery);
    for (const [k, v] of extra.entries()) {
      qs.set(k, v);
    }
  }

  return `${base}?${qs.toString()}`;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchImageWithRetry(url, retries, timeoutMs) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const message = `HTTP ${res.status}: ${text.slice(0, 1000)}`;

        if (res.status === 429 && attempt < retries) {
          const delay = Math.min(90000, 15000 * (attempt + 1));
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (res.status >= 500 && attempt < retries) {
          const delay = Math.min(45000, 6000 * (attempt + 1));
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw new Error(message);
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!bytes.length) {
        throw new Error("Received empty response body.");
      }
      return bytes;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

function importSprites(outDir) {
  const importerPath = path.resolve("tools/import_comfyui_sprites.mjs");
  const run = spawnSync(process.execPath, [importerPath, "--from", outDir], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (run.status !== 0) {
    throw new Error("Manifest import failed.");
  }
}

function validateArgs(args, pack) {
  if (!Array.isArray(pack?.sprites) || pack.sprites.length === 0) {
    throw new Error("Prompt pack has no sprites.");
  }
  if (!Number.isFinite(args.width) || args.width <= 0) {
    throw new Error("--width must be a positive number.");
  }
  if (!Number.isFinite(args.height) || args.height <= 0) {
    throw new Error("--height must be a positive number.");
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const packPath = path.resolve(args.pack);
  const outDir = path.resolve(args.out);
  ensureDir(outDir);

  const pack = readJson(packPath, null);
  validateArgs(args, pack);

  const sprites = args.limit > 0 ? pack.sprites.slice(0, args.limit) : pack.sprites;
  const report = {
    createdAt: new Date().toISOString(),
    host: args.host,
    model: args.model,
    width: args.width,
    height: args.height,
    limit: args.limit,
    dryRun: args.dryRun,
    generated: [],
    skipped: [],
    failed: [],
  };

  const basePrompt = pack.basePrompt || "";
  const negativePrompt = pack.negativePrompt || "";

  for (let i = 0; i < sprites.length; i += 1) {
    const sprite = sprites[i];
    const key = sprite.key;
    const finalPrompt = [
      basePrompt,
      sprite.prompt,
      args.extraPrompt,
      args.includeNegative && negativePrompt ? `negative prompt: ${negativePrompt}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    const outputPath = path.join(outDir, `${key}.png`);
    if (!args.overwrite && fs.existsSync(outputPath)) {
      console.log(`[skip] ${key} already exists`);
      report.skipped.push(key);
      continue;
    }

    const url = buildImageUrl(args, finalPrompt);
    if (args.dryRun) {
      console.log(`[dry-run] ${key}\n  ${url}`);
      report.generated.push({ key, url, dryRun: true });
      continue;
    }

    try {
      console.log(`[gen] ${key}`);
      const imageBytes = await fetchImageWithRetry(url, args.retries, args.timeoutMs);
      fs.writeFileSync(outputPath, imageBytes);
      report.generated.push({ key, url, outputPath });
      console.log(`[ok] ${key} -> ${outputPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.failed.push({ key, message, url });
      console.error(`[fail] ${key}: ${message}`);
    }
  }

  const reportPath = path.join(outDir, "_pollinations_report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report written: ${reportPath}`);

  if (!args.dryRun && args.importToManifest && report.generated.length > 0) {
    console.log("Importing generated sprites into manifest...");
    importSprites(outDir);
  } else if (args.importToManifest && report.generated.length === 0) {
    console.log("No new images generated; skipping manifest import.");
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
