# Sawarga Courtyard — progress

## Intent

Build a free, stylized-realistic, freely walkable Three.js reconstruction of Sawarga Courtyard at Summarecon Mall Bandung from three reference photos and the mall floor plan. Keep the plaza clean so the environment can be reused. Desktop + mobile. Summarecon branding included at the owner's request. No paid APIs.

## Decisions

- **Interpretive reconstruction**, not photogrammetry. Manual/procedural architecture + free CC0 textures/HDRIs.
- **Clean plaza**: no event stage, tents, basketball court, or crowd.
- **ACES tone mapping** for a warmer, more saturated look than AgX in this scene.
- **Hand-painted sky** per time of day; HDRI retained for environment/reflection lighting.
- **Merged static batches** by material; instanced trees, vines, shrubs, benches, and poles.
- **Frozen shadows** after the first frames; refreshed on time/quality changes.
- **Quality tiers**: low/medium/high/auto, with pixel ratio, shadow map, and environment intensity scaling.
- **Mobile FOV 66°** in portrait; 55° desktop.
- **Clean, reusable modules**: `src/scene/config.ts` holds dimensions; branding is its own module.

## Completed

- Git repo initialized; baseline commit; work on `feat/sawarga-courtyard`.
- Vite + Three.js + TypeScript project at repo root.
- Procedural paving with Delaunator, grout, color variation, central medallion, stone curb.
- Facade ring: brick arch walls with stone archivolts, vents, string courses, parapet, vines; two-level arcade; storefronts; south portal; Downtown Walk passage; three glass atria with warm cores and canopy.
- Landscape: instanced trees (two variants), planter shrubs, perimeter shrubs, vines, stone benches, light poles.
- Branding: Summarecon Mall wall sign, Sawarga Courtyard portal sign, Downtown Walk sign.
- Context: mall roof with panel seams, skylights, green roof strips, rooftop units, distant city/treeline.
- Lighting: custom sunset/day skies, HDRI environments, warm key/fill, fog, ACES, quality-scaled shadows.
- Controls: desktop pointer-lock WASD, fly, orbit, sprint; mobile joystick + look + fly/up/down; camera presets with eased transitions; ellipse + obstacle collision.
- UI: loading screen, title, toolbar, quality popover, help modal, presets, toasts, debug overlay, responsive mobile controls.
- QA: test hooks, evidence manifest, canvas inspector pass, evidence checker pass, mobile/desktop screenshots.

## Evidence

- `artifacts/evidence.json` — pass `courtyard-pass-6`.
- `artifacts/courtyard-pass-6/` — 6 reports + screenshots.
- Inspector results: all 6 pass; strongest desktop balcony (entropy 6.57, contrast 182.5); mobile plaza 5.93/146.3.
- `check_evidence.py` passed: 9 artifacts confirmed.
- Headed performance on AMD Radeon Vega 8: 5.32 ms average / 188 fps uncapped at 1440×900 auto-medium; 5.83 ms / 171 fps high; 5.27 ms / 190 fps mobile auto-low. 44 draw calls, 39,570 triangles, 21 textures.
- Note: headless Chromium uses SwiftShader; performance must be measured headed.

## Remaining / optional next passes

- Optional event kit (tents, stage, basketball, crowd) as a toggle, preserving the clean default.
- Optional GLB export of the static scene for Blender/Unity/other Three.js projects.
- Optional audio ambience (fountain/plaza) and subtle animated foliage.
- Deeper mall interiors / walkable upper-level balcony.
- More facade variation on the south storefronts (currently repeating modules).
- Sky clouds could be more pronounced in the thin visible band; current sky is intentionally soft.
- Commercial use of the Summarecon mark requires permission.

## Commands

```bash
npm run dev            # 5188
npm run build
npm run preview
npm run inspect:canvas -- --manifest artifacts/evidence.json --url http://127.0.0.1:5188 --seed 42
```


