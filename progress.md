Original prompt: create a super contra/probotector snes inspired fast action shooting strategy side scroller just like contra but it's called nuclear commando. The nuclear Commando (player) has to infiltrate top secret Iranian IRGC bases and blow up their centrifuges, reactors, missile factories and more. Feature contra style weapons and upgrade, a splash screen and a variety of levels. Can we make the sprites using a local llm like comfyUI? somehow pipe them into the program? or perhaps another solution

## Progress Log

- Initialized project from empty repo using plain HTML/CSS/JS canvas stack.
- Added splash screen, start button (`#start-btn`), controls, and HUD shell.
- Implemented gameplay systems:
  - Side-scroll movement, jumping, shooting
  - Weapon set: Rifle / Spread / Laser / Flame
  - Weapon unlock + upgrade loop
  - Enemy types and projectiles
  - Destructible mission objectives with weakness bonuses
  - Lives, score, combo, extraction progression, level transitions
  - Three unique levels with different terrain and encounter pacing
- Added deterministic automation hooks:
  - `window.render_game_to_text`
  - `window.advanceTime(ms)`
- Added sprite manifest loading with graceful fallback to procedural art.
- Added ComfyUI import utility: `tools/import_comfyui_sprites.mjs`.
- Added README usage docs and recommended sprite key naming.

## TODO / Next Agent Notes

- Run Playwright loop and inspect generated gameplay screenshots for balance/readability passes.
- Consider adding sound effects/music and gamepad support.
- Add richer sprite animation states (crouch/roll/explosion variants) once art pack is imported.
- Optional: add difficulty selector and per-level checkpoint system.

## Validation Notes (Playwright)

- Ran automated action loop with start click:
  - Command target: `C:/Users/drhoo/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js`
  - URL: `http://127.0.0.1:4173`
  - Actions: `test-actions.json`
  - Iterations: `3`
  - Screenshot dir: `output/web-game`
- Fixed JSON parsing issue caused by UTF-8 BOM in `test-actions.json` (rewrote as ASCII).
- No `errors-*.json` console/page errors generated after final runs.
- Verified screenshots and state dumps were produced and readable.

### Issues Found + Fixed

- Initial balancing was too punishing (rapid game-over in automation loop):
  - Increased base max HP from 180 -> 220.
  - Increased starting lives from 3 -> 4.
  - Reduced enemy projectile/contact damage.
- Added on-canvas splash card so automated canvas captures include the splash/start information.
- Improved fallback player readability (headband + rifle silhouette) for low-art mode.

### Latest Artifacts

- Splash verification: `output/web-game-splash/shot-0.png` (`mode: splash`)
- Gameplay verification: `output/web-game/shot-0.png`, `shot-1.png`, `shot-2.png` (`mode: playing`)
- Fixed BOM/shebang parsing issue in `tools/import_comfyui_sprites.mjs` by rewriting file without BOM.
- Refactored level 1 into `Subterranean Breach`, a much longer underground cave mission (`length: 7600`) with expanded enemy spawns and deeper objective placement.
- Added cave-specific layered parallax renderer:
  - deep rock silhouettes
  - cavern glow volumes
  - mid-depth ridge silhouettes
  - dynamic ceiling strata (two depth layers)
  - structural supports and hanging cables/lights
  - cave floor treatment and near-floor detail strips
- Added HD sprite preference in renderer: `drawSprite` now loads `<key>_hd` first (falls back to `<key>`).
- Enabled high-quality image smoothing on canvas and switched CSS canvas `image-rendering` to `auto` for HD sprite workflows.
- Updated README with cave level feature note, `_hd` naming convention, and asset licensing warning.

### Validation (this pass)

- `node --check game.js` passed.
- `node --check tools/import_comfyui_sprites.mjs` passed.
- Playwright loop rerun with start click + action bursts:
  - output: `output/web-game/shot-0.png`, `shot-1.png`, `shot-2.png`
  - output: `output/web-game/state-0.json`, `state-1.json`, `state-2.json`
  - no `errors-*.json` generated.
