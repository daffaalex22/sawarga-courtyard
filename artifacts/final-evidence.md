# Sawarga Courtyard — final evidence

**Result:** a playable, responsive Three.js Sawarga Courtyard with a prepared **ticketing venue layer**: the original ticketing system's 44 × 41 m event floor, 446 seat proxies, stage, board, booth, and curved shell-attached TRIB balconies inside the larger 70 × 50 m Sawarga shell. The original ticketing project remains untouched.

## What runs

- Vite + TypeScript + Three.js app at the repo root.
- Desktop: pointer-lock walk, sprint, fly, orbit, camera presets, day/sunset, quality presets.
- Mobile: floating joystick, drag-look, fly toggle, vertical buttons, preset pills, responsive layout.
- Layers icon toggles the event proxies; `L` (or `?layout=1`) shows the dimension overlay.
- Permanent additions: curved shell-attached balconies, atria portals/bridges, retained original stairs with bridges, NE/NW access towers, venue-side trees.
- Proxies: 446 seat pads, stage/backdrop/truss, announcement board, ticket booth.

## Verification commands

```bash
npm run verify:venue             # 446 seats, TRIB curve, clearances, spacing + SVG
npm run build
npm run dev                      # http://127.0.0.1:5188
npm run smoke                    # headed browser; desktop + mobile controls
npm run performance -- --headed  # headed browser; real GPU frame times
node scripts/inspect-threejs-canvas.mjs \
  --manifest artifacts/evidence.json --url http://127.0.0.1:5188 --seed 42
python "C:\Users\Asus\.agents\skills\threejs-game-director\scripts\check_evidence.py" \
  . --manifest artifacts/evidence.json
```

## Venue fit

- 446 seats verified: VIP 48, CAT1 128, TRIB 120, REG 150.
- TRIB: 3 rows × 20 × 2 sides on curved 6 m shell balconies; same IDs; positions/rotations re-laid.
- Nearest seat spacing: **0.828 m**.
- Board clears rear floor seats by **2.26 m**; booth by **2.12 m**.
- TRIB seats lie on the shell-attached balcony band and clear the atria drums.
- 2D preview: [`artifacts/venue-seat-map.svg`](venue-seat-map.svg).

## Evidence pass 9 — `artifacts/courtyard-pass-9/`

Eight declared captures, all PASS, checker passed (13 artifacts confirmed). Desktop 1280×720; mobile 390×844.

| Capture | Entropy | Edge density | Contrast | Dominant |
| --- | --- | --- | --- | --- |
| Desktop plaza | 6.46 | 0.378 | 176.3 | 0.096 |
| Desktop balcony | 7.41 | 0.484 | 179.9 | 0.035 |
| Desktop overview | 5.22 | 0.328 | 117.0 | 0.272 |
| Desktop layout | 5.32 | 0.344 | 117.6 | 0.268 |
| Desktop day plaza | 6.70 | 0.377 | 203.9 | 0.088 |
| Mobile plaza | 5.86 | 0.314 | 168.0 | 0.100 |
| Mobile overview | 5.85 | 0.375 | 116.8 | 0.156 |
| Mobile layout | 5.97 | 0.395 | 117.5 | 0.153 |

Screenshots: [desktop plaza](courtyard-pass-9/desktop-plaza.png), [balcony](courtyard-pass-9/desktop-balcony.png), [overview](courtyard-pass-9/desktop-overview.png), [layout](courtyard-pass-9/desktop-layout.png), [day](courtyard-pass-9/desktop-day-plaza.png), [mobile plaza](courtyard-pass-9/mobile-plaza.png), [mobile overview](courtyard-pass-9/mobile-overview.png), [mobile layout](courtyard-pass-9/mobile-layout.png).

**Inspector note:** headless Chromium on this machine uses SwiftShader (software WebGL), fine for pixel captures but not frame-rate claims. Headed timed runs are below.

## Performance — headed browser

