import { writeFileSync, mkdirSync } from 'node:fs';
import {
  BALCONY,
  BOARD_FOOTPRINT,
  BOOTH_FOOTPRINT,
  SHELL,
  TOTAL_TRIB_SEATS,
  VENUE_SEATS,
  VENUE_SEAT_COUNT,
  VENUE_WORLD,
  shellPoint,
} from '../src/scene/venue/layout.ts';

const failures: string[] = [];
function check(name: string, condition: boolean, detail = ''): void {
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(name);
}

const counts = VENUE_SEATS.reduce<Record<string, number>>((acc, seat) => {
  acc[seat.categoryKey] = (acc[seat.categoryKey] ?? 0) + 1;
  return acc;
}, {});

check('446 total seats', VENUE_SEAT_COUNT === 446, String(VENUE_SEAT_COUNT));
check('VIP = 48', counts.VIP === 48, String(counts.VIP));
check('CAT1 = 128', counts.CAT1 === 128, String(counts.CAT1));
check('TRIB = 120', counts.TRIB === 120, String(counts.TRIB));
check('REG = 150', counts.REG === 150, String(counts.REG));
check('TRIB = 3 rows x 20 x 2 sides', TOTAL_TRIB_SEATS === 120, String(TOTAL_TRIB_SEATS));

const ids = new Set(VENUE_SEATS.map((seat) => seat.id));
for (const id of ['VIP-A1', 'VIP-D12', 'CAT1-E1', 'CAT1-L16', 'REG-M1', 'REG-Q30', 'TRIBL-A1', 'TRIBR-C20']) {
  check(`id ${id}`, ids.has(id));
}

// Pairwise spacing, mirroring the original seat-layout test.
let minimumDistance = Infinity;
for (let a = 0; a < VENUE_SEATS.length; a += 1) {
  for (let b = a + 1; b < VENUE_SEATS.length; b += 1) {
    const A = VENUE_SEATS[a];
    const B = VENUE_SEATS[b];
    minimumDistance = Math.min(
      minimumDistance,
      Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z),
    );
  }
}
check('seat spacing >= 0.8 m', minimumDistance >= 0.8, minimumDistance.toFixed(3));

const floorSeats = VENUE_SEATS.filter((seat) => seat.categoryKey !== 'TRIB');
const tribSeats = VENUE_SEATS.filter((seat) => seat.categoryKey === 'TRIB');
const floorMaxZ = Math.max(...floorSeats.map((seat) => seat.z)) + 0.42 + 0.2;
check(
  'board footprint clears rear floor seats',
  BOARD_FOOTPRINT.minZ - floorMaxZ >= 1.5,
  `${(BOARD_FOOTPRINT.minZ - floorMaxZ).toFixed(2)} m`,
);
check(
  'booth footprint clears rear floor seats',
  BOOTH_FOOTPRINT.minZ - floorMaxZ >= 1.5,
  `${(BOOTH_FOOTPRINT.minZ - floorMaxZ).toFixed(2)} m`,
);

for (const placement of [VENUE_WORLD.southEdge.board, VENUE_WORLD.southEdge.booth]) {
  check(
    `south placement ${placement === VENUE_WORLD.southEdge.board ? 'board' : 'booth'} inside courtyard X`,
    placement.x - placement.halfWidth >= VENUE_WORLD.courtyard.minX &&
      placement.x + placement.halfWidth <= VENUE_WORLD.courtyard.maxX,
  );
  check(
    `south placement ${placement === VENUE_WORLD.southEdge.board ? 'board' : 'booth'} inside courtyard Z`,
    placement.z <= VENUE_WORLD.courtyard.maxZ - 1,
  );
}

// TRIB seats should sit inside the shell and clear the atria drums.
const atriaCenters = Object.values(BALCONY.atria).map((spec) => {
  const angle = spec.angle * Math.PI;
  const point = shellPoint(angle);
  const nx = Math.cos(angle) / SHELL.radiusX;
  const nz = Math.sin(angle) / SHELL.radiusZ;
  const length = Math.hypot(nx, nz);
  return {
    x: point.x - (nx / length) * spec.offset,
    z: point.z - (nz / length) * spec.offset,
    radius: spec.radius,
  };
});
let tribInside = true;
let tribClearAtria = true;
for (const seat of tribSeats) {
  const shellR = Math.hypot(seat.x / SHELL.radiusX, seat.z / SHELL.radiusZ);
  if (shellR > 1 || shellR < 0.75) tribInside = false;
  if (seat.y < BALCONY.rowY[0] - 0.01 || seat.y > BALCONY.rowY[2] + 0.01) tribInside = false;
  for (const atrium of atriaCenters) {
    if (Math.hypot(seat.x - atrium.x, seat.z - atrium.z) < atrium.radius + 0.35) {
      tribClearAtria = false;
    }
  }
}
check('TRIB seats lie on the shell-attached balcony band', tribInside);
check('TRIB seats clear the atria drums', tribClearAtria);

