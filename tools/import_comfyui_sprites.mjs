#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { writeManifestBundle } from "./write_sprite_manifest_bundle.mjs";

function parseArgs(argv) {
  const args = {
    from: process.env.COMFYUI_OUTPUT || "C:/ComfyUI/output/nuclear-commando",
    to: "assets/sprites/generated",
    manifest: "assets/sprites/manifest.json",
    replaceExisting: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--from" && next) {
      args.from = next;
      i += 1;
    } else if (arg === "--to" && next) {
      args.to = next;
      i += 1;
    } else if (arg === "--manifest" && next) {
      args.manifest = next;
      i += 1;
    } else if (arg === "--replace-existing") {
      args.replaceExisting = true;
    }
  }

  return args;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function walkPngFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPngFiles(full, out);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      out.push(full);
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const fromDir = path.resolve(args.from);
const toDir = path.resolve(args.to);
const manifestPath = path.resolve(args.manifest);

if (!fs.existsSync(fromDir)) {
  console.error(`Source folder not found: ${fromDir}`);
  process.exit(1);
}

fs.mkdirSync(toDir, { recursive: true });
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

const existingManifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : {};

const files = walkPngFiles(fromDir);
if (!files.length) {
  console.error(`No PNG files found in: ${fromDir}`);
  process.exit(1);
}

let copied = 0;
for (const src of files) {
  const base = path.basename(src);
  const dest = path.join(toDir, base);
  fs.copyFileSync(src, dest);

  const rawKey = slugify(path.parse(base).name);
  let key = rawKey || `sprite_${copied}`;
  let suffix = 1;
  if (!args.replaceExisting) {
    while (Object.hasOwn(existingManifest, key) && existingManifest[key] !== path.posix.join(path.basename(toDir), base)) {
      key = `${rawKey}_${suffix}`;
      suffix += 1;
    }
  }

  const relativeToManifest = path
    .relative(path.dirname(manifestPath), dest)
    .split(path.sep)
    .join("/");

  existingManifest[key] = relativeToManifest;
  copied += 1;
}

writeManifestBundle(manifestPath, existingManifest);

console.log(`Imported ${copied} sprite(s).`);
console.log(`Manifest updated: ${manifestPath}`);
console.log("Use keys like player_idle, player_run, enemy_trooper, objective_reactor for auto binding.");