- Visual inspection confirms underground cave parallax is visible and layered in gameplay captures.

## Local Model Pipeline Update

- Added ready-to-run ComfyUI workflow template: `tools/comfyui/workflow_sprite_template.json`.
- Added editable sprite prompt pack: `tools/comfyui/sprite_prompt_pack.json`.
- Added batch generator script: `tools/comfyui_generate_sprite_pack.mjs`.
  - Calls local ComfyUI API (`/prompt`, `/history/{id}`, `/view`) per sprite
  - Writes exact `*_hd` PNG names to `assets/sprites/generated_hd`
  - Optionally auto-imports into game manifest via `tools/import_comfyui_sprites.mjs`
  - Supports `--dry-run`, `--limit`, `--host`, `--checkpoint`, and quality/sampler overrides
- Updated README with one-command local generation and usage examples.

### Validation (this pass)

- `node --check tools/comfyui_generate_sprite_pack.mjs` passed.
- `node --check tools/import_comfyui_sprites.mjs` passed.
- Dry run succeeded:
  - `node tools/comfyui_generate_sprite_pack.mjs --checkpoint "dummy.safetensors" --dry-run --limit 4`
- Missing-checkpoint guard verified:
  - script exits with clear message when checkpoint is not provided.

## Pollinations Remote Pipeline Attempt

- Added `tools/generate_pollinations_sprite_pack.mjs` for free remote generation.
- Script reads prompt pack and writes PNGs to `assets/sprites/generated_remote`, with optional manifest import.
- Added reliability controls:
  - queue-aware retries for HTTP 429
  - retry/backoff for 5xx
  - optional `--include-negative`
  - optional `--extra-query`
- Updated docs in README with free remote workflow and options.

### Live Validation Results

- Dry-run works and emits valid endpoint URLs.
- Real requests hit provider-side instability and queue throttling on this network:
  - `429 Queue full for IP ... (max: 1)`
  - `500 Internal Server Error: fetch failed`
- Confirmed endpoint behavior manually:
  - `image.pollinations.ai/prompt/a cat` can return image/jpeg
  - many custom prompts still fail server-side under current free queue load.

### Current Recommendation

- Keep Pollinations script for opportunistic free remote runs.
- For guaranteed progress, use local fallback sprite generation script (`tools/generate_local_svg_sprite_pack.mjs`) or switch to a keyed provider.

## Local SVG Generator Adoption

- Switched to local deterministic sprite workflow per user request.
- Ran: `node tools/generate_local_svg_sprite_pack.mjs --overwrite`
- Produced 15 sprite assets in `assets/sprites/local_svg` and updated manifest entries to `*_hd` SVG keys.

### Verification

- Playwright splash run:
  - `output/web-game-local-splash/shot-0.png`
  - `output/web-game-local-splash/state-0.json`
- Playwright gameplay run:
  - `output/web-game-local/shot-0.png`, `shot-1.png`
  - `output/web-game-local/state-0.json`, `state-1.json`
- Visual check confirms game is using generated SVG sprites rather than procedural fallback blocks.

## Style Presets + Extra Animation Sprites (User requested "1&2")

- Restored and rewrote deleted generator file: `tools/generate_local_svg_sprite_pack.mjs`.
- Added style preset switch with CLI option:
  - `--style military` (default)
  - `--style gritty`
  - `--style neon`
  - `--list-styles`
- Generator now outputs 19 `*_hd` SVG sprites and updates `assets/sprites/manifest.json`, including new keys:
  - `player_crouch_hd`
  - `player_roll_hd`
  - `fx_muzzle_flash_hd`
  - `fx_explosion_hd`
- Regenerated pack with:
  - `node tools/generate_local_svg_sprite_pack.mjs --overwrite --style military`

### Gameplay Integration

