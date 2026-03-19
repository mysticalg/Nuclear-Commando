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

## Low-Angle Aim + Enemy Recoil Pass

- Split the mixed Super Probotector airborne diagonal strip into two clean directions:
  - `player_air_diag` now uses frames `56-57`
  - new `player_air_down_diag` uses frames `52-53`
- Added grounded lower-angle player strips from the imported sheet:
  - `player_idle_down_diag`
  - `player_run_down_diag`
- Extended player aiming logic:
  - `getPlayerAimMode()` now recognizes `down` and `downDiag`
  - `X + Down + Left/Right` on the ground now locks into a lower-angle stance instead of forcing the old upper-diagonal pose
  - airborne down-diagonal aiming now uses a dedicated pose instead of the previously mixed diagonal strip
  - straight-down aiming while planted still uses crouch, but now fires from a lowered muzzle anchor
- Added shot-direction enemy recoil snap:
  - enemies now remember the last shot vector
  - troopers/turrets/mechs/bosses recoil backward along that vector while their muzzle flash plays
- Updated controls copy in `index.html` and the in-canvas splash card to mention low-angle aim.

### Validation (this pass)

- `node --check game.js` passed
- `python -m py_compile tools/build_superprobotector_player_pack.py tools/import_png_sprite_sheets.py` passed
- Rebuilt Probotector-derived player sheets with:
  - `python tools/build_superprobotector_player_pack.py --overwrite`
- Reimported PNG sheet frames with:
  - `python tools/import_png_sprite_sheets.py --overwrite`
- Playwright scenario captures passed after sprite-settle reruns:
  - grounded low-angle pose: `output/web-game-down-right-v2/shot-0.png`
  - airborne low-angle pose: `output/web-game-air-down-right-v2/shot-0.png`
  - enemy recoil pose: `output/web-game-enemy-recoil-v2/shot-0.png`
- State verification:
  - grounded low-angle state reports `pose:"player_idle_down_diag"` and `aim.mode:"downDiag"`
  - airborne low-angle state reports `pose:"player_air_down_diag"` and `aim.mode:"downDiag"`
- No `errors-*.json` files in the final `v2` validation folders.
- For guaranteed progress, use local fallback sprite generation script (`tools/generate_local_svg_sprite_pack.mjs`) or switch to a keyed provider.

## Cavern Art + Longer Levels Pass

- Integrated the newly added cavern/industrial environment art directly into `game.js`:
  - `cb4dffda-pixel-art-crystalline-cave-glowing-geodes-underground-compressed.jpg`
  - `aHR0cHM6Ly9iLnN0YWJsZWNvZy5jb20vODc5ZmE3MDUtYTQ5Ny00OTE1LTgyMjUtZjM3YzdjNjMyZjc3LmpwZWc.webp`
  - `Free-Industrial-Zone-Tileset-Pixel-Art5-720x480.webp`
  - `deshfsw-418d0116-ef10-4106-871a-7154fdadafdf.png`
- Added environment-art loaders plus reusable backdrop/tile drawing helpers:
  - `loadEnvironmentArt()`
  - `drawBackdropLayer()`
  - `drawEnvironmentCrop()`
- Cave backgrounds now layer user-provided cavern images behind the existing parallax silhouettes, plus a subtler industrial silhouette pass for underground structure depth.
- Traversal pieces now borrow the imported tile atlas so:
  - catwalks
  - climb grates
  - hang bars
  - pillars / barriers
  read more like built map pieces instead of flat debug geometry.
- Increased the environment crop alpha on platforms, grates, pillars, and hang bars so the supplied tile art shows up more clearly in gameplay.

### Level Length Extensions

- Extended all three levels with additional traversal sections, checkpoints, and combat spacing:
  - Level 1 `Subterranean Breach`: `7600 -> 10300`
  - Level 2 `Arc Mountains`: `6200 -> 7800`
  - Level 3 `Tidal Core`: `6600 -> 8200`
- Added more:
  - platforms
  - climbables
  - hangables
  - obstacles
  - hazards
  - spawns
  - pickups
  - checkpoints
- Pushed each boss arena deeper so the new sections are part of the intended route rather than filler before the old boss gate.
- Updated the level intro copy to mention hanging rails alongside grates/catwalks.

### Debug / Validation Support

- Added extended-section debug scenarios:
  - `?scenario=level1-extended-check`
  - `?scenario=level2-extended-check`
  - `?scenario=level3-extended-check`
- Added `window.__nuclear_commando_debug.setupLevelSectionCheck(levelIndex, checkpointIndex)` for deterministic section snapshots.
- Hid the large pause card during extended-section and vertical-scroll debug captures so the map layout stays readable in screenshots.

### Validation (this pass)

- `node --check game.js` passed.
- Browser validation used the bundled Playwright client through a short-lived local HTTP server helper because loading the new JPG/WEBP cave art over `file://` taints the canvas export path.
- No `errors-*.json` files were generated in:
  - `output/web-game-longer-pass-start-v2`
  - `output/web-game-level1-extended-v2`
  - `output/web-game-level2-extended-v2`
  - `output/web-game-level3-extended-v2`
  - `output/web-game-vertical-scroll-v5`
- Verified state dumps:
  - Level 2 extended scene reports `level.index: 1`, `name: "Arc Mountains"`, `platforms: 13`, `climbables: 9`, `hangables: 6`
  - Level 3 extended scene reports `level.index: 2`, `name: "Tidal Core"`, `platforms: 13`, `climbables: 9`, `hangables: 6`
- Visual checks confirm:
  - user cavern backgrounds are visible in level 1 / vertical sections
  - tile textures now read more clearly on catwalks and climbables

## Cave Variant Polish Pass

- Pushed levels 2 and 3 further away from level 1 visually by expanding the cave preset system in `game.js`:
  - per-variant backdrop image mixes
  - per-variant atmospheric veils
  - per-variant dust / fog / floor-glow tuning
  - darker basalt bunker mood for level 2
  - colder teal coolant mood for level 3
- Added authored room-light styling to the new scenery chunks:
  - level 2 chunks now use brighter steel-blue lights and lines
  - level 3 chunks now use teal reactor/coolant lights and lines