Measured with `scripts/performance.mjs --headed` on the available AMD Radeon Vega 8. A normal display caps to 60 fps; these are uncapped headroom numbers.

| Mode | Quality | Avg frame | FPS (uncapped) | Calls | Triangles | Textures |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop 1440×900 | auto / medium | 9.15 ms | 109 | 61 | 57,328 | 24 |
| Desktop 1440×900 | high | 12.69 ms | 79 | 61 | 57,328 | 24 |
| Mobile 390×844 | auto / low | 6.62 ms | 151 | 59 | 57,272 | 24 |

The event layer adds ~17 draw calls and ~18k triangles versus the clean pass; still comfortably within a 60 fps budget. Static shadow maps are frozen after the first frames and refreshed on time/quality changes.

## Functional smoke test

`npm run smoke` (headed) passed 18 checks:

- Help opens and closes with Escape.
- Quality menu opens and switches to High.
- Event layers button hides/restores the proxies.
- `L` shows/hides the layout overlay.
- Time toggles sunset → day.
- Overview enters orbit; Plaza returns to walk.
- `W` moves the camera ~1.47 m in 450 ms.
- Mobile controls visible; mobile layers button toggles the proxies.
- Fly toggles; synthetic joystick appears and moves ~1.07 m; touch look changes yaw 0.06 → 0.27.

## Visual assessment

This remains a polished **architectural visualization + venue fit layer**, not a game. The new curved balconies are a strong addition; the event proxies are intentionally simple.

| Category (adapted) | Score | Evidence |
| --- | --- | --- |
| Art direction | 3 | Warm sunset identity, brick/stone/glass palette, signage, event layout. |
| Focal architecture | 2.5 | Hero wall/sign, portal, atria, and the new curved balconies read clearly. |
| Facade rhythm | 2.5 | Arches, vents, string courses, balconies, shopfronts. |
| Venue fit | 2.5 | 446 seats and event elements fit the larger shell; board/booth clearances measured. |
| World/context | 2.5 | Courtyard, roof, treeline, city; aerial roof/city still simple. |
| Materials | 2.5 | PBR brick/stone/glass, procedural paving; some repetition. |
| Lighting/render | 2.5 | ACES, key + fill, custom sky, soft shadows; no GI/SSAO. |
| Motion/VFX | N/A | Static viewer; foliage/seat proxies do not animate. |
| UI | 2.5 | Minimal, responsive; mobile controls occupy space; layers toggle added. |
| Performance | 3 | 61 draw calls, 57k triangles, 24 textures, 9.15 ms auto-medium on the tested iGPU. |

Average of scored categories: **2.56**. The result is stylized-realistic and cohesive; it does not claim AAA game-premium status, because the event models are proxies and several surfaces are intentionally simplified.

## Known limitations

- Ticketing seats/stage/board/booth are proxies; the final ticketing components will replace them.
- The original ticketing project has not been modified. Its TRIB seat data, 2D map, collision, and tests still need the migration pass.
- Atria naming/positions follow this Sawarga project (Ciunik SW, Cibadak SE, Cileutik NE); reconcile with the ticketing copy.
- TRIB remains 120; if changed, quotas/seed/2D map/count tests must change together.
- Walking remains ground-level; curved balconies use fly/orbit in this viewer. The ticketing project will use its own character/collision.
- No crowd, tents, audio, or GLB export yet.
- Summarecon marks belong to their owners; obtain permission for commercial use.

## Migration

See [`ticketing-migration.md`](ticketing-migration.md). The copy-ready pure layout is `src/scene/venue/layout.ts`; the generated seat-map preview is `artifacts/venue-seat-map.svg`.

## Credits

Poly Haven (CC0) HDRIs and red brick PBR maps; Three.js (MIT); Vite; Delaunator (ISC); Cormorant Garamond and Inter (OFL). Procedural sky, paving, signs, interiors, foliage textures, venue geometry, and proxies authored in this project.