- Added new player state/timers in `game.js`:
  - `crouching`
  - `rollT` + `rollCd`
  - `muzzleFlashT`
- Added controls:
  - Crouch: `ArrowDown`
  - Roll: `R` or combo trigger (`ArrowDown + move + Space`)
- Added render integration:
  - Player sprite keys now include `player_crouch` and `player_roll`
  - Muzzle flash uses `fx_muzzle_flash` with fallback
  - Explosions use `fx_explosion` with fallback
- Extended text-state hook `window.render_game_to_text()` with:
  - `crouching`
  - `rolling`
  - `rollCooldown`
  - `muzzleFlash`
- Updated splash controls text in both:
  - `drawSplashCard()` canvas card
  - `index.html` list

### Validation (this pass)

- Syntax checks passed:
  - `node --check game.js`
  - `node --check tools/generate_local_svg_sprite_pack.mjs`
- Playwright gameplay regression:
  - `output/web-game-local-style/shot-0.png`, `shot-1.png`, `shot-2.png`
  - `output/web-game-local-style/state-0.json`, `state-1.json`, `state-2.json`
- Roll-state verification:
  - `output/web-game-roll-fast/state-0.json` shows `\"rolling\":true` with roll velocity/cooldown active.
- Splash verification:
  - `output/web-game-splash-updated/shot-0.png` (updated crouch/roll controls visible)
  - `output/web-game-splash-updated/state-0.json` (`mode:\"splash\"`)
- No Playwright error logs generated in these output folders.

### Follow-up TODO ideas

- If desired, add directional shooting while crouched (currently same forward fire logic).
- Add dedicated animation frame cycling (multi-frame spritesheets) for crouch-roll transitions.

## Graphics Polish Pass + Screenshot Showcase

- Per user request, improved rendering quality in `game.js` without changing core mechanics:
  - Added soft dynamic shadows (`drawShadowBlob`, `drawEntityShadow`) for player, enemies, objectives, and pickups.
  - Added glow/bloom helper (`drawGlowCircle`) and used it for muzzle flashes, objective weak-point glow, pickups, bullet glow, and explosions.
  - Enhanced bullet readability with short velocity-based trail strokes for both player and enemy projectiles.
  - Upgraded cave atmosphere:
    - top cavern shade gradient
    - volumetric haze bands
    - floating dust motes
    - stronger hanging-lamp glow pools
    - near-floor fog/depth tint
  - Added world-wide atmospheric pass (`drawWorldAtmosphere`) after parallax background layers.
  - Added subtle post-processing (`drawPostFx`) with vignette + scanline treatment for retro-cinematic look.
  - Upgraded HUD panel visuals with gradient fill, border, and section divider.
- Upgraded outer presentation in `styles.css`:
  - richer multi-layer page background gradients
  - ambient frame glow around app container
  - stronger canvas framing/shadow stack
- Switched sprite pack to vivid style preset:
  - `node tools/generate_local_svg_sprite_pack.mjs --overwrite --style neon`

### Validation (this pass)

- `node --check game.js` passed.
- Playwright gameplay showcase run:
  - command uses `test-actions-graphics.json`
  - output: `output/web-game-graphics-showcase/shot-0.png`, `shot-1.png`, `shot-2.png`
  - output states: `state-0.json`, `state-1.json`, `state-2.json`
- Playwright splash showcase run:
  - output: `output/web-game-graphics-splash-new/shot-0.png`
  - state confirms `mode:"splash"` in `state-0.json`
- No `errors-*.json` files generated in the new output folders.

## SNES16 Detail + Animation Upgrade