- Added optional `coreGlow` support to scenery chunks so long shafts can carry a stronger visual center instead of reading as flat boxes.
- Updated level 2 and level 3 cave palettes so their sky/back/mid/floor ramps now support the new underground look rather than inheriting too much of the original surface palette feel.

### Validation (this pass)

- `node --check game.js` passed.
- Revalidated with the bundled Playwright client through a short-lived local HTTP server and a splash click so the debug scenarios actually engaged.
- No `errors-*.json` files were generated in:
  - `output/web-game-level1-extended-v5`
  - `output/web-game-level2-extended-v5`
  - `output/web-game-level3-extended-v5`
  - `output/web-game-vertical-scroll-v8`
- Visual checks confirm:
  - level 1 still reads as the crystal-heavy base look
  - level 2 now reads darker / more basalt-industrial
  - level 3 now reads more teal / coolant-heavy
  - the vertical climbing shaft still composes cleanly after the preset changes

## Boss Death Sequence Pass

- Added a dedicated `bossDeath` phase in `game.js` so bosses no longer disappear instantly on kill.
- Boss kills now trigger a 5-second meltdown sequence before the level-clear card:
  - repeated explosion bursts across the boss body
  - escalating flash intensity toward the end of the sequence
  - boss flicker/jitter while the meltdown is active
  - HUD boss bar switches to a `CORE MELTDOWN` countdown-style depletion
- Level-clear / next-level progression now waits until the meltdown finishes.
- Added debug helpers and scenarios for validation:
  - `?scenario=boss-death-check`
  - `?scenario=boss-death-finish-check`
- Updated the boss debug harness so arena validation isolates the boss fight properly:
  - clears stray enemies/projectiles
  - positions the camera in the boss arena before captures

### Validation (this pass)

- `node --check game.js` passed.
- Playwright visual validation passed with start click and no error logs:
  - meltdown mid-sequence: `output/web-game-boss-death-v2/shot-0.png`
  - post-meltdown clear screen: `output/web-game-boss-clear-after-death-v2/shot-0.png`
  - next-level progression smoke: `output/web-game-boss-next-level-v1/shot-0.png`
- State verification:
  - meltdown snapshot reports `mode:"paused"` with `boss.dying:true` and `bossDeath.t:2.9`
  - clear snapshot reports `mode:"levelClear"` with `boss:null` and `bossDeath:null`
  - longer checkpoint-driven routes are present in all levels

## Nuclear Whiteout Pass

- Extended the boss-death sequence from a single 5-second meltdown into a two-stage 10-second finish:
  - first 5 seconds: escalating meltdown explosions
  - next 5 seconds: full-screen nuclear whiteout and fade-back
- Bosses are now removed at the start of the nuclear flash, so they are gone before the scene fades back in.
- Added whole-screen blast shake tied to the boss-death state so the detonation hits harder visually.
- Added helper logic in `game.js` for:
  - `getBossDeathScreenShake()`
  - `getBossWhiteoutAlpha()`
- Updated boss-death debug timing so we can capture:
  - mid-meltdown
  - mid-whiteout with the boss already gone
  - post-whiteout clear screen
- Extended `render_game_to_text()` with boss-death whiteout metadata for easier validation.

### Validation (this pass)

- `node --check game.js` passed.
- Playwright validation passed with long settle time and no `errors-*.json` files:
  - meltdown: `output/web-game-boss-death-v4/shot-0.png`
  - whiteout: `output/web-game-boss-whiteout-v2/shot-0.png`
  - post-whiteout clear: `output/web-game-boss-clear-after-whiteout-v2/shot-0.png`
- State verification:
  - whiteout snapshot reports `boss:null`, `bossDeath.detonated:true`, `bossDeath.whiteoutAlpha:0.97`
  - clear snapshot reports `mode:"levelClear"` with `boss:null` and `bossDeath:null`

## Audio Rename Pass

- Renamed the added music tracks under `assets/sfx` to stable semantic filenames:
  - `music_stage_01_lightning_and_grenades.mp3`
  - `music_stage_02_military_fortress.mp3`
  - `music_stage_03_jungle.mp3`
  - `music_stage_04_mechanic_factory.mp3`
  - `music_stage_05_perilous_cliff.mp3`
  - `music_stage_06_under_the_feet.mp3`
  - `music_stage_07_xenophobic_organs.mp3`
  - `music_stage_08_the_falling_wall.mp3`
  - `music_boss_main.mp3`
  - `music_boss_simple.mp3`
  - `music_stage_clear.mp3`
  - `music_campaign_clear.mp3`
  - `music_helicopter_return_stinger.mp3`
  - `music_game_over.mp3`
  - `music_stinger_steel_spider.mp3`
- Normalized the numbered unlabeled sound effects to stable IDs:
  - `sfx_01.mp3` through `sfx_28.mp3`
- Added [manifest.json](C:/Users/drhoo/OneDrive/Documents/GitHub/Nuclear-Commando/assets/sfx/manifest.json) with a clean list of renamed music tracks and placeholder SFX keys.
- Important note:
  - I cannot literally listen by ear from this terminal session, so the numbered SFX were normalized rather than semantically guessed. They are ready to be mapped once we audition them in-game.

### Next Notes

- If another pass is needed, the biggest visual opportunity is making levels 2 and 3 lean harder into the cavern imagery the way level 1 now does; they currently read more industrial/blue because of their composition and camera placement.

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

## Rugged Side-View Sprite Pass

- User requested less silly art direction:
  - rifles held higher near the chest
  - left/right readable side-view sprites
  - visible walking animation
  - tougher commando look with headband, tank top, and camo pants
  - more distinct hostile guard styling
- Reworked the local SVG sprite generator in `tools/generate_local_svg_sprite_pack.mjs`:
  - added new rugged palette keys for:
    - tank top / camo jeans / stubble / hair / chest strap
    - enemy headwrap cloth colors
  - replaced the old frontal block-style player/trooper bodies with side-view silhouettes
  - added `rifleRight(...)` helper so weapons sit at chest height instead of low at the waist
  - added `camoPatches(...)` helper for player leg texture
  - rewrote:
    - `playerStandingFrame`
    - `playerJumpFrame`
    - `playerCrouchFrame`
    - `playerRollFrame`
    - `trooperFrame`
