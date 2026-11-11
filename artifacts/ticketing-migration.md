# Ticketing migration checklist

**Status:** prepared only. The original `D:\programming\ticketing-system` project has **not** been modified.

## Contract

- Units: meters, Y-up.
- Origin: `(0, 0, 0)`, ground at `y = 0`, scale `1`.
- Event floor: the original **44 × 41 m** courtyard (`x −22…22`, `z −18…23`).
- Shell-attached balconies: Sawarga ellipse `radiusX = 35`, `radiusZ = 25`, 6 m deep, TRIB band `z −10.5…11.35`.
- Stage, VIP, CAT 1, REG, board, and booth stay at their original coordinates.
- Seat count remains **446** (VIP 48, CAT 1 128, TRIB 120, REG 150); TRIB only changes position/rotation.

## Copy-ready source in the playground

- `src/scene/venue/layout.ts` — pure TS; world constants, `buildTribSeats()`, `buildVenueSeats()`, curved-shell math, board/booth footprints. No Three.js imports.
- `src/scene/venue/balconies.ts` — curved decks, railings, atria portals/bridges, retained original stairs, new access towers.
- `src/scene/venue/eventProxies.ts` — stage/seats/board/booth proxies used for the fit preview.
- `src/scene/venue/overlay.ts` — dimension/layout overlay.
- `scripts/verify-venue.ts` — 446-seat/clearance/spacing checks + 2D SVG preview.
- `artifacts/venue-seat-map.svg` — generated seat-map preview.

## Changes to apply later in the ticketing project

1. **Seat data** — copy `buildTribSeats()` / `buildVenueSeats()` into `src/lib/seatLayout.ts` (or import the pure module). Keep the existing VIP/CAT1/REG code and IDs. TRIB seats gain a `rotationY` field.
2. **World layout** — in `src/components/scene/summaba/layout.ts`:
   - Keep `WORLD.bounds`, `courtyard`, `stage`, `stageObstacle`, `southEdge`.
   - Replace the rectangular `WORLD.balcony` with the curved shell band. Add a `balconyBandAt(x,z)` or segment list; update `floorHeightAt` and `resolveWalkable`'s upper-level check.
   - Keep the original stairs at `x ±18…21, z 14…20`; add the atria access and the new NW/NE towers; update `planWalkRoute`.
   - Extend `standTarget`'s x clamp from ±24 to the new balcony x extents.
   - Add the curved deck/atria/stage to `CAMERA_BLOCKERS` / `clearCameraPosition`.
3. **Balcony visuals** — replace `Balconies.tsx`'s straight decks with the curved shell decks. Either:
   - copy `src/scene/venue/balconies.ts` and render the returned `THREE.Group` via `<primitive object={...} />`, or
   - export the group as GLB and load with `useGLTF`.
4. **Seat component** — in `PlazaScene.tsx`'s `Seats`, rotate TRIB pads/backs by `seat.rotationY`; keep floor seats at rotation 0. Rotate the back offset by the same yaw.
5. **2D map** — in `SeatMap2D.tsx`, replace the fixed `x = 320 + seat.x*14` / `y = 20 + (seat.z+24)*12` scaling with a computed fit over all seat extents (the TRIB band now reaches about x ±35). Use `artifacts/venue-seat-map.svg` as the visual reference.
6. **Tests** — update:
   - `tests/seat-layout.test.ts`: TRIB x bounds / y rows / spacing; keep counts and IDs.
   - `tests/summaba-layout.test.ts`: curved balcony floor heights, new stairs/routes, camera keep-out.
   - `tests/south-edge.test.ts`: should continue to pass (floor seat max z and board/booth positions are unchanged).
7. **Landscape** — remove or relocate the old perimeter trees that intersect the curved decks. The playground uses six low venue trees at `x ±20.5, z −7/1/7` (scale ~0.55–0.72) so the balcony sightline stays clear.
8. **Lighting/performance** — keep the environment outside the original night renderer/controls. The playground's curved balcony/access layer is merged/instanced; measure the merged draw calls on the original's <150 mobile budget. Do not import the playground sky/HDRI/controls.
9. **Quotas/seed** — not needed while TRIB stays 120. If the TRIB count is adjusted later, update the quota, seed, and `TOTAL`/category counts together.

## Name/layout note

The playground's existing atria are **Ciunik SW, Cibadak SE, Cileutik NE** (the better representation requested for this project). The original design spec names them Ciunik N, Cibadak E, Cileutik W. The ticketing event floor and board/booth do not depend on the atrium names, but the Venue Map / Mall operations copy should be reconciled when the environments are merged.

## Verification performed in the playground

```bash
npm run verify:venue
npm run build
npm run smoke
npm run performance -- --headed
node scripts/inspect-threejs-canvas.mjs \
  --manifest artifacts/evidence.json --url http://127.0.0.1:5188 --seed 42
```

- 446 seats verified; TRIB 120; spacing ≥ 0.828 m.
- Board/booth clear the rear floor seats by 2.26 m / 2.12 m.
- TRIB seats lie on the shell band and clear the atria drums.
- 2D preview: `artifacts/venue-seat-map.svg`.
