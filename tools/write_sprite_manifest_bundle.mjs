#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function sortManifestEntries(manifest) {
  return Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
}

export function manifestJsPath(manifestPath) {
  const parsed = path.parse(manifestPath);
  return path.join(parsed.dir, `${parsed.name}.js`);
}

export function writeManifestBundle(manifestPath, manifest) {
  const sorted = sortManifestEntries(manifest);
  const jsPath = manifestJsPath(manifestPath);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    jsPath,
    `window.NUCLEAR_COMMANDO_SPRITE_MANIFEST = ${JSON.stringify(sorted, null, 2)};\n`,
    "utf8",
  );
  return { sorted, jsPath };
}

function parseArgs(argv) {
  const args = {
    manifest: "assets/sprites/manifest.json",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--manifest" && next) {
      args.manifest = next;
      i += 1;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const manifestPath = path.resolve(args.manifest);
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : {};
  const { jsPath } = writeManifestBundle(manifestPath, manifest);
  console.log(`Manifest bundle written: ${manifestPath}`);
  console.log(`Script bundle written: ${jsPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