- Regenerated and activated the current sprite pack with:
  - `node tools/generate_local_svg_sprite_pack.mjs --overwrite --style gritty`

### Validation (this pass)

- Syntax:
  - `node --check tools/generate_local_svg_sprite_pack.mjs` passed
- Gameplay captures:
  - `output/web-game-rugged-pass-v1/shot-0.png` ... `shot-3.png`
  - `state-0.json` ... `state-3.json`
  - no `errors-*.json` files
- Showcase captures:
  - `output/sprite-showcase-rugged-pass-v1/shot-0.png`, `shot-1.png`
  - no `errors-*.json` files

### Result summary

- Player now reads as a side-on rugged commando with:
  - red headband
  - sleeveless/tank-top upper body
  - camo legs
  - rifle held up at chest level
- Troopers now read as side-on hostile guards with:
  - dark headwrap / cloth headgear
  - harsher facial expression
  - chest-level rifles
- Run/walk frames are visibly side-view rather than frontal bobbing.

## Pixel-By-Pixel Character Sheet Pass

- User requested richer color depth and hand-built pixel art instead of the flatter SVG pass.
- Added `tools/generate_pixel_character_sheets.py`.
  - Builds player + trooper sheets at 80x80 pixel-art resolution, then upscales to 160x160 strips.
  - Uses per-pixel shading/material ramps for skin, tank top, strap, rifle metal, boots, and camo pants.
  - Generates updated sheets for:
    - `player_idle`
    - `player_run`
    - `player_jump`
    - `player_crouch`
    - `player_roll`
    - `enemy_trooper`
- Ran:
  - `python tools/generate_pixel_character_sheets.py --overwrite --run-import`
- Resulting sheet color richness:
  - `player_idle_sheet.png`: 303 unique non-transparent colors
  - `player_run_sheet.png`: 383 unique non-transparent colors
  - `player_jump_sheet.png`: 299 unique non-transparent colors
  - `player_crouch_sheet.png`: 258 unique non-transparent colors
  - `player_roll_sheet.png`: 363 unique non-transparent colors
  - `enemy_trooper_sheet.png`: 340 unique non-transparent colors
- Importer rewired active manifest keys to `png16_frames/...` for the updated character sheets.

### Validation (this pass)

- `python -m py_compile tools/generate_pixel_character_sheets.py` passed.
- Gameplay verification:
  - `output/web-game-pixel-pass-v1/shot-0.png`
  - `output/web-game-pixel-pass-v1/shot-2.png`
- Showcase verification:
  - `output/sprite-showcase-pixel-pass-v1/shot-0.png`
- Visual inspection confirms the browser is using the new raster character sheets rather than fallback blocks or flat SVG art.

## Directional Aim + Anime-Style Character Pass

- User requested:
  - richer, slicker character art with more colors
  - `Z` to fire, `Space` to jump
  - `ArrowUp` aiming up, `ArrowUp + direction` aiming diagonally
  - gun pose to follow shot direction
  - jump to read as a leaping somersault
  - smoother direction/camera changes instead of abrupt screen flipping
- Expanded raster character pipeline in `tools/generate_pixel_character_sheets.py`:
  - upgraded player/trooper color ramps and highlights
  - added dedicated pose strips:
    - `player_idle_up`
    - `player_idle_diag`
    - `player_run_up`
    - `player_run_diag`
    - `player_air_forward`
    - `player_air_up`
    - `player_air_diag`
  - upgraded `player_jump` from 2 -> 6 frames as a somersault strip
  - kept `player_roll`, `player_crouch`, `enemy_trooper` wired into same PNG workflow
- Updated `assets/sprites/sheets/png16/sheet_manifest.json` for the new player strips and frame counts.
- Regenerated/imported assets with:
  - `python tools/generate_pixel_character_sheets.py --overwrite --run-import`
- Updated `game.js`:
  - controls remapped to `Space` jump and `Z` fire
  - added aim-vector helpers and directional bullet spawning
  - `ArrowUp` now aims up; `ArrowUp + direction` aims diagonally
  - player sprite selection now switches across forward/up/diag/air pose families
  - muzzle flash now points along the real aim vector
  - camera lead and sprite facing use damping to smooth turn-induced screen shifts
  - text state now reports `aim` and `visualFacing`
- Updated `index.html` and splash-card text to match the new controls.
- Updated `sprite-showcase.html` with cards for run-diagonal, idle-up, and the somersault jump strip.

### Validation (this pass)

- Syntax:
  - `node --check game.js` passed
  - `python -m py_compile tools/generate_pixel_character_sheets.py` passed
- PNG import:
  - `115` frame PNGs written from `26` sheet entries
- Gameplay captures:
  - `output/web-game-aim-jump-v2/shot-0.png`
  - `output/web-game-aim-jump-v2/shot-2.png`
- Targeted `KeyZ` browser captures using Playwright from the skill's installed `node_modules`:
  - `output/web-game-keyz-aim-v2/shot-up-fire.png`
  - `output/web-game-keyz-aim-v2/shot-diag-jump-fire-air.png`
  - `output/web-game-keyz-aim-v2/state-up-fire.json` confirms `aim.mode:"up"`
  - `output/web-game-keyz-aim-v2/state-diag-jump-fire-air.json` confirms `onGround:false` and `aim.mode:"diag"`
- Showcase capture:
  - `output/sprite-showcase-aim-v2/shot-0.png`
- No `errors-*.json` files were generated in `output/web-game-aim-jump-v2` or `output/sprite-showcase-aim-v2`.

## External Sprite Sheet Cutter

- User provided a screenshot of a retro sprite sheet and asked to use those sprites, cut correctly.
- I could not reliably locate the uploaded chat attachment as a local file, so I added a reusable cutter instead of guessing from the chat preview pixels.
- Added `tools/slice_external_sprite_sheet.py`.
  - Detects foreground sprites on black/transparent background
  - Dilates the mask slightly before component detection to avoid broken cutouts
  - Extracts individual frames with transparent background
  - Groups frames into rows
  - Writes `frames.json` plus a numbered `contact_sheet.png`