// Generate a 2D seat-map preview for the later ticketing migration.
const width = 1000;
const height = 800;
const scale = 7;
const originX = width / 2;
const originZ = height / 2 - 7;
const toX = (x: number) => originX + x * scale;
const toY = (z: number) => originZ + z * scale;
const color: Record<string, string> = {
  VIP: '#f5c542',
  CAT1: '#9b7bff',
  TRIB: '#38bdf8',
  REG: '#2dd4bf',
};
const parts: string[] = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`);
parts.push(`<rect width="${width}" height="${height}" fill="#0b0912"/>`);
parts.push(`<rect x="${toX(-48)}" y="${toY(-40)}" width="${96 * scale}" height="${80 * scale}" fill="none" stroke="#4dd0e1" stroke-width="1.5" opacity="0.7"/>`);
parts.push(`<rect x="${toX(-22)}" y="${toY(-18)}" width="${44 * scale}" height="${41 * scale}" fill="none" stroke="#ffd166" stroke-width="1.5"/>`);
parts.push(`<rect x="${toX(-13)}" y="${toY(-17.5)}" width="${26 * scale}" height="${9 * scale}" fill="#ff8a65" opacity="0.35" stroke="#ff8a65"/>`);
parts.push(`<text x="${toX(0)}" y="${toY(-19.5)}" fill="#ff8a65" font-family="sans-serif" font-size="12" text-anchor="middle">STAGE</text>`);

// Balcony bands.
for (const side of ['east', 'west'] as const) {
  const range = side === 'east' ? BALCONY.eastAngleRange : BALCONY.westAngleRange;
  const start = range[0] * Math.PI;
  const end = range[1] * Math.PI;
  const samples = 36;
  const inner: string[] = [];
  const outer: string[] = [];
  for (let i = 0; i < samples; i += 1) {
    const angle = start + ((end - start) * i) / (samples - 1);
    const point = shellPoint(angle);
    const nx = Math.cos(angle) / SHELL.radiusX;
    const nz = Math.sin(angle) / SHELL.radiusZ;
    const len = Math.hypot(nx, nz);
    const ox = point.x + (nx / len) * 0.2;
    const oz = point.z + (nz / len) * 0.2;
    const ix = point.x + (nx / len) * 6;
    const iz = point.z + (nz / len) * 6;
    outer.push(`${i === 0 ? 'M' : 'L'}${toX(ox)},${toY(oz)}`);
    inner.push(`${i === 0 ? 'M' : 'L'}${toX(ix)},${toY(iz)}`);
  }
  parts.push(`<path d="${outer.join(' ')}" fill="none" stroke="#64b5f6" stroke-width="2" opacity="0.8"/>`);
  parts.push(`<path d="${inner.join(' ')}" fill="none" stroke="#64b5f6" stroke-width="2" opacity="0.8"/>`);
}

// Seats.
for (const seat of VENUE_SEATS) {
  const isTrib = seat.categoryKey === 'TRIB';
  const radius = isTrib ? 3.2 : 2.6;
  parts.push(
    `<circle cx="${toX(seat.x).toFixed(1)}" cy="${toY(seat.z).toFixed(1)}" r="${radius}" fill="${color[seat.categoryKey]}" opacity="${isTrib ? 1 : 0.9}"/>`,
  );
}

// Board and booth footprints.
function rotatedRect(x: number, z: number, hw: number, hd: number, rot: number, fill: string): string {
  const corners = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([px, pz]) => {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    return `${toX(x + px * cos + pz * sin).toFixed(1)},${toY(z - px * sin + pz * cos).toFixed(1)}`;
  });
  return `<polygon points="${corners.join(' ')}" fill="${fill}" opacity="0.55" stroke="${fill}" stroke-width="1.5"/>`;
}
parts.push(rotatedRect(VENUE_WORLD.southEdge.board.x, VENUE_WORLD.southEdge.board.z, 2.8, 0.3, 2.72, '#ff6ec7'));
parts.push(rotatedRect(VENUE_WORLD.southEdge.booth.x, VENUE_WORLD.southEdge.booth.z, 1.8, 0.9, -2.72, '#ff5c5c'));
parts.push(`<text x="${toX(-9)}" y="${toY(24.5)}" fill="#ff6ec7" font-family="sans-serif" font-size="10" text-anchor="middle">BOARD</text>`);
parts.push(`<text x="${toX(9)}" y="${toY(24.5)}" fill="#ff5c5c" font-family="sans-serif" font-size="10" text-anchor="middle">BOOTH</text>`);
parts.push(`<text x="${toX(0)}" y="${height - 20}" fill="#f4ead9" font-family="sans-serif" font-size="12" text-anchor="middle">Sawarga ticketing layout · ${VENUE_SEAT_COUNT} seats · 44 × 41 event floor · curved shell balconies</text>`);
parts.push('</svg>');

mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/venue-seat-map.svg', parts.join('\n'));
console.log('Wrote artifacts/venue-seat-map.svg');

if (failures.length > 0) {
  console.error(`\n${failures.length} venue check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll venue checks passed: ${VENUE_SEAT_COUNT} seats, ${TOTAL_TRIB_SEATS} curved TRIB.`);