- User requested: "highly detailed and animated, like nintendo 16 bit quality."
- Reworked local sprite generator to produce SNES16-style multi-frame sprite animations:
  - Replaced `tools/generate_local_svg_sprite_pack.mjs`
  - Added new default style preset `snes16`
  - Generator now emits `80` keys (base + frame variants), including:
    - player states with frame sets (`player_idle_0..3`, `player_run_0..5`, `player_jump_0..1`, `player_crouch_0..1`, `player_roll_0..3`)
    - enemy frame sets (`enemy_trooper_0..3`, `enemy_drone_0..2`, `enemy_turret_0..1`, `enemy_mech_0..3`)
    - animated objectives and pickups
    - FX frame sets (`fx_muzzle_flash_0..2`, `fx_explosion_0..5`)
  - Kept base keys (`player_run_hd`, etc.) mapped for compatibility.
- Regenerated assets:
  - `node tools/generate_local_svg_sprite_pack.mjs --overwrite --style snes16`

### Runtime animation integration

- Updated `game.js`:
  - Added `ANIM` frame/fps registry for player, enemies, objectives, pickups.
  - Added helpers:
    - `hasSpriteKey`
    - `pickAnimKey`
    - `drawAnimSprite`
  - All major entities now use animated frame keys if available.
  - Explosion rendering now uses frame-indexed sprites (`fx_explosion_0..5`) based on explosion life progress.
  - Muzzle flash now uses animated frame cycling.
- Improved retro pixel read:
  - Canvas smoothing switched to nearest-neighbor style (`imageSmoothingEnabled = false`).
  - CSS canvas `image-rendering` set to `pixelated`.

### Visibility pass for higher on-screen detail

- Increased rendered sprite draw scales (bottom-anchored, hitboxes unchanged) so frame details are visible in gameplay:
  - player, enemies, objectives, pickups all visually larger while preserving mechanics.

### New preview tooling

- Added `sprite-showcase.html`:
  - Local preview page displaying frame strips + live cycling for key animations.

### Validation (this pass)

- Syntax checks:
  - `node --check game.js` passed.
  - `node --check tools/generate_local_svg_sprite_pack.mjs` passed.
- Gameplay captures:
  - `output/web-game-16bit-quality-v2/shot-0.png` ... `shot-3.png`
  - corresponding `state-0.json` ... `state-3.json`
  - no `errors-*.json` in folder.
- Idle animation check:
  - `output/web-game-idle-anim-check/shot-0.png` ... `shot-2.png`
- Sprite showcase captures:
  - `output/sprite-showcase-captures/shot-0.png` ... `shot-2.png`

## SNES16 Detail Pass 2 (higher density per frame)

- User requested further increase in detail/animation quality.
- Upgraded sprite generator internals in `tools/generate_local_svg_sprite_pack.mjs`:
  - Added pixel-detail helpers:
    - `checker(...)` for dithering/hatch pixel texture
    - `rivetRow(...)` for panel/rivet detailing
  - Applied denser detail layers to key units and props:
    - player body/legs/weapon/headband/boots
    - trooper armor/legs/weapon/helmet
    - mech torso/arms/legs/visor
    - centrifuge/reactor internals and panel details
    - pickup surfaces and emblems
- Regenerated sprite pack again:
  - `node tools/generate_local_svg_sprite_pack.mjs --overwrite --style snes16`

### On-screen readability adjustments

- Increased visual draw scales in `game.js` (hitboxes unchanged):
  - objectives: `1.16`
  - enemies: up to `1.6` depending on type
  - pickups: `1.44`
  - player: `1.72`

### Showcase improvements

- Expanded `sprite-showcase.html`:
  - larger animation windows and frame thumbnails
  - 3-column layout
  - extra animated cards for mech/reactor/pickup sets
- Hardened showcase animation loop guards to avoid runtime `classList` errors when metadata is invalid.

### Validation (this pass)

- Syntax checks:
  - `node --check tools/generate_local_svg_sprite_pack.mjs` passed.
  - `node --check game.js` passed.
- Gameplay captures:
  - `output/web-game-16bit-quality-v3/shot-0.png` ... `shot-3.png`
  - `state-0.json` ... `state-3.json`
  - no errors in this output folder.