- Validation run:
  - `python tools/slice_external_sprite_sheet.py --source assets/sprites/sheets/png16/player_run_sheet.png --out output/slice-test-player-run`
  - Result: `8` frames detected, `1` row detected
  - Artifacts:
    - `output/slice-test-player-run/contact_sheet.png`
    - `output/slice-test-player-run/frames.json`
- Next step once the real imported sheet PNG is available locally:
  - run the cutter on that file
  - inspect the numbered contact sheet
  - map selected rows/frames into the game's animation keys
## Super Probotector Import Pass

- Added `tools/slice_external_sprite_sheet.py` to auto-cut external sheets with transparent or sampled solid-color backgrounds.
- Sliced `assets/sprites/superprobotectorsheet1.png` into `88` transparent frames:
  - output folder: `output/slice-superprobotector-png`
  - contact sheet: `output/slice-superprobotector-png/contact_sheet.png`
  - metadata: `output/slice-superprobotector-png/frames.json`
- Added `tools/build_superprobotector_player_pack.py` to repack selected external frames into the game's player sheet layout.
- Updated the repack map to use the contiguous left-to-right Super Probotector sequences:
  - idle: `0-3`
  - run forward: `16-21`
  - run up: `22-27`
  - run diagonal: `34-39`
  - crouch: `8-9`
  - roll: `12-15`
  - air forward/up/diag: `60-61`, `58-59`, `52-53/56-57`
  - jump / somersault: `82-86`
- Climb / ladder frames are preserved in the slice output (`62-81`) for a future ladder mechanic, but the current controller does not expose climb states yet.
- Rebuilt the player sheets and reimported the PNG manifest:
  - `python tools/build_superprobotector_player_pack.py --source-dir output/slice-superprobotector-png --sheet-dir assets/sprites/sheets/png16 --overwrite`
  - `python tools/import_png_sprite_sheets.py --overwrite`

### Validation

- `python -m py_compile tools/build_superprobotector_player_pack.py` passed.
- Playwright gameplay validation passed:
  - `output/web-game-superprobotector-v1/shot-0.png`, `shot-1.png`, `shot-2.png`
  - `output/web-game-superprobotector-v1/state-0.json`, `state-1.json`, `state-2.json`
- Playwright showcase validation passed:
  - `output/sprite-showcase-superprobotector-v1/shot-0.png`, `shot-1.png`
- No `errors-*.json` files were generated in either validation folder.
- Note: the bundled Playwright client releases held keys before capture, so the state dumps settle back to forward aim; the imported animation strips were verified visually in the showcase and generated sheet outputs.
## Traversal + Boss Flow Pass

- Added traversal geometry to all three levels in `game.js`:
  - one-way catwalk platforms
  - climbable grate / ladder wall strips
  - solid obstacles / cover blocks / pillars
  - floor hazards (laser floor, acid, spikes)
- Added player support-aware movement:
  - lands on platforms and obstacle tops
  - `Down + Space` drops through one-way catwalks
  - climb state on wall grates with vertical movement and jump-off
- Added more enemy density and platform-based enemy placements using `surfaceY`, `patrolMin`, and `patrolMax` spawn metadata.
- Added end-of-level boss arenas for all levels.
  - Level 1 boss: `Iron Talon`
  - Level 2 boss: `Mountain Warden`
  - Level 3 boss: `Leviathan Core`
- Bosses now:
  - spawn when the player reaches the arena threshold
  - lock the arena entrance visually
  - show a boss HP bar in the HUD
  - finish the level when defeated
- Replaced the old instant next-level transition with a level-clear splash card before the next level starts.
- Updated controls copy in `game.js` splash card and `index.html` to include climb and drop-through.

## Imported Climb Animation

- Extended `tools/build_superprobotector_player_pack.py` with `player_climb_sheet.png` using the external Probotector climb frames.
- Added `player_climb` to `assets/sprites/sheets/png16/sheet_manifest.json`.
- Rebuilt and reimported PNG frame assets:
  - `python tools/build_superprobotector_player_pack.py --source-dir output/slice-superprobotector-png --sheet-dir assets/sprites/sheets/png16 --overwrite`
  - `python tools/import_png_sprite_sheets.py --overwrite`
- Added a climb preview card to `sprite-showcase.html`.

## Debug / Validation Helpers

- Added `window.__nuclear_commando_debug` in `game.js` with:
  - `getState()`
  - `clearObjectives()`
  - `skipToBoss()`
  - `defeatBoss()`
- Added query-param driven debug scenarios in `startCampaign()` for validation with the standard Playwright client:
  - `?scenario=skip-boss`
  - `?scenario=clear-boss`
  - `?scenario=next-level`

## Validation

- Syntax:
  - `node --check game.js` passed
  - `python -m py_compile tools/build_superprobotector_player_pack.py` passed
- Standard Playwright traversal validation:
  - `output/web-game-traversal-boss-v2/shot-0.png`, `shot-1.png`, `shot-2.png`
  - verified platforms / climbables / obstacles / hazards render in gameplay
  - `state-2.json` confirms player on `support:"platform"`
- Boss spawn validation with bundled client:
  - `output/web-game-boss-skip-v1/shot-0.png`
  - `state-0.json` confirms `bossActive:true` and boss payload present
- Level-clear splash validation with bundled client:
  - `output/web-game-boss-clear-v1/shot-0.png`
  - `state-0.json` confirms `mode:"levelClear"`
- Auto-transition to level 2 validation with bundled client:
  - `output/web-game-level2-transition-v1/shot-0.png`
  - `state-0.json` confirms `level.index:1`, `name:"Arc Mountains"`, `mode:"playing"`
- Sprite showcase validation:
  - `output/sprite-showcase-traversal-v1/shot-0.png`
- No `errors-*.json` files were generated in the new validation folders.

## Notes

- During implementation, the player could miss ground support and fall forever after a bad support resolution. Fixed by always allowing terrain to catch downward movement.
- The bundled Playwright client still cannot press `Z`, so boss defeat was validated via the local debug scenario path instead of live combat input automation.
## Enemy Sprite Import Pass

