# Sawarga Courtyard — progress

## Intent

Build a free, stylized-realistic, freely walkable Three.js Sawarga Courtyard from the reference photos and mall floor plan, then prepare a dimension-compatible **ticketing venue layer** for the Pataka ticketing system. The original ticketing project must remain untouched until a separate integration pass. Desktop + mobile. No paid APIs.

## Decisions

- **Interpretive reconstruction**, not photogrammetry.
- **Event layout layer** inside the larger real-scale Sawarga shell, using the original ticketing system's 44 × 41 m event floor and seat/board/booth/stage coordinates.
- **Option 1 balconies**: curved, shell-attached, 6 m deep, with the 120 TRIB seats re-laid along the curve (same IDs/counts).
- **Atria as access** with short portals/bridges; the original stairs stay as a secondary route with bridges; new NE/NW access towers.
- **Layers toggle** for event proxies; `L`/`?layout=1` for the dimension overlay.
- **TRIB count stays 120** for this pass; the count is parameterized and the user accepts a later adjustment if needed.
- **ACES tone mapping**, hand-painted sky, HDRI environment, merged static batches, instanced vegetation/seats, frozen shadows, quality tiers.
- **Original ticketing project untouched**; migration checklist prepared in `artifacts/ticketing-migration.md`.

## Completed

- Base project: architecture, atria, portal, Downtown passage, paving, landscape, branding, roof/context, lighting, desktop/mobile controls, UI, QA.
- Pure ticketing layout module `src/scene/venue/layout.ts`: world constants, 446 seats, curved TRIB math, board/booth footprints.
- Curved shell-attached balcony geometry `src/scene/venue/balconies.ts`: stepped decks, glass railings, support columns, atria portals/bridges, retained original stairs, NE/NW access towers.
- Event proxies `src/scene/venue/eventProxies.ts`: stage/backdrop/truss/LED panels, 446 seat pads/backs with per-seat stage-facing rotation, announcement board, ticket booth.
- Layout overlay `src/scene/venue/overlay.ts`: 96 × 80 world, 44 × 41 event floor, stage/seat field, board/booth, balconies, atria.
- Landscape cleanup: removed planters/benches/poles intersecting the balconies/event; added six low venue-side trees at x ±20.5 to keep the balcony sightline.
- UI: layers toggle + `L` overlay hotkey + tooltip/help copy.
- QA: `scripts/verify-venue.ts` (446 seats, clearances, spacing, curved band/atria checks) + `artifacts/venue-seat-map.svg`; smoke test expanded to 18 checks; headed performance.
- Evidence pass 9: 8/8 captures PASS; checker passed 13 artifacts.

## Evidence

- `artifacts/evidence.json` — pass `courtyard-pass-9`.
- `artifacts/courtyard-pass-9/` — 8 reports + screenshots.
- Strongest visual capture: desktop balcony (entropy 7.41, contrast 179.9).
- `check_evidence.py` passed: 13 artifacts confirmed.
- Venue verification: 446 seats; TRIB 120; nearest spacing 0.828 m; board/booth clear rear seats by 2.26/2.12 m; TRIB clear atria.
- Headed performance on AMD Radeon Vega 8: 9.15 ms / 109 fps uncapped at 1440×900 auto-medium; 12.69 ms / 79 fps high; 6.62 ms / 151 fps mobile auto-low. 61 draw calls, 57,328 triangles, 24 textures.
- Headless Chromium uses SwiftShader; performance must be measured headed.

## Remaining / optional next passes

- **Integration pass in the ticketing project** (not done): copy `venue/layout.ts` seat data; update `seatLayout.ts`, `layout.ts`, `SeatMap2D`, `Seats` rotation, tests/collision/routes; render the balcony group via `<primitive>` or GLB.
- Replace event proxies with the real ticketing components (seats/status colors, board, booth, stage).
- Decide whether the TRIB count stays 120 or becomes 108/132; update quotas/seed/map/count tests if changed.
- Reconcile atrium names/positions with the ticketing Venue Map/Mall operations copy.
- Optional GLB export of the static environment/balconies.
- Optional event crowd/tents/audio and animated foliage.
- More facade variation; sky clouds could be more pronounced.
- Commercial use of the Summarecon mark requires permission.

## Commands

```bash
npm run dev            # 5188
npm run build
npm run preview
npm run verify:venue
npm run smoke
npm run performance -- --headed
npm run inspect:canvas -- --manifest artifacts/evidence.json --url http://127.0.0.1:5188 --seed 42
```