- Showcase captures:
  - `output/sprite-showcase-captures-v3/shot-0.png`, `shot-1.png`
  - no `errors-*.json` in this output folder.

## SNES16 Detail Pass 3 (bevel shading + denser animation)

- User request: move visuals away from NES-flat look toward richer SNES16 style.
- Updated `tools/generate_local_svg_sprite_pack.mjs`:
  - Added new detail helpers: `panelRows(...)`, `bevelRect(...)`.
  - Reworked core sprite layers to use beveled surfaces and denser texture sampling:
    - `playerStandingFrame`, `trooperFrame`, `mechFrame`
    - `objectiveCentrifugeFrame`, `objectiveFactoryFrame`, `objectiveReactorFrame`
    - all pickup frames
  - Increased animation coverage:
    - `player_idle`: 6 frames
    - `player_run`: 8 frames
    - `enemy_trooper`: 6 frames
    - `enemy_drone`: 4 frames
    - `enemy_turret`: 3 frames
    - `enemy_mech`: 6 frames
  - Regenerated sprite assets with `--style snes16`.
- Updated runtime animation/scaling in `game.js`:
  - ANIM frame counts/fps aligned to new generated sets.
  - Increased visual draw scales (hitboxes unchanged) for player/enemies/objectives/pickups.
  - Reduced scanline intensity in `drawPostFx`.
  - Enabled high-quality smoothing for HD sprite downscaling.
- Updated `styles.css` canvas rendering mode to `image-rendering: auto` for HD sprite clarity.
- Updated `sprite-showcase.html` labels/data attributes to new frame counts.

### Validation (this pass)

- Syntax:
  - `node --check game.js` passed.
  - `node --check tools/generate_local_svg_sprite_pack.mjs` passed.
- Sprite regeneration:
  - `node tools/generate_local_svg_sprite_pack.mjs --overwrite --style snes16`
  - output now reports `Total sprite keys: 90`.
- Gameplay capture runs:
  - `output/web-game-16bit-quality-v5/shot-0.png` ... `shot-3.png`
  - `output/web-game-16bit-quality-v6/shot-0.png` ... `shot-3.png`
  - states generated in both dirs; no `errors-*.json` files.
- Showcase capture runs:
  - `output/sprite-showcase-captures-v5/shot-0.png`, `shot-1.png`
  - `output/sprite-showcase-captures-v6/shot-0.png`, `shot-1.png`
  - no `errors-*.json` files.

## PNG Sprite Sheet Pipeline (Option 1 implemented)

- User selected option `1` (hand-drawn PNG sprite-sheet workflow).
- Added new tools:
  - `tools/generate_png_sprite_sheet_pack.py`
    - Generates SNES16-style PNG sheet strips for all major animation sets.
    - Writes sheet metadata to `assets/sprites/sheets/png16/sheet_manifest.json`.
    - Slices frames into `assets/sprites/png16_frames`.
    - Merges `*_hd` keys into `assets/sprites/manifest.json`.
  - `tools/import_png_sprite_sheets.py`
    - Re-slices existing sheet PNGs and updates manifest (for manual repaint workflows).
- Updated renderer presentation back to pixel-crisp for PNG pixel art:
  - `game.js`: smoothing disabled in canvas + draw path.
  - `styles.css`: `image-rendering: pixelated`.
- Updated docs:
  - `README.md` now includes the PNG sheet workflow and re-import command.

### Commands used

- Generate + import PNG sheets:
  - `python tools/generate_png_sprite_sheet_pack.py --overwrite`
- Re-import after manual edits:
  - `python tools/import_png_sprite_sheets.py --overwrite`

### Generated outputs

- Sheet strips:
  - `assets/sprites/sheets/png16/*_sheet.png`
- Sheet metadata:
  - `assets/sprites/sheets/png16/sheet_manifest.json`
- Sliced frame PNGs:
  - `assets/sprites/png16_frames/*.png`