- User-added source sheet detected at `assets/sprites/enemy.png`.
- Sliced the sheet into `47` frames / `8` rows using:
  - `python tools/slice_external_sprite_sheet.py --source assets/sprites/enemy.png --out output/slice-enemy-png --bg-mode sample --bg-distance 24 --grow 1 --pad 2 --min-area 24 --row-tolerance 18`
- Added `tools/build_enemy_action_variants.py` to build trooper action sheets from the sliced source.
  - Walk row mapped from frames `16-21`
  - Forward-fire row mapped from frames `2-6`
  - Up-fire row mapped from frames `35-39`
- Generated trooper palette variants:
  - default
  - olive
  - crimson
  - navy
- Built new action sheets in `assets/sprites/sheets/png16`:
  - `enemy_trooper_sheet.png`
  - `enemy_trooper_fire_sheet.png`
  - `enemy_trooper_up_sheet.png`
  - plus variant sheets like `enemy_trooper_olive_sheet.png`, `enemy_trooper_crimson_fire_sheet.png`, `enemy_trooper_navy_up_sheet.png`
- Extended `assets/sprites/sheets/png16/sheet_manifest.json` with the new trooper action/variant bases and reimported the manifest:
  - `python tools/import_png_sprite_sheets.py --overwrite`

## Runtime Integration

- Updated `game.js` so troopers now:
  - pick deterministic palette variants from spawn order for immediate on-screen variety
  - use the new walk sheets while moving
  - switch to the imported forward-fire sheet while attacking at player height
  - switch to the imported up-fire sheet when attacking a higher player
- Added trooper variant info into `window.render_game_to_text()` enemy payloads for validation.
- Expanded `sprite-showcase.html` with enemy variant/action cards.

## Validation

- `python -m py_compile tools/build_enemy_action_variants.py` passed
- `node --check game.js` passed
- Gameplay validation:
  - `output/web-game-enemy-variants-v2/shot-0.png`
  - `output/web-game-enemy-variants-v2/state-0.json`
  - state confirms mixed enemy variants near the start (`null` original + `olive` visible)
- Showcase validation:
  - `output/sprite-showcase-enemy-variants-v2/shot-0.png`
- No `errors-*.json` files in the new validation folders.
## GitHub Pages Deployment Pass

- Added GitHub Pages workflow at `.github/workflows/deploy-pages.yml`.
- Workflow publishes the static site on pushes to `main` or `master` and on manual dispatch.
- Deployment artifact includes:
  - `index.html`
  - `game.js`
  - `styles.css`
  - `sprite-showcase.html`
  - `assets/`
- Added live play link at the top of `README.md`:
  - `https://mysticalg.github.io/Nuclear-Commando/`
- Current branch checked: `main`
- Note: if GitHub Pages has not already been enabled in repo settings, the repo may need a one-time Pages source selection of `GitHub Actions` after the first push.

## Muzzle + Aftermath Pass

- Tightened player and enemy muzzle anchors so projectiles now spawn from weapon tips instead of lower body hitbox centers.
- Replaced the old triangular muzzle flash with a radial bloom flash (`drawMuzzleBloom`) for the player and enemy muzzle events.
- Added persistent combat aftermath:
  - trooper blood bursts on hit/death
  - persistent corpses limited by `MAX_CORPSES`
  - expanding blood pools and blood particles limited by `MAX_BLOOD_PARTICLES`
- Added trooper death-sheet generation from `enemy.png` row 40-46 and wired variant death strips:
  - `enemy_trooper_death`
  - `enemy_trooper_olive_death`
  - `enemy_trooper_crimson_death`
  - `enemy_trooper_navy_death`
- Added debug scenarios for screenshot validation:
  - `?scenario=muzzle-check`
  - `?scenario=blood-check`

### Validation (this pass)

- `node --check game.js` passed after each edit pass.
- `python -m py_compile tools/build_enemy_action_variants.py tools/import_png_sprite_sheets.py` passed.
- Rebuilt/imported PNG sheets:
  - `python tools/build_enemy_action_variants.py --source-dir output/slice-enemy-png --sheet-dir assets/sprites/sheets/png16 --overwrite`
  - `python tools/import_png_sprite_sheets.py --overwrite`
- Playwright validations passed with no `errors-*.json` files:
  - `output/web-game-muzzle-check-v2/shot-0.png`
  - `output/web-game-blood-check-v4/shot-0.png`
  - `output/web-game-aftermath-smoke-v2/shot-0.png`

## Aim Lock + Crouch + Enemy Hitbox Pass

- Added `X` aim-lock so the player can plant in place on the ground and aim without walking.
  - Left/right now reorient the commando while locked.
  - Up and up+direction still drive the up/diagonal firing poses while movement stays at `0`.
- Reduced crouch sliding by hard-stopping ground velocity while crouched.
- Added separate combat rectangles:
  - player crouch / roll / climb hurtboxes now shrink appropriately via `getPlayerCombatRect()`
  - enemy bullet/contact hit tests now use render-sized combat boxes via `getEnemyCombatRect()` instead of the old tiny logic boxes
- Increased enemy render scale so troopers read slightly larger than the player.
- Added debug validation scenarios:
  - `?scenario=aim-lock-check`
  - `?scenario=crouch-check`
- Updated controls text to show `Aim Lock: X` in both `game.js` splash card and `index.html`.

### Validation (this pass)

- `node --check game.js` passed.
- Playwright validations passed with no `errors-*.json` files:
  - `output/web-game-aim-lock-v1/shot-0.png`
  - `output/web-game-crouch-check-v3/shot-0.png`
  - `output/web-game-aimlock-smoke-v1/shot-0.png`
- State checks confirm:
  - aim-lock paused scene has `aimLock:true`, `vx:0`, diagonal aim active
  - crouch paused scene has `crouching:true`

## Bullet Tuning Pass

