import * as THREE from 'three';
import {
  BALCONY,
  BOARD_FOOTPRINT,
  BOOTH_FOOTPRINT,
  VENUE_WORLD,
  shellOffsetPoint,
} from './layout';
import { canvasTexture, createCanvas } from '../../utils/canvas';

const COLORS = {
  world: 0x4dd0e1,
  event: 0xffd166,
  stage: 0xff8a65,
  seats: 0x7bd88f,
  board: 0xff6ec7,
  booth: 0xff5c5c,
  balcony: 0x64b5f6,
  atria: 0xb388ff,
};

interface LineAccumulator {
  positions: number[];
  colors: number[];
}

function pushLine(acc: LineAccumulator, a: THREE.Vector3, b: THREE.Vector3, color: number): void {
  const c = new THREE.Color(color);
  acc.positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  acc.colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
}

function addRect(
  acc: LineAccumulator,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  y: number,
  color: number,
): void {
  const p = (x: number, z: number) => new THREE.Vector3(x, y, z);
  pushLine(acc, p(minX, minZ), p(maxX, minZ), color);
  pushLine(acc, p(maxX, minZ), p(maxX, maxZ), color);
  pushLine(acc, p(maxX, maxZ), p(minX, maxZ), color);
  pushLine(acc, p(minX, maxZ), p(minX, minZ), color);
}

function addRotatedRect(
  acc: LineAccumulator,
  cx: number,
  cz: number,
  halfWidth: number,
  halfDepth: number,
  rotationY: number,
  y: number,
  color: number,
): void {
  const corners = [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([x, z]) => {
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    return new THREE.Vector3(cx + x * cos + z * sin, y, cz - x * sin + z * cos);
  });
  for (let i = 0; i < 4; i += 1) pushLine(acc, corners[i], corners[(i + 1) % 4], color);
}

function addCircle(
  acc: LineAccumulator,
  cx: number,
  cz: number,
  radius: number,
  y: number,
  color: number,
  segments = 48,
): void {
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    pushLine(
      acc,
      new THREE.Vector3(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius),
      new THREE.Vector3(cx + Math.cos(b) * radius, y, cz + Math.sin(b) * radius),
      color,
    );
  }
}

function addBalconyBand(acc: LineAccumulator, side: 'east' | 'west', y: number): void {
  const range = side === 'east' ? BALCONY.eastAngleRange : BALCONY.westAngleRange;
  const start = range[0] * Math.PI;
  const end = range[1] * Math.PI;
  const steps = 32;
  let prevInner: THREE.Vector3 | null = null;
  let prevOuter: THREE.Vector3 | null = null;
  for (let i = 0; i < steps; i += 1) {
    const t = start + ((end - start) * i) / (steps - 1);
    const inner = shellOffsetPoint(t, 0.15);
    const outer = shellOffsetPoint(t, BALCONY.depth);
    const innerPoint = new THREE.Vector3(inner.x, y, inner.z);
    const outerPoint = new THREE.Vector3(outer.x, y, outer.z);
    if (prevInner) pushLine(acc, prevInner, innerPoint, COLORS.balcony);
    if (prevOuter) pushLine(acc, prevOuter, outerPoint, COLORS.balcony);
    prevInner = innerPoint;
    prevOuter = outerPoint;
  }
  // End caps.
  const ends = [start, end];
  for (const t of ends) {
    const inner = shellOffsetPoint(t, 0.15);
    const outer = shellOffsetPoint(t, BALCONY.depth);
    pushLine(
      acc,
      new THREE.Vector3(inner.x, y, inner.z),
      new THREE.Vector3(outer.x, y, outer.z),
      COLORS.balcony,
    );
  }
}