- Manifest now points key gameplay frames to `png16_frames/...` paths.

### Validation

- Syntax checks:
  - `node --check game.js` passed.
  - `python -m py_compile tools/generate_png_sprite_sheet_pack.py tools/import_png_sprite_sheets.py` passed.
- Gameplay captures with PNG pipeline:
  - `output/web-game-png-sheet-v1/shot-0.png` ... `shot-3.png`
  - `state-0.json` ... `state-3.json`
  - no `errors-*.json` files.
- Showcase captures:
  - `output/sprite-showcase-png-v1/shot-0.png`, `shot-1.png`
  - no `errors-*.json` files.

## Forge Integration Added

- User asked to use local Forge instead of ComfyUI.
- Added new generator script: `tools/forge_generate_sprite_pack.mjs`
  - Uses Forge/A1111-compatible endpoint `POST /sdapi/v1/txt2img` (default host `http://127.0.0.1:7860`).
  - Supports checkpoint override via `--model` / `FORGE_MODEL`.
  - Reads prompt pack from `tools/comfyui/sprite_prompt_pack.json`.
  - Expands prompts to animation frame keys by default (`--no-expand-frames` to disable).
  - Saves PNGs to `assets/sprites/generated_forge`.
  - Auto-imports results into `assets/sprites/manifest.json` through `tools/import_comfyui_sprites.mjs`.
  - Writes generation report: `assets/sprites/generated_forge/_forge_report.json`.
- Updated docs in `README.md` with Forge startup + run commands and common flags.

### Validation

- `node --check tools/forge_generate_sprite_pack.mjs` passed.
- Dry run test passed:
  - `node tools/forge_generate_sprite_pack.mjs --dry-run --limit 4`
  - report written to `assets/sprites/generated_forge/_forge_report.json`.

## Forge Installed on D:\ and Live API Test

- User requested installing Forge on `D:`.
- Installed prerequisites and runtime:
  - Installed Python 3.10 via winget.
  - Cloned Forge repo to `D:\Forge`.
  - Updated `D:\Forge\webui-user.bat`:
    - `PYTHON=C:\Users\drhoo\AppData\Local\Programs\Python\Python310\python.exe`
    - `COMMANDLINE_ARGS=--api --port 7860`
  - Added helper launcher with logs: `D:\Forge\run_forge_api.bat`.

### Startup blockers fixed

1. `clip` install failed (`ModuleNotFoundError: pkg_resources`)
- Cause: `setuptools 82` in venv removed `pkg_resources`.
- Fix:
  - `D:\Forge\venv\Scripts\python.exe -m pip install setuptools==69.5.1`
  - `D:\Forge\venv\Scripts\python.exe -m pip install --no-build-isolation https://github.com/openai/CLIP/archive/d50d76daa670286dd6cacf3bcd80b5e4823fc8e1.zip`

2. NumPy ABI crash (`numpy.dtype size changed`, skimage/opencv mismatch)
- Fix:
  - `D:\Forge\venv\Scripts\python.exe -m pip install "numpy<2"`
  - `D:\Forge\venv\Scripts\python.exe -m pip install --upgrade opencv-python-headless==4.8.1.78 opencv-contrib-python==4.8.1.78`

### Model + API validation

- Downloaded checkpoint to `D:\Forge\models\Stable-diffusion\sd_turbo.safetensors` (from `stabilityai/sd-turbo`).
- Set model through API and confirmed availability:
  - `POST /sdapi/v1/options` with `sd_model_checkpoint: sd_turbo.safetensors`
  - `GET /sdapi/v1/sd-models` now returns model list (`1` model).
- Forge API now responds on:
  - `http://127.0.0.1:7860/sdapi/v1/options`

### Forge sprite pipeline test

- Ran local Forge generator test:
  - `node tools/forge_generate_sprite_pack.mjs --host http://127.0.0.1:7860 --model sd_turbo.safetensors --width 768 --height 768 --steps 20 --cfg 4.5 --limit 4 --overwrite`