- Increased player weapon fire cadence by reducing cooldowns:
  - Rifle: `0.16/0.13/0.10 -> 0.12/0.10/0.08`
  - Spread: `0.24/0.20/0.17 -> 0.18/0.155/0.13`
  - Laser: `0.20/0.16/0.13 -> 0.16/0.13/0.105`
  - Flame: `0.11/0.095/0.08 -> 0.09/0.078/0.066`
- Reduced player projectile core sizes slightly:
  - Rifle `3 -> 2.35`
  - Spread `3 -> 2.4`
  - Laser `2 -> 1.65`
  - Flame radii reduced to `7/8.5/10`
- Brightened player bullet presentation:
  - stronger outer glow
  - added inner hot-core glow
  - brighter trail stroke

### Validation (this pass)

- `node --check game.js` passed.
- Playwright validation passed with no `errors-*.json` files:
  - `output/web-game-bullet-tuning-v1/shot-0.png`

## Recoil + Up-Pose Facing Pass

- Added `getPlayerFlipScale()` so aim-up/diag, crouch, climb, and firing poses use crisp facing instead of smoothed flip blending.
- Added `getPlayerSpriteState()` so static player poses can use the imported alternate frame as a recoil/fire frame:
  - `player_idle_0/1`
  - `player_idle_up_0/1`
  - `player_idle_diag_0/1`
  - `player_crouch_0/1`
  - `player_air_forward_0/1`
  - `player_air_up_0/1`
- Added recoil offset in `drawPlayer()` so firing pushes the sprite slightly backward along the aim vector.
- Removed the old player flip-phase offset in draw timing, which was contributing to the up-pose left/right mix.
- Added debug pose scenarios:
  - `?scenario=up-right-check`
  - `?scenario=up-left-check`
  - `?scenario=up-right-recoil-check`
  - `?scenario=up-left-recoil-check`
- Added `player.pose` to `render_game_to_text()` for animation-state verification.

### Validation (this pass)

- `node --check game.js` passed.
- Playwright validations passed with no `errors-*.json` files:
  - `output/web-game-up-right-recoil-v1/shot-0.png`
  - `output/web-game-up-left-v1/shot-0.png`
  - `output/web-game-recoil-smoke-v1/shot-0.png`
- State checks confirm:
  - right recoil scene: `pose:"player_idle_up"`, `muzzleFlash:true`, `facing:1`
  - left up scene: `pose:"player_idle_up"`, `facing:-1`, `visualFacing:-1`

## Aspect Preservation Pass

- Reworked character sprite flipping in `game.js` so player/enemy sprites no longer squash horizontally during smooth turn transitions.
- `drawSprite()` now preserves aspect for character art and uses a full-size left/right alpha blend for in-between facing values instead of scaling width through zero.
- Added `turn-blend-check` debug scenario for verifying mid-turn rendering without gameplay noise.
- Fixed `render_game_to_text()` so `visualFacing` reports the true in-between value instead of collapsing `0` to the facing sign.

### Validation (this pass)

- `node --check game.js` passed.
- Playwright scenario captures rerun with start click + paused debug scenes:
  - `output/web-game-diag-right-v4/shot-0.png`
  - `output/web-game-climb-diag-v4/shot-0.png`
  - `output/web-game-turn-blend-v3/shot-0.png`
- State verification:
  - diagonal run pose reports `pose:"player_run_diag"`
  - climb pose reports `pose:"player_climb"`, `climbing:true`
  - turn blend reports `visualFacing:-0.18`
- Console still logs one existing `Failed to load resource: net::ERR_CONNECTION_REFUSED` entry during automated runs; no new syntax/runtime crash was introduced by the aspect fix.

## Hang + Checkpoint + Vertical Pass

- Added dedicated hang animation families derived from the imported Super Probotector sheet:
  - `player_hang`
  - `player_hang_up`
  - `player_hang_diag`
  - `player_hang_forward`
  - `player_hang_down_diag`
  - `player_hang_down`
- Added these new hang strips to `sheet_manifest.json`, rebuilt sheets, and reimported the frame manifest.
- Split traversal pose routing so ladders use `player_climb*` while bars use `player_hang*`.
- Added hang-specific muzzle anchors and reach handling so firing while hanging follows the correct pose family.
- Added extra hang-bar routes to levels 2 and 3 so hanging is part of the campaign structure, not only the first shaft.
- Added checkpoint activation logic in `updateFlow()` and checkpoint beacon rendering in `drawTraversal()`.
- Added/updated debug scenarios:
  - `?scenario=hang-aimlock-diag-check`
  - `?scenario=hang-forward-check`
  - `?scenario=checkpoint-check`
- Improved debug scenario reliability by waiting for sprite loading before executing URL-driven setup scenes.
- Updated splash/help copy in `game.js` and `index.html` to mention hang bars.

### Validation (this pass)

- `node --check game.js` passed.
- `python -m py_compile tools/build_superprobotector_player_pack.py tools/import_png_sprite_sheets.py` passed.
- Rebuilt/imported player sheets:
  - `python tools/build_superprobotector_player_pack.py --overwrite`
  - `python tools/import_png_sprite_sheets.py --overwrite`
- Playwright validation states/screens passed:
  - hanging aim-lock: `output/web-game-hang-aim-v3/shot-0.png`
    - state: `hanging:true`, `aimLock:true`, `pose:"player_hang_diag"`
  - climb diagonal: `output/web-game-climb-diag-v6/shot-0.png`
    - state: `climbing:true`, `pose:"player_climb_diag"`
  - checkpoint activation: `output/web-game-checkpoint-v3/shot-0.png`
    - state checkpoint became `l1-cp-1`
  - vertical shaft framing: `output/web-game-vertical-scroll-v3/shot-0.png`
    - state camera: `cameraY:-211`
- No `errors-0.json` files were produced for the final `v3/v6` validation captures.

## Bullet Alignment + Size Pass

- Fixed bullet spawn alignment after the aspect-preservation renderer change.
- Added `getSpriteDrawMetrics()` so muzzle anchors now use the actual fitted sprite draw box instead of the old full render box.
- Updated player muzzle placement to compute against the real animated frame currently on screen.
- Updated enemy muzzle placement to do the same for trooper/turret/mech/boss shots.
- Tuned player muzzle anchor offsets slightly so forward/diag/up/down shots sit closer to the weapon barrel line.
- Reduced bullet radii globally by `50%` for both player and enemy projectiles.
- Reduced trail stroke minimum width and glow radius to match the smaller projectile size.

