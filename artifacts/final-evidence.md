# Sawarga Courtyard — final evidence

**Result:** a playable, responsive Three.js architectural walkthrough of Sawarga Courtyard, built from the three reference photos and the mall floor plan. It is a stylized-realistic interpretation, not a photogrammetric capture. The plaza is intentionally clean for reuse.

## What runs

- Vite + TypeScript + Three.js app at the repo root.
- Desktop: pointer-lock walk, sprint, fly, orbit, camera presets, time-of-day, quality presets.
- Mobile: floating joystick, drag-look, fly toggle, vertical buttons, preset pills, responsive layout.
- Static architecture merged by material; instanced trees/vines/shrubs/benches/poles; frozen shadows; quality scaling.

## Verification commands

```bash
npm run build
npm run dev                     # http://127.0.0.1:5188
npm run smoke                   # headed browser; functional controls + mobile touch
npm run performance -- --headed # headed browser; real GPU frame times
node scripts/inspect-threejs-canvas.mjs \
  --manifest artifacts/evidence.json --url http://127.0.0.1:5188 --seed 42
python "C:\Users\Asus\.agents\skills\threejs-game-director\scripts\check_evidence.py" \
  . --manifest artifacts/evidence.json
```

## Evidence pass 5 — `artifacts/courtyard-pass-6/`

Six declared captures, all PASS, checker passed (9 artifacts confirmed). Desktop 1280×720; mobile 390×844.

| Capture | Entropy | Edge density | Contrast | Dominant |
| --- | --- | --- | --- | --- |
| Desktop plaza | 6.12 | 0.410 | 158.1 | 0.068 |
| Desktop balcony | 6.57 | 0.441 | 182.5 | 0.072 |
| Desktop overview | 5.09 | 0.316 | 113.0 | 0.270 |
| Desktop day plaza | 6.56 | 0.395 | 201.9 | 0.054 |
| Mobile plaza | 5.93 | 0.317 | 146.3 | 0.074 |
| Mobile overview | 5.58 | 0.338 | 112.9 | 0.153 |

Screenshots: [desktop plaza](artifacts/courtyard-pass-6/desktop-plaza.png), [balcony](artifacts/courtyard-pass-6/desktop-balcony.png), [overview](artifacts/courtyard-pass-6/desktop-overview.png), [day](artifacts/courtyard-pass-6/desktop-day-plaza.png), [mobile plaza](artifacts/courtyard-pass-6/mobile-plaza.png), [mobile overview](artifacts/courtyard-pass-6/mobile-overview.png).

**Note on the inspector:** headless Chromium on this machine uses SwiftShader (software WebGL), which is fine for pixel captures but not for frame-rate claims. The inspector's `gpu` label should not be read as a hardware performance proof. Headed timed runs are below.

## Performance — headed browser

Measured with `scripts/performance.mjs --headed` on the available AMD Radeon Vega 8 (the browser's active GPU). A normal display caps to 60 fps; these are uncapped headroom numbers.

| Mode | Quality | Avg frame | FPS (uncapped) | Calls | Triangles | Textures |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop 1440×900 | auto / medium | 5.32 ms | 188 | 44 | 39,570 | 21 |
| Desktop 1440×900 | high | 5.83 ms | 171 | 44 | 39,570 | 21 |
| Mobile 390×844 | auto / low | 5.27 ms | 190 | 44 | 39,570 | 21 |

The frame budget is comfortably met. Static shadow maps are frozen after the first frames and refreshed on time/quality changes.

## Functional smoke test

`npm run smoke` (headed) passed all checks:

- Help opens and closes with Escape.
- Quality menu opens and switches to High; returns to Auto.
- Time toggles sunset → day → sunset.
- Overview preset enters orbit; Plaza preset returns to walk.
- `W` moves the camera 1.32 m in 450 ms.
- Mobile controls visible; Fly toggles to fly and back.
- Synthetic touch joystick appears and moves the camera 0.97 m.
- Synthetic touch look changes yaw 0.06 → 0.27 rad.

## Visual assessment

This is a polished **architectural visualization**, not a game, so the game-specific VFX/motion category is out of scope. Using the scorecard's 0–3 language for the surfaces that exist:

| Category (adapted) | Score | Evidence |
| --- | --- | --- |
| Art direction | 3 | Warm sunset identity drives the brick/stone/glass palette, signage, UI, and camera framing. |
| Focal architecture | 2.5 | Hero brick wall + Summarecon sign, south portal, and glass atria read clearly; repeated south modules keep it from showcase. |
| Facade rhythm | 2.5 | Archivolts, vents, string courses, balconies, and shopfronts create a readable hierarchy. |
| Points of interest | 2 | Three camera presets and day/sunset; no interactive hotspots or information overlay. |
| World/context | 2.5 | Layered courtyard, roof, treeline, and distant city; the aerial roof/city is still simple. |
| Materials | 2.5 | PBR brick, stone, glass, metal, procedural paving; brick/paving repetition is visible up close. |
| Lighting/render | 2.5 | ACES, warm key + fill, custom sky, soft shadows, fog; no GI/SSAO, and the sunset mobile crop is low-contrast in the foreground. |
| Motion/VFX | N/A | Static architectural viewer by design; foliage does not animate. |
| UI | 2.5 | Minimal, responsive, safe-area aware; mobile buttons occupy significant screen space. |
| Performance | 3 | 44 draw calls, 39.6k triangles, 21 textures, 5.3 ms average frame on the tested iGPU. |

Average of scored categories: **2.55**. The result is stylized-realistic and cohesive; it does not claim AAA game-premium status, because the scene is static and several surfaces (south modules, roof, distant city) are intentionally simplified.

## Known limitations

- Interpretive reconstruction: hidden sides/occluded areas are invented; not a survey.
- Clean plaza: event stage/tents/basketball/crowd intentionally absent.
- Walking is plaza/ground-floor only; upper levels via fly/orbit.
- No audio, animated foliage, interactive hotspots, or GLB export yet.
- Summarecon marks belong to their owners; obtain permission for commercial use.

## Credits

Poly Haven (CC0) HDRIs and red brick PBR maps; Three.js (MIT); Vite; Delaunator (ISC); Cormorant Garamond and Inter (OFL). Procedural sky, paving, signs, interiors, foliage textures, and geometry authored in this project.