- Result:
  - Generated `player_idle_0_hd` ... `player_idle_3_hd` in `assets/sprites/generated_forge`
  - Auto-imported into `assets/sprites/manifest.json`
  - Report: `assets/sprites/generated_forge/_forge_report.json`

## Forge Full Batch Run + Manifest Replacement Fix

- Ran full Forge generation pass after install stabilized:
  - `node tools/forge_generate_sprite_pack.mjs --host http://127.0.0.1:7860 --model sd_turbo.safetensors --width 768 --height 768 --steps 20 --cfg 4.5 --overwrite`
  - jobs executed: `71`, all succeeded.
  - output folder: `assets/sprites/generated_forge`
  - report: `assets/sprites/generated_forge/_forge_report.json`
- Found importer behavior issue: existing manifest keys were not replaced (new keys got suffixes).
- Fixed importer and Forge integration:
  - `tools/import_comfyui_sprites.mjs`
    - added `--replace-existing` flag to overwrite existing manifest keys directly.
  - `tools/forge_generate_sprite_pack.mjs`
    - importer now called with `--replace-existing`.
- Re-imported Forge output as authoritative keys:
  - `node tools/import_comfyui_sprites.mjs --from assets/sprites/generated_forge --replace-existing`
  - verified manifest entries now map to `generated/*.png` for generated keys.

### Validation captures (Forge keys active)

- Gameplay:
  - `output/web-game-forge-full-v2/shot-0.png`, `shot-1.png`, `shot-2.png`
- Showcase:
  - `output/sprite-showcase-forge-full-v2/shot-0.png`
- No `errors-*.json` in new output folders.

### Note

- With current `sd_turbo.safetensors` + prompts, many generated sprites include multi-figure sheet-like compositions and non-transparent backgrounds.
- Pipeline is functioning end-to-end; next quality step should focus on stronger checkpoint/LoRA + prompt constraints and/or post-process segmentation.

## Forge Guided Accuracy Pass

- User request: "getting better but the sprites dont fit, do another pass with more accuracy and stricter prompts."
- Added guide-based Forge generation so the model follows existing sprite silhouettes instead of inventing contact sheets:
  - `tools/forge_generate_sprite_pack.mjs`
    - new `img2img` path support via `/sdapi/v1/img2img`
    - new guide controls: `--guide-dir`, `--guide-cache-dir`, `--denoise`, `--no-guides`
    - when guide frames exist, generation now uses prepared source sprites as `init_images`
    - guided prompt discipline explicitly preserves pose, silhouette, subject count, and framing
  - `tools/prepare_forge_guides.py`
    - new helper that trims source PNGs, scales them with nearest-neighbor, and centers them on an off-white guide canvas sized for the target sprite category
- Tightened prompt pack wording in `tools/comfyui/sprite_prompt_pack.json`:
  - stronger single-subject base prompt
  - broader negative prompt against scene junk / buildings / duplicates
  - more explicit body, armor, and industrial detail cues for player/enemy/objective/pickup prompts

### Guided generation runs

- Sample validation:
  - `node tools/forge_generate_sprite_pack.mjs --host http://127.0.0.1:7860 --model sd_turbo.safetensors --out assets/sprites/generated_forge_guided_sample --limit 12 --overwrite --no-import --retries 0 --timeout-ms 120000`
  - Result: player frames generated as single centered subjects; no more collage/contact-sheet behavior.
- Full guided batch:
  - `node tools/forge_generate_sprite_pack.mjs --host http://127.0.0.1:7860 --model sd_turbo.safetensors --out assets/sprites/generated_forge_guided_full --overwrite --no-import --retries 0 --timeout-ms 120000`
  - Result: `71` jobs succeeded; all postprocessed.
- Imported guided set into active manifest:
  - `node tools/import_comfyui_sprites.mjs --from assets/sprites/generated_forge_guided_full --replace-existing`