### Validation (this pass)

- `node --check game.js` passed.
- Playwright muzzle validation passed:
  - `output/web-game-muzzle-check-v5/shot-0.png`
  - state shows `bullets.player:1`, `bullets.enemy:1`, `muzzleFlash:true`
- No `errors-0.json` file was produced for the final muzzle validation.

## Flash Tip + Trooper Scale Match

- Added `TROOPER_VISUAL_SCALE` so troopers match the player's 32x48 body scale instead of inheriting the smaller 28x44 base box directly.
- Added `MUZZLE_FLASH_FORWARD_OFFSET` and moved both player and enemy flash blooms slightly forward along their aim vector so the flash sits on the barrel tip instead of inside the sprite.
- Kept bullet spawn math on the real fitted sprite bounds, so the flash lead is visual-only and does not reintroduce knee/torso bullet drift.

### Validation (this pass)

- `node --check game.js` passed.
- Playwright muzzle validation rerun with start click + debug scene:
  - `output/web-game-muzzle-check-v7/shot-0.png`
  - state shows `mode:"paused"`, `muzzleFlash:true`, `bullets.player:1`, `bullets.enemy:1`
- No `errors-0.json` file was produced for the final `v7` validation capture.

## Precision Muzzle Raise

- Raised the default player forward muzzle anchor from `{ x: 0.81, y: 0.43 }` to `{ x: 0.83, y: 0.39 }` so rifle shots align more cleanly with the imported standing fire frame.
- Nudged the trooper forward-fire muzzle anchor upward from `y: 0.38` to `y: 0.35` so enemy rounds also sit closer to the barrel line.

### Validation (this pass)

- `node --check game.js` passed.
- Playwright muzzle validation rerun with start click + debug scene:
  - `output/web-game-muzzle-check-v8/shot-0.png`
  - state shows `mode:"paused"`, `muzzleFlash:true`, `bullets.player:1`, `bullets.enemy:1`
- No `errors-0.json` file was produced for the final `v8` validation capture.

## Ground Diagonal Aim Fix

- Corrected `player_idle_diag_sheet.png` in `tools/build_superprobotector_player_pack.py` to use the actual diagonal-up source frames (`22/23`) instead of the mistaken forward-fire frames.
- Rebuilt and reimported the PNG player sheets so the browser now loads the corrected diagonal art.
- Limited player recoil offset in `drawPlayer()` to forward left/right poses (`player_idle` / `player_run`) so diagonal aim no longer bounces vertically when firing.
- Kept grounded diagonal idle poses on their base diagonal art during muzzle flash, while climb/hang angle-specific fire frames remain available.
- Added dedicated grounded debug scenarios:
  - `?scenario=ground-aimlock-diag-check`
  - `?scenario=ground-aimlock-diag-fire-check`

### Validation (this pass)

- `node --check game.js` passed.
- `python -m py_compile tools/build_superprobotector_player_pack.py tools/import_png_sprite_sheets.py` passed.
- Rebuilt/imported sheets:
  - `python tools/build_superprobotector_player_pack.py --overwrite`
  - `python tools/import_png_sprite_sheets.py --overwrite`
- Playwright captures passed with no error files:
  - `output/web-game-ground-aimlock-diag-v2/shot-0.png`
  - `output/web-game-ground-aimlock-diag-fire-v2/shot-0.png`
- State verification:
  - grounded diagonal pose reports `pose:"player_idle_diag"` with `aim.mode:"diag"`
  - grounded diagonal fire reports `pose:"player_idle_diag"`, `muzzleFlash:true`, `bullets.player:1`

## Boss / Miniboss Sheet Import Pass

- Inspected the new boss/miniboss sprite sheets added under `assets/sprites`.
- The showcase atlas pages (`4151960d-...png`, `cf675bec-...png`, `2c75dceb-...png`, `9fcdce5d-...png`) were reviewed first, but their panel chrome/text makes them better suited to a later manual crop pass or boss-intro art.
- Used the clean black-background source sheet `assets/sprites/b18a73cc-f03f-4167-afef-fcb5df893387.png` as the live gameplay import source because it slices cleanly into isolated transparent boss parts.
- Added `tools/build_boss_sprite_sheets.py` to:
  - slice the clean black source sheet into standalone frames
  - repack selected frames into 160x160 PNG strips
  - update `assets/sprites/sheets/png16/sheet_manifest.json`
- Generated and imported live strips for:
  - `enemy_mech_crawler_idle / walk / attack`
  - `enemy_boss_giantskull_idle / walk / attack`
  - `enemy_boss_demonspider_idle / walk / attack`
  - `enemy_boss_cyberbrute_idle / walk / attack`
- Reimported the PNG frame pipeline:
  - `python tools/build_boss_sprite_sheets.py --overwrite`
  - `python tools/import_png_sprite_sheets.py --overwrite`
- Wired runtime style routing in `game.js`:
  - level 1 boss -> `giantskull`
  - level 2 boss -> `demonspider`
  - level 3 boss -> `cyberbrute`
  - mech minibosses -> `crawler`
- Added focused debug scenes for visual validation:
  - `?scenario=boss-style-check`
  - `?scenario=boss-demonspider-check`
  - `?scenario=boss-cyberbrute-check`
  - `?scenario=mech-style-check`
- Added a small debug-only pause-overlay bypass for those inspection scenes so boss bodies remain visible in captures.
- Fixed the runtime renderer bug where style tables used `base` instead of `baseKey`; before this fix, bosses/mechs fell back to the orange placeholder despite valid manifest entries.

### Validation (this pass)

- `python -m py_compile tools/build_boss_sprite_sheets.py` passed.
- `python tools/build_boss_sprite_sheets.py --overwrite` passed.
- `python tools/import_png_sprite_sheets.py --overwrite` passed.
- `node --check game.js` passed.
- Direct strip inspection passed:
  - `assets/sprites/sheets/png16/enemy_boss_giantskull_walk_sheet.png`
  - `assets/sprites/sheets/png16/enemy_boss_demonspider_walk_sheet.png`
  - `assets/sprites/sheets/png16/enemy_boss_cyberbrute_walk_sheet.png`
  - `assets/sprites/sheets/png16/enemy_mech_crawler_attack_sheet.png`