function makeLabel(text: string, color: number): THREE.Sprite {
  const canvas = createCanvas(512, 128);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = 'rgba(10,8,6,0.7)';
  ctx.fillRect(0, 18, 512, 92);
  ctx.strokeStyle = `#${new THREE.Color(color).getHexString()}`;
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 19, 510, 90);
  ctx.fillStyle = '#f4ead9';
  ctx.font = '600 40px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const texture = canvasTexture(canvas, { anisotropy: 4 });
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(9, 2.25, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export function buildLayoutOverlay(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'venue-layout-overlay';
  group.userData.layoutOverlay = true;
  group.visible = false;

  const acc: LineAccumulator = { positions: [], colors: [] };

  // 96 x 80 original world and the 44 x 41 ticketing courtyard.
  addRect(acc, VENUE_WORLD.bounds.minX, VENUE_WORLD.bounds.maxX, VENUE_WORLD.bounds.minZ, VENUE_WORLD.bounds.maxZ, 0.12, COLORS.world);
  addRect(acc, VENUE_WORLD.courtyard.minX, VENUE_WORLD.courtyard.maxX, VENUE_WORLD.courtyard.minZ, VENUE_WORLD.courtyard.maxZ, 0.14, COLORS.event);

  // Stage platform and obstacle.
  addRect(acc, -13, 13, -17.5, -8.5, 0.16, COLORS.stage);
  addRect(acc, VENUE_WORLD.stageObstacle.minX, VENUE_WORLD.stageObstacle.maxX, VENUE_WORLD.stageObstacle.minZ, VENUE_WORLD.stageObstacle.maxZ, 0.18, COLORS.stage);

  // Seat field, board and booth footprints.
  addRect(acc, -20.5, 20.5, -10.5, 18.2, 0.2, COLORS.seats);
  addRect(acc, BOARD_FOOTPRINT.minX, BOARD_FOOTPRINT.maxX, BOARD_FOOTPRINT.minZ, BOARD_FOOTPRINT.maxZ, 0.22, COLORS.board);
  addRect(acc, BOOTH_FOOTPRINT.minX, BOOTH_FOOTPRINT.maxX, BOOTH_FOOTPRINT.minZ, BOOTH_FOOTPRINT.maxZ, 0.22, COLORS.booth);
  addRotatedRect(
    acc,
    VENUE_WORLD.southEdge.board.x,
    VENUE_WORLD.southEdge.board.z,
    VENUE_WORLD.southEdge.board.halfWidth,
    VENUE_WORLD.southEdge.board.halfDepth,
    VENUE_WORLD.southEdge.board.rotationY,
    0.24,
    COLORS.board,
  );
  addRotatedRect(
    acc,
    VENUE_WORLD.southEdge.booth.x,
    VENUE_WORLD.southEdge.booth.z,
    VENUE_WORLD.southEdge.booth.halfWidth,
    VENUE_WORLD.southEdge.booth.halfDepth,
    VENUE_WORLD.southEdge.booth.rotationY,
    0.24,
    COLORS.booth,
  );

  // Original stairs.
  addRect(acc, VENUE_WORLD.stairs.east.minX, VENUE_WORLD.stairs.east.maxX, VENUE_WORLD.stairs.east.minZ, VENUE_WORLD.stairs.east.maxZ, 0.26, COLORS.stage);
  addRect(acc, VENUE_WORLD.stairs.west.minX, VENUE_WORLD.stairs.west.maxX, VENUE_WORLD.stairs.west.minZ, VENUE_WORLD.stairs.west.maxZ, 0.26, COLORS.stage);

  // Curved balconies.
  addBalconyBand(acc, 'east', 5.3);
  addBalconyBand(acc, 'west', 5.3);

  // Atria access circles.
  for (const spec of Object.values(BALCONY.atria)) {
    const angle = spec.angle * Math.PI;
    const pointX = Math.cos(angle) * 35;
    const pointZ = Math.sin(angle) * 25;
    const nx = Math.cos(angle) / 35;
    const nz = Math.sin(angle) / 25;
    const length = Math.hypot(nx, nz) || 1;
    const cx = pointX - (nx / length) * spec.offset;
    const cz = pointZ - (nz / length) * spec.offset;
    addCircle(acc, cx, cz, spec.radius, 0.3, COLORS.atria);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(acc.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(acc.colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 15;
  group.add(lines);

  const labels: Array<[string, number, THREE.Vector3, number]> = [
    ['96 × 80 WORLD', COLORS.world, new THREE.Vector3(0, 1.2, -34), 9],
    ['44 × 41 EVENT', COLORS.event, new THREE.Vector3(-18, 1.2, 21), 8],
    ['STAGE', COLORS.stage, new THREE.Vector3(0, 1.2, -13), 6],
    ['BOARD', COLORS.board, new THREE.Vector3(-9, 1.6, 22), 4.5],
    ['BOOTH', COLORS.booth, new THREE.Vector3(9, 1.6, 22), 4.5],
    ['TRIB L', COLORS.balcony, new THREE.Vector3(-31, 6.4, 0), 4.5],
    ['TRIB R', COLORS.balcony, new THREE.Vector3(31, 6.4, 0), 4.5],
    ['ATRIUM CIBADAK', COLORS.atria, new THREE.Vector3(28, 1.8, 21), 6],
    ['ATRIUM CILEUTIK', COLORS.atria, new THREE.Vector3(28, 1.8, -21), 6],
    ['ATRIUM CIUNIK', COLORS.atria, new THREE.Vector3(-28, 1.8, 21), 6],
  ];
  for (const [text, color, position, scale] of labels) {
    const sprite = makeLabel(text, color);
    sprite.position.copy(position);
    sprite.scale.set(scale, scale * 0.25, 1);
    group.add(sprite);
  }

  return group;
}
