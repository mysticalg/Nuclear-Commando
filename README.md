# Nuclear Commando

Play now: [https://mysticalg.github.io/Nuclear-Commando/](https://mysticalg.github.io/Nuclear-Commando/)

A fast-action Contra-inspired side-scrolling shooter built with plain HTML5 canvas.

This build keeps the mission fictionalized (rogue "Ashen Guard" facilities) while preserving the high-speed infiltration/destruction gameplay loop.

## Features

- Splash screen with start flow and controls
- 3 handcrafted levels with objective structures to destroy
- Level 1 is now a long underground cave base with layered parallax depth
- Contra-style weapon system: `Rifle`, `Spread`, `Laser`, `Flame`
- Weapon unlock + upgrade loop from drops and objective rewards
- Enemy variety: troopers, drones, turrets, heavy mechs
- Extraction flow, lives, score, combo, health UI
- Deterministic test hooks:
  - `window.render_game_to_text()`
  - `window.advanceTime(ms)`
- Optional custom sprite loading via `assets/sprites/manifest.json`

## Controls

- Move: `Arrow Left/Right`
- Jump: `Arrow Up`
- Crouch: `Arrow Down`
- Roll: `R` (or `Down + Move + Shoot`)
- Shoot: `Space`
- Cycle Weapon: `A` / `B`
- Pause: `P`
- Fullscreen toggle: `F` (`Esc` exits)

## Run locally

Any static server works.

```bash
python -m http.server 4173
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Local deterministic sprite generator

If you want a zero-dependency local workflow, generate the sprite pack with:

```bash
node tools/generate_local_svg_sprite_pack.mjs --style snes16 --overwrite
```

Available style presets:

```bash
node tools/generate_local_svg_sprite_pack.mjs --list-styles
```

This updates `assets/sprites/local_svg` and merges keys into `assets/sprites/manifest.json`, including:

- `player_crouch_hd`
- `player_roll_hd`
- `fx_muzzle_flash_hd`
- `fx_explosion_hd`

The generator now emits multi-frame animation keys as well (for example `player_run_0_hd` ... `player_run_5_hd`, `enemy_trooper_0_hd` ... `enemy_trooper_3_hd`, `fx_explosion_0_hd` ... `fx_explosion_5_hd`).  
`game.js` automatically uses those frames when present.

Optional local sprite preview page:

```bash
python -m http.server 4173
# open http://127.0.0.1:4173/sprite-showcase.html
```

## PNG Sprite Sheet Pipeline (Hand-Drawn Ready)

For a true 16-bit PNG workflow (option 1), generate sheet strips + frame atlas:

```bash
python tools/generate_png_sprite_sheet_pack.py --overwrite
```

What this does:

- Writes editable PNG sheets to `assets/sprites/sheets/png16`
- Writes sheet metadata to `assets/sprites/sheets/png16/sheet_manifest.json`
- Slices sheet frames into `assets/sprites/png16_frames`
- Updates `assets/sprites/manifest.json` so gameplay uses PNG keys first

If you repaint any sheet manually, re-slice and re-import without regenerating:

```bash
python tools/import_png_sprite_sheets.py --overwrite
```

Current generated sets include:

- `player_idle` (6), `player_run` (8), `player_jump` (2), `player_crouch` (2), `player_roll` (4)
- `enemy_trooper` (6), `enemy_drone` (4), `enemy_turret` (3), `enemy_mech` (6)
- Objectives, pickups, muzzle flash, and explosion sheets

## ComfyUI sprite pipeline

You can generate sprites in ComfyUI, then import them directly into the game:

```bash
node tools/import_comfyui_sprites.mjs --from "C:/ComfyUI/output/nuclear-commando"
```

This copies PNGs into `assets/sprites/generated/` and merges keys into `assets/sprites/manifest.json`.

### One-command local generation (ComfyUI API)

1. Start ComfyUI locally (default API host: `http://127.0.0.1:8188`).
2. Run the batch generator:

```bash
node tools/comfyui_generate_sprite_pack.mjs --checkpoint "YOUR_CHECKPOINT.safetensors"
```

What this does:

- Loads a reusable workflow template from `tools/comfyui/workflow_sprite_template.json`
- Uses prompt pack entries from `tools/comfyui/sprite_prompt_pack.json`
- Generates required `*_hd` sprite keys into `assets/sprites/generated_hd`
- Imports generated sprites into `assets/sprites/manifest.json` automatically

Useful options:

```bash
# Preview prompts/seeds without calling ComfyUI:
node tools/comfyui_generate_sprite_pack.mjs --checkpoint "YOUR_CHECKPOINT.safetensors" --dry-run

# Generate only first 3 entries for testing:
node tools/comfyui_generate_sprite_pack.mjs --checkpoint "YOUR_CHECKPOINT.safetensors" --limit 3

# Override API host and output directory:
node tools/comfyui_generate_sprite_pack.mjs --checkpoint "YOUR_CHECKPOINT.safetensors" --host http://127.0.0.1:8188 --out assets/sprites/generated_hd
```

Environment variable shortcut:

```bash
set COMFYUI_CKPT=YOUR_CHECKPOINT.safetensors
node tools/comfyui_generate_sprite_pack.mjs
```

## Forge Local Generator Pipeline

You can generate sprites from a local Forge server (AUTOMATIC1111/Forge-compatible API):

1. Start Forge with API enabled (`--api`) on `http://127.0.0.1:7860`.
2. Run:

```bash
node tools/forge_generate_sprite_pack.mjs --model "YOUR_MODEL.safetensors"
```

What this does:

- Reads prompts from `tools/comfyui/sprite_prompt_pack.json`
- Calls Forge `POST /sdapi/v1/txt2img`
- By default expands to animation frame keys (for example `player_run_0_hd` ... `player_run_7_hd`)
- Saves images to `assets/sprites/generated_forge`
- Auto-imports generated PNGs into `assets/sprites/manifest.json`

Useful options:

```bash
# Validate prompts/jobs without generating:
node tools/forge_generate_sprite_pack.mjs --dry-run --limit 6

# Generate only a small test batch:
node tools/forge_generate_sprite_pack.mjs --model "YOUR_MODEL.safetensors" --limit 8

# Disable frame expansion (generate only base keys):
node tools/forge_generate_sprite_pack.mjs --model "YOUR_MODEL.safetensors" --no-expand-frames

# Force overwrite existing PNGs:
node tools/forge_generate_sprite_pack.mjs --model "YOUR_MODEL.safetensors" --overwrite
```

Env vars:

```bash
set FORGE_HOST=http://127.0.0.1:7860
set FORGE_MODEL=YOUR_MODEL.safetensors
node tools/forge_generate_sprite_pack.mjs
```

## Free Remote Generator Pipeline (No ComfyUI)

If ComfyUI is unstable on your machine, use Pollinations free image generation:

```bash
node tools/generate_pollinations_sprite_pack.mjs --limit 3
```

Then run the full pack:

```bash
node tools/generate_pollinations_sprite_pack.mjs
```

What this script does:

- Reads sprite prompts from `tools/comfyui/sprite_prompt_pack.json`
- Calls free endpoint `https://image.pollinations.ai/prompt/{prompt}`
- Saves PNG sprites to `assets/sprites/generated_remote`
- Auto-imports into `assets/sprites/manifest.json`
- Uses model `sana` by default on the free endpoint

Useful options:

```bash
# Preview generated URLs without downloading:
node tools/generate_pollinations_sprite_pack.mjs --dry-run --limit 2

# Force regenerate existing files:
node tools/generate_pollinations_sprite_pack.mjs --overwrite

# Skip manifest import:
node tools/generate_pollinations_sprite_pack.mjs --no-import

# Optional custom endpoint (for keyed APIs):
node tools/generate_pollinations_sprite_pack.mjs --host "https://gen.pollinations.ai/image"

# Try another free-endpoint model:
node tools/generate_pollinations_sprite_pack.mjs --model zimage

# Add negative prompt text (can reduce reliability on some free queues):
node tools/generate_pollinations_sprite_pack.mjs --include-negative
```

Optional API key (if you have one):

```bash
set POLLINATIONS_API_KEY=your_key_here
node tools/generate_pollinations_sprite_pack.mjs
```

Recommended filename keys for auto-use:

- `player_idle.png`
- `player_idle_hd.png` (preferred over `player_idle` if both exist)
- `player_run.png`
- `player_jump.png`
- `enemy_trooper.png`
- `enemy_drone.png`
- `enemy_turret.png`
- `enemy_mech.png`
- `objective_centrifuge.png`
- `objective_factory.png`
- `objective_reactor.png`
- `objective_radar.png`
- `pickup_med.png`
- `pickup_spread.png`
- `pickup_laser.png`
- `pickup_flame.png`

If a key is missing, the game falls back to built-in procedural art.

## Asset Licensing Note

Do not use ripped copyrighted sprite sheets (for example commercial Contra/Probotector sheets) unless you have explicit rights.  
Use your own generated art, original art, or properly licensed packs.

## Support

If you'd like to support this project, you can buy me a coffee:
[buymeacoffee.com/dhooksterm](https://buymeacoffee.com/dhooksterm)