- Playwright visual validation passed after fixing the `baseKey` mapping:
  - `output/web-game-boss-giantskull-v5/shot-0.png`
  - `output/web-game-boss-demonspider-v4/shot-0.png`
  - `output/web-game-boss-cyberbrute-v4/shot-0.png`
  - `output/web-game-mech-crawler-v5/shot-0.png`
  - live encounter smoke test: `output/web-game-skip-boss-style-v1/shot-0.png`
- The only console issue still present in those browser runs was the existing `ERR_CONNECTION_REFUSED` resource error, which predates the sprite import and did not block the new boss art from loading.

## Hang Drop Release Fix

- Fixed the overhead-bar hang trap where the player could get stuck hanging with no clean way to fall.
- Added explicit bar release on `Down` while hanging when `X` aim-lock is not held.
- Reused a short release timer (`PLAYER_HANG_RELEASE`) so the player does not instantly re-grab the same bar on the next frame.
- Kept `X` hanging aim-lock behavior intact, so `X + direction` still works for hanging combat while plain `Down` releases the bar.
- Updated control text in both the DOM splash and the in-canvas splash card to show `Drop From Bars: Hold Down`.
- Added debug scenario `?scenario=hang-drop-check` for automated validation.

### Validation (this pass)

- `node --check game.js` passed.
- Playwright hang-drop validation passed:
  - `output/web-game-hang-drop-v4/shot-0.png`
  - state after input: `hanging:false`, `onGround:true`, `support:"platform"`
- Gameplay smoke test passed after the traversal fix:
  - `output/web-game-smoke-after-hangfix-v1/shot-0.png`
  - state shows normal level start flow with no hang regression.
- No `errors-0.json` file was produced for the final hang-drop or smoke captures.

## Extra Boss Atlas Follow-Up

- Built a repeatable atlas importer for additional boss/miniboss sheets in `tools/build_boss_sprite_sheets.py`.
- Added extraction recipes for:
  - `Iron Skull Commander`
  - `Skull Tank`
  - `Mech Walker`
- Rebuilt/imported those strips into the sprite manifest successfully.
- I did **not** leave those new atlas-derived encounters active in the live levels yet:
  - `Iron Skull` and `Skull Tank` still need one more cleanup pass to remove remaining atlas/panel background contamination.
  - `Mech Walker` frames import correctly on disk, but the live runtime draw path still needs one more pass before it can replace the stable mech without placeholders.
- The stable live level enemy roster was restored after validation so the hang fix ships cleanly without regressing gameplay visuals.

## Audio Integration Pass

- Added a real browser audio layer in `game.js`:
  - inline audio manifest support via `window.NUCLEAR_COMMANDO_AUDIO_MANIFEST`
  - stage music, boss music, clear/game-over stingers
  - pooled SFX playback with per-event throttling
  - persistent mute + volume prefs through `localStorage`
  - `M` mute toggle
- Wired audio events into gameplay flow:
  - campaign start
  - stage transitions
  - boss encounter
  - checkpoint activation
  - jumping
  - player fire / enemy fire
  - pickups and upgrades
  - hits, deaths, explosions, nuclear blast
- Added browser-safe audio bundle files:
  - `assets/sfx/manifest.json`
  - `assets/sfx/manifest.js`
- Added `audio-lab.html` for in-browser preview/remapping of the numbered SFX without editing code.
- Updated `index.html` and `styles.css` so the splash exposes:
  - `Mute: M`
  - `Open Audio Lab`

### Validation (this pass)

- `node --check game.js` passed.
- Splash validation:
  - screenshot: `output/web-game-audio-splash-v1/shot-0.png`
  - state confirms `audio.enabled:true`, `audio.unlocked:false`
- Gameplay validation:
  - screenshot: `output/web-game-audio-gameplay-v1/shot-0.png`
  - state: `output/web-game-audio-gameplay-v1/state-0.json`
  - confirms `audio.currentMusicKey:"stage1"`
  - no `errors-0.json`
- Boss validation:
  - screenshot: `output/web-game-audio-boss-v1/shot-0.png`
  - state confirms `audio.currentMusicKey:"boss_main"`
  - no `errors-0.json`
- Audio lab validation:
  - screenshot: `output/web-game-audio-lab-v1/shot-0.png`
  - no `errors-0.json`

### Notes / TODO

- The numbered SFX are still provisional mappings. Use `audio-lab.html` to audition and remap them properly by ear.
- One gameplay Playwright run timed out after producing valid artifacts once looping audio was active, but the generated screenshot/state were valid and the follow-up boss/audio-lab runs completed cleanly.

## Music Ducking Pass

- Added dynamic music ducking in `game.js` so louder SFX briefly push the BGM down and then let it recover smoothly.
- Audio state now tracks:
  - `musicDuck`
  - `musicDuckTarget`
  - `musicDuckHoldT`
  - attack/release tuning for the recovery curve
- Added `updateAudio(dt)` into the main step loop so ducking continues during gameplay and boss-death explosions.
- Tuned ducking depth per event instead of treating all sounds the same:
  - light duck: jump, pickups
  - medium duck: rifle fire, enemy shots, player hits
  - heavy duck: explosions, boss alarms, player death
  - strongest duck: nuclear blast
- Added duck state to `render_game_to_text` under `audio.duck` and `audio.duckTarget`.

### Validation (this pass)

- `node --check game.js` passed.
- Live combat validation screenshot:
  - `output/web-game-audio-duck-live-v1/shot-0.png`
- Live combat state:
  - `output/web-game-audio-duck-live-v1/state-0.json`
  - confirms `audio.currentMusicKey:"stage1"`
  - confirms active ducking with `audio.duck:0.69`
- The existing browser console `ERR_CONNECTION_REFUSED` resource error still appears in one capture run, but it predates the ducking logic and did not block audio state or rendering.