- Cleaned stale duplicate keys from old Forge imports:
  - removed `71` manifest entries matching duplicate pattern `*_hd_1`

### Showcase sync

- Updated `sprite-showcase.html` to load frames from the active `assets/sprites/manifest.json` instead of hardcoded `local_svg` paths.
- This keeps the showcase aligned with whichever sprite pack is active in gameplay.

### Validation (this pass)

- Syntax:
  - `node --check tools/forge_generate_sprite_pack.mjs` passed.
  - `python -m py_compile tools/prepare_forge_guides.py tools/postprocess_forge_sprites.py` passed.
- Gameplay capture with guided Forge sprites active:
  - `output/web-game-forge-guided-v1/shot-0.png` ... `shot-3.png`
  - `output/web-game-forge-guided-v1/state-0.json` ... `state-3.json`
  - visual check confirms sprites now fit gameplay framing and no longer appear as scene collages
- Showcase capture after manifest-driven fix:
  - `output/sprite-showcase-forge-guided-v2/shot-0.png`, `shot-1.png`
  - no `errors-*.json` files in `sprite-showcase-forge-guided-v2`

### Current assessment

- Guided `img2img` is a meaningful improvement in fit and consistency with the current local model.
- Remaining limitation is still checkpoint quality: `sd_turbo` follows the silhouettes, but the resulting art is still flatter/blockier than true hand-drawn SNES production sprites.
- Best next visual jump would be either:
  - install a stronger sprite-friendly checkpoint / LoRA in Forge, or
  - use the guided pipeline against richer source guides than the current PNG frame set.

## Direct Browser Graphics Fix

- User report: current graphics only appeared as block placeholders in the browser.
- Root cause: `game.js` depended on `fetch("./assets/sprites/manifest.json")`, which fails when opening `index.html` directly from `file://`, causing a silent fallback to placeholder art.
- Implemented a browser-safe manifest bundle:
  - added `tools/write_sprite_manifest_bundle.mjs`
    - writes both `assets/sprites/manifest.json` and `assets/sprites/manifest.js`
    - `manifest.js` exposes `window.NUCLEAR_COMMANDO_SPRITE_MANIFEST`
  - updated `tools/import_comfyui_sprites.mjs` to write the JS manifest bundle automatically
  - updated `tools/generate_local_svg_sprite_pack.mjs` to write the JS manifest bundle automatically
  - updated `tools/generate_png_sprite_sheet_pack.py` and `tools/import_png_sprite_sheets.py` to write `manifest.js` too
- Runtime wiring:
  - `index.html` now loads `./assets/sprites/manifest.js` before `game.js`
  - `game.js` now prefers the inline `window.NUCLEAR_COMMANDO_SPRITE_MANIFEST` object and falls back to `fetch` only if needed
  - `sprite-showcase.html` now loads and prefers `manifest.js` too
- Generated the current bundle:
  - `node tools/write_sprite_manifest_bundle.mjs --manifest assets/sprites/manifest.json`

### Validation (this pass)

- Syntax:
  - `node --check game.js` passed
  - `node --check tools/import_comfyui_sprites.mjs` passed
  - `node --check tools/generate_local_svg_sprite_pack.mjs` passed
  - `node --check tools/write_sprite_manifest_bundle.mjs` passed
- HTTP gameplay regression:
  - `output/web-game-http-postfix-v1/shot-0.png`, `shot-1.png`
  - confirms sprite rendering still works through the local server path
- Direct file-open verification:
  - `output/file-open-page-v1.png`
  - `output/file-open-showcase-v1.png`
  - Edge headless `file://` screenshots confirm current art assets render when opened directly from disk

### Note

- The Playwright canvas-capture harness hits a `SecurityError` on `file://` because the canvas becomes tainted when local image files are drawn onto it. This affects automated canvas export only; direct browser rendering is working.
