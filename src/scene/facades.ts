import * as THREE from 'three';
import { ANGLES, BRICK_TILE_METERS, WORLD } from './config';
import type { Materials } from './materials';
import { GeometryBatch } from './batch';
import {
  archSpandrelShape,
  box,
  ellipseArcLength,
  ellipseOutwardNormal,
  ellipsePoint,
  extrudeWallShape,
  inwardYaw,
  triplanarUVs,
  ensureUV1,
} from '../utils/geometry';
import { makeRng, randRange, type Rng } from '../utils/rng';

export interface SignAnchor {
  position: THREE.Vector3;
  yaw: number;
  width: number;
  height: number;
}

export interface FacadeAnchors {
  main: SignAnchor;
  courtyard: SignAnchor;
  downtown: SignAnchor;
}

export interface FacadeResult {
  group: THREE.Group;
  anchors: FacadeAnchors;
  portalColumns: Array<{ x: number; z: number; radius: number }>;
}

type BatchMaterialMap = Record<string, THREE.Material>;

interface Segment {
  start: number;
  end: number;
  type: 'brick' | 'arcade' | 'storefront';
  variant?: number;
}

const SEGMENTS: Segment[] = [
  { start: 0.0, end: 0.18, type: 'arcade', variant: 0 },
  { start: 0.32, end: 0.44, type: 'storefront', variant: 1 },
  { start: 0.56, end: 0.68, type: 'storefront', variant: 2 },
  { start: 0.82, end: 1.02, type: 'brick' },
  { start: 1.14, end: 1.7, type: 'brick' },
  { start: 1.84, end: 2.0, type: 'arcade', variant: 3 },
];

const MODULE_TARGET = 8.6;

function localMatrix(x: number, y: number, z: number, yaw: number): THREE.Matrix4 {
  const position = new THREE.Vector3(x, y, z);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  return new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1));
}

function addPlane(
  batch: GeometryBatch,
  key: string,
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
  matrix: THREE.Matrix4,
  uvScale = 3.4,
): void {
  const geometry = new THREE.PlaneGeometry(width, height);
  geometry.translate(x, y, z);
  triplanarUVs(geometry, uvScale);
  ensureUV1(geometry);
  batch.add(key, geometry, matrix);
}

function addCylinder(
  batch: GeometryBatch,
  key: string,
  radius: number,
  height: number,
  x: number,
  y: number,
  z: number,
  matrix: THREE.Matrix4,
  segments = 12,
): void {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments, 1, false);
  geometry.translate(x, y, z);
  ensureUV1(geometry);
  batch.add(key, geometry, matrix);
}

function addBrickWallModule(
  batch: GeometryBatch,
  matrix: THREE.Matrix4,
  width: number,
  height: number,
  depth: number,
  rng: Rng,
  options: { arches?: number; blind?: boolean; tall?: boolean } = {},
): void {
  const archCount = options.arches ?? 2;
  const spacing = width / archCount;
  const archWidth = Math.min(3.4, spacing - 1.0);
  const spring = height > 12 ? 5.6 : 4.8;
  const radius = archWidth / 2;
  const uvU = randRange(rng, 0, 3);
  const uvV = randRange(rng, 0, 3);
  const centers: number[] = [];
  for (let i = 0; i < archCount; i += 1) centers.push(-width / 2 + spacing * (i + 0.5));

  // Piers between/beside the arches.
  const edges: Array<[number, number]> = [];
  let cursor = -width / 2;
  for (const center of centers) {
    edges.push([cursor, center - radius]);
    cursor = center + radius;
  }
  edges.push([cursor, width / 2]);
  for (const [left, right] of edges) {
    const w = right - left;
    if (w <= 0.01) continue;
    const geometry = box(
      w,
      height,
      depth,
      (left + right) / 2,
      height / 2,
      -depth / 2,
      BRICK_TILE_METERS,
      uvU,
      uvV,
    );
    batch.add('brick', geometry, matrix);
  }

  // Solid above each arch.
  for (const center of centers) {
    const shape = archSpandrelShape(archWidth, spring, height);
    const geometry = extrudeWallShape(shape, depth, BRICK_TILE_METERS, uvU, uvV);
    geometry.translate(center, 0, 0);
    batch.add('brick', geometry, matrix);

    if (options.blind !== false) {
      const plane = new THREE.PlaneGeometry(archWidth - 0.08, spring + radius - 0.08);
      plane.translate(center, (spring + radius) / 2, -depth + 0.3);
      triplanarUVs(plane, BRICK_TILE_METERS, uvU, uvV);
      ensureUV1(plane);
      batch.add('brickDark', plane, matrix);
    }

    // Stone sill at the foot of each arch.
    const sill = box(
      archWidth + 0.35,
      0.24,
      depth + 0.16,
      center,
      0.12,
      0.02,
      BRICK_TILE_METERS,
      uvU,
      uvV,
    );
    batch.add('stone', sill, matrix);

    // Stone archivolt: vertical jambs, semicircular band and keystone.
    for (const side of [-1, 1]) {
      batch.add(
        'stone',
        box(0.18, spring, 0.17, center + side * (radius + 0.09), spring / 2, 0.1, BRICK_TILE_METERS, uvU, uvV),
        matrix,
      );
    }
    const outer = radius + 0.22;
    const trimShape = new THREE.Shape();
    trimShape.moveTo(outer, spring);
    trimShape.absarc(0, spring, outer, 0, Math.PI, false);
    trimShape.lineTo(-radius, spring);
    trimShape.absarc(0, spring, radius, Math.PI, 0, true);
    trimShape.closePath();
    const trimGeometry = new THREE.ExtrudeGeometry(trimShape, {
      depth: 0.15,
      bevelEnabled: false,
      curveSegments: 14,
      steps: 1,
    });
    trimGeometry.translate(center, 0, 0.02);
    triplanarUVs(trimGeometry, BRICK_TILE_METERS, uvU, uvV);
    ensureUV1(trimGeometry);
    batch.add('stone', trimGeometry, matrix);
    batch.add(
      'stone',
      box(0.28, 0.52, 0.18, center, spring + radius + 0.08, 0.1, BRICK_TILE_METERS, uvU, uvV),
      matrix,
    );
  }

  // Base plinth and string course.
  const plinth = box(width, 0.48, depth + 0.18, 0, 0.24, 0.06, BRICK_TILE_METERS, uvU, uvV);
  batch.add('stone', plinth, matrix);
  const stringCourse = box(width, 0.2, 0.16, 0, Math.min(9.8, height - 2.4), 0.06, BRICK_TILE_METERS, uvU, uvV);
  batch.add('stone', stringCourse, matrix);

  // Edge pilasters.
  for (const side of [-1, 1]) {
    const pilaster = box(0.46, height, 0.28, side * (width / 2 + 0.06), height / 2, 0.08, BRICK_TILE_METERS, uvU, uvV);
    batch.add('brick', pilaster, matrix);
  }

  // Parapet and coping.
  const parapetHeight = options.tall ? 0.95 : 0.85;
  const parapet = box(width, parapetHeight, depth + 0.12, 0, height + parapetHeight / 2, -0.02, BRICK_TILE_METERS, uvU, uvV);
  batch.add('brick', parapet, matrix);
  const coping = box(width + 0.18, 0.13, depth + 0.28, 0, height + parapetHeight + 0.06, -0.02, BRICK_TILE_METERS, uvU, uvV);
  batch.add('stone', coping, matrix);

  // A shallow stone band under the roofline and a second string course.
  const fascia = box(width + 0.1, 0.24, 0.3, 0, height - 0.2, 0.1, BRICK_TILE_METERS, uvU, uvV);
  batch.add('stone', fascia, matrix);
  batch.add(
    'stone',
    box(width, 0.16, 0.18, 0, height - 1.5, 0.06, BRICK_TILE_METERS, uvU, uvV),
    matrix,
  );

  // A row of small framed vents between the arch crowns and the sign band.
  for (const side of [-1, 1]) {
    const x = side * width * 0.26;
    batch.add('brickDark', box(0.62, 0.86, 0.08, x, height - 3.3, 0.04, BRICK_TILE_METERS, uvU, uvV), matrix);
    for (const dx of [-0.42, 0.42]) {
      batch.add('stone', box(0.1, 1.05, 0.12, x + dx, height - 3.3, 0.08, BRICK_TILE_METERS, uvU, uvV), matrix);
    }
    for (const dy of [-0.52, 0.52]) {
      batch.add('stone', box(0.94, 0.1, 0.12, x, height - 3.3 + dy, 0.08, BRICK_TILE_METERS, uvU, uvV), matrix);
    }
  }
}

function addArcadeModule(
  batch: GeometryBatch,
  matrix: THREE.Matrix4,
  width: number,
  height: number,
  depth: number,
  rng: Rng,
  variant: number,
): void {
  const ground = WORLD.groundFloor;
  const upper = WORLD.upperFloor;
  const archWidth = 3.5;
  const spring = 3.15;
  const radius = archWidth / 2;
  const centers = [-width * 0.24, width * 0.24];
  const uvU = randRange(rng, 0, 2);
  const uvV = randRange(rng, 0, 2);
  const interiorKey = variant % 2 === 0 ? 'interiorWarm' : 'interiorCool';

  // Ground-floor piers.
  const edges: Array<[number, number]> = [];
  let cursor = -width / 2;
  for (const center of centers) {
    edges.push([cursor, center - radius]);
    cursor = center + radius;
  }
  edges.push([cursor, width / 2]);
  for (const [left, right] of edges) {
    const w = right - left;
    if (w <= 0.01) continue;
    batch.add(
      'stone',
      box(w, ground, depth, (left + right) / 2, ground / 2, -depth / 2, BRICK_TILE_METERS, uvU, uvV),
      matrix,
    );
  }
  for (const center of centers) {
    const spandrel = extrudeWallShape(archSpandrelShape(archWidth, spring, ground), depth, BRICK_TILE_METERS, uvU, uvV);
    spandrel.translate(center, 0, 0);
    batch.add('stone', spandrel, matrix);
  }

  // Storefront volume behind the arcade: floor, ceiling and side walls.
  const backZ = -depth + 0.5;
  batch.add('stone', box(width - 0.6, 0.08, depth - 0.8, 0, 0.06, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  batch.add('concrete', box(width - 0.6, 0.18, depth - 0.8, 0, ground - 0.12, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  for (const side of [-1, 1]) {
    batch.add(
      'concrete',
      box(0.22, ground, depth - 0.6, side * (width / 2 - 0.5), ground / 2, -depth / 2, BRICK_TILE_METERS, uvU, uvV),
      matrix,
    );
  }

  // Glass and lit interior behind the ground-floor arches.
  addPlane(batch, 'glassDark', width - 1.5, ground - 0.8, 0, ground / 2 - 0.15, backZ, matrix);
  addPlane(batch, interiorKey, width - 1.9, ground - 1.0, 0, ground / 2 - 0.15, backZ - 0.08, matrix);
  const mullions = 5;
  for (let i = 0; i < mullions; i += 1) {
    const x = -((width - 1.5) / 2) + ((width - 1.5) / (mullions - 1)) * i;
    batch.add('metal', box(0.09, ground - 0.8, 0.12, x, ground / 2 - 0.15, backZ + 0.02, 2, 0, 0), matrix);
  }
  batch.add('metal', box(width - 1.5, 0.09, 0.12, 0, 2.5, backZ + 0.02, 2, 0, 0), matrix);

  // Upper-floor piers and sill/lintel.
  const winWidth = 3.25;
  const winBottom = ground + 0.55;
  const winTop = 8.8;
  const winCenters = [-width * 0.24, width * 0.24];
  const upperEdges: Array<[number, number]> = [];
  let upperCursor = -width / 2;
  for (const center of winCenters) {
    upperEdges.push([upperCursor, center - winWidth / 2]);
    upperCursor = center + winWidth / 2;
  }
  upperEdges.push([upperCursor, width / 2]);
  for (const [left, right] of upperEdges) {
    const w = right - left;
    if (w <= 0.01) continue;
    batch.add(
      'brick',
      box(w, upper - ground, depth, (left + right) / 2, (upper + ground) / 2, -depth / 2, BRICK_TILE_METERS, uvU, uvV),
      matrix,
    );
  }
  batch.add('brick', box(width, winBottom - ground, depth, 0, (winBottom + ground) / 2, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  batch.add('brick', box(width, upper - winTop, depth, 0, (upper + winTop) / 2, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  for (const center of winCenters) {
    addPlane(batch, 'glass', winWidth - 0.2, winTop - winBottom - 0.15, center, (winTop + winBottom) / 2, -0.42, matrix);
    addPlane(batch, interiorKey, winWidth - 0.35, winTop - winBottom - 0.3, center, (winTop + winBottom) / 2, -0.52, matrix);
  }

  // Balcony slab, fascia and glass railing.
  const balconyDepth = 1.35;
  batch.add(
    'stone',
    box(width + 0.18, 0.26, balconyDepth, 0, ground - 0.13, balconyDepth / 2, BRICK_TILE_METERS, uvU, uvV),
    matrix,
  );
  batch.add(
    'metal',
    box(width + 0.18, 0.34, 0.12, 0, ground - 0.32, balconyDepth - 0.02, 2, 0, 0),
    matrix,
  );
  batch.add('glass', box(width - 0.25, 0.9, 0.035, 0, ground + 0.62, balconyDepth - 0.05, 2, 0, 0), matrix);
  for (let i = 0; i <= 6; i += 1) {
    const x = -(width / 2) + (width / 6) * i;
    batch.add('metal', box(0.07, 1.12, 0.07, x, ground + 0.56, balconyDepth - 0.05, 2, 0, 0), matrix);
  }
  batch.add('metal', box(width, 0.09, 0.09, 0, ground + 1.12, balconyDepth - 0.05, 2, 0, 0), matrix);

  // Fascia band and shop sign.
  batch.add(
    'metal',
    box(width + 0.12, 0.72, 0.18, 0, upper + 0.36, 0.08, 2, 0, 0),
    matrix,
  );
  addPlane(batch, `shopSign${variant % 4}`, 4.2, 0.72, 0, upper + 0.36, 0.19, matrix, 2);

  // Parapet.
  const parapetHeight = height - upper;
  batch.add(
    'brick',
    box(width, parapetHeight, depth + 0.1, 0, upper + parapetHeight / 2, -0.03, BRICK_TILE_METERS, uvU, uvV),
    matrix,
  );
  batch.add('stone', box(width + 0.2, 0.14, depth + 0.22, 0, height + 0.07, -0.03, BRICK_TILE_METERS, uvU, uvV), matrix);

  // Pilasters.
  for (const side of [-1, 1]) {
    batch.add('stone', box(0.5, height, 0.32, side * (width / 2 + 0.02), height / 2, 0.1, BRICK_TILE_METERS, uvU, uvV), matrix);
  }
}

function addStorefrontModule(
  batch: GeometryBatch,
  matrix: THREE.Matrix4,
  width: number,
  height: number,
  depth: number,
  rng: Rng,
  variant: number,
): void {
  const ground = WORLD.groundFloor;
  const upper = WORLD.upperFloor;
  const uvU = randRange(rng, 0, 2);
  const uvV = randRange(rng, 0, 2);
  const interiorKey = variant % 3 === 0 ? 'interiorGreen' : variant % 3 === 1 ? 'interiorWarm' : 'interiorFashion';

  // Base, side piers and floor plates.
  batch.add('stone', box(width, 0.42, depth + 0.12, 0, 0.21, 0.02, BRICK_TILE_METERS, uvU, uvV), matrix);
  for (const side of [-1, 1]) {
    batch.add('concrete', box(0.72, ground, depth, side * (width / 2 - 0.36), ground / 2, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  }
  batch.add('concrete', box(width, 0.5, depth, 0, ground - 0.25, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);

  // Ground-floor glass and interior.
  const glassWidth = width - 1.55;
  const groundGlassHeight = 4.5;
  addPlane(batch, 'glassDark', glassWidth, groundGlassHeight, 0, 0.4 + groundGlassHeight / 2, -0.38, matrix);
  addPlane(batch, interiorKey, glassWidth - 0.35, groundGlassHeight - 0.3, 0, 0.4 + groundGlassHeight / 2, -0.55, matrix);
  const mullions = 5;
  for (let i = 0; i < mullions; i += 1) {
    const x = -glassWidth / 2 + (glassWidth / (mullions - 1)) * i;
    batch.add('metal', box(0.075, groundGlassHeight, 0.11, x, 0.4 + groundGlassHeight / 2, -0.34, 2, 0, 0), matrix);
  }
  batch.add('metal', box(glassWidth, 0.08, 0.11, 0, 2.5, -0.34, 2, 0, 0), matrix);
  batch.add('metal', box(glassWidth, 0.12, 0.22, 0, 4.95, 0.02, 2, 0, 0), matrix);

  // Sign band.
  batch.add('metal', box(width, 0.78, 0.16, 0, ground + 0.2, 0.09, 2, 0, 0), matrix);
  addPlane(batch, `shopSign${variant % 4}`, 4.6, 0.68, 0, ground + 0.2, 0.19, matrix, 2);

  // Balcony and railing.
  const balconyDepth = 1.25;
  batch.add('stone', box(width + 0.16, 0.24, balconyDepth, 0, ground - 0.12, balconyDepth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  batch.add('glass', box(width - 0.2, 0.88, 0.035, 0, ground + 0.62, balconyDepth - 0.05, 2, 0, 0), matrix);
  for (let i = 0; i <= 6; i += 1) {
    const x = -(width / 2) + (width / 6) * i;
    batch.add('metal', box(0.065, 1.08, 0.065, x, ground + 0.54, balconyDepth - 0.05, 2, 0, 0), matrix);
  }
  batch.add('metal', box(width, 0.08, 0.08, 0, ground + 1.08, balconyDepth - 0.05, 2, 0, 0), matrix);

  // Upper floor.
  for (const side of [-1, 1]) {
    batch.add('concrete', box(0.72, upper - ground, depth, side * (width / 2 - 0.36), (upper + ground) / 2, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  }
  batch.add('concrete', box(width, 0.45, depth, 0, upper - 0.22, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  addPlane(batch, 'glass', glassWidth, 3.5, 0, 7.25, -0.38, matrix);
  addPlane(batch, interiorKey, glassWidth - 0.3, 3.3, 0, 7.25, -0.55, matrix);
  for (let i = 0; i < mullions; i += 1) {
    const x = -glassWidth / 2 + (glassWidth / (mullions - 1)) * i;
    batch.add('metal', box(0.07, 3.5, 0.1, x, 7.25, -0.34, 2, 0, 0), matrix);
  }
  batch.add('concrete', box(width, 0.35, depth, 0, 5.38, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);

  // Parapet and coping.
  const parapetHeight = height - upper;
  batch.add('concrete', box(width, parapetHeight, depth + 0.1, 0, upper + parapetHeight / 2, -0.03, BRICK_TILE_METERS, uvU, uvV), matrix);
  batch.add('stone', box(width + 0.18, 0.14, depth + 0.22, 0, height + 0.07, -0.03, BRICK_TILE_METERS, uvU, uvV), matrix);

  // Vertical pilasters.
  for (const side of [-1, 1]) {
    batch.add('stone', box(0.48, height, 0.3, side * (width / 2 + 0.01), height / 2, 0.09, BRICK_TILE_METERS, uvU, uvV), matrix);
  }
}

function addSouthPortal(
  batch: GeometryBatch,
  matrix: THREE.Matrix4,
  rng: Rng,
): { columns: Array<{ x: number; z: number; radius: number }> } {
  const width = 12.8;
  const height = 13.2;
  const depth = 6.2;
  const uvU = randRange(rng, 0, 2);
  const uvV = randRange(rng, 0, 2);
  const columns: Array<{ x: number; z: number; radius: number }> = [];

  // Side towers and top beam.
  for (const side of [-1, 1]) {
    batch.add('stone', box(1.55, height, depth, side * (width / 2 - 0.77), height / 2, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  }
  batch.add('stone', box(width, 3.25, depth, 0, height - 1.62, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  batch.add('concrete', box(width, 0.55, depth, 0, 10.0, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);

  // Glass curtain wall and mullions.
  const glassWidth = 9.5;
  const glassHeight = 9.5;
  addPlane(batch, 'glass', glassWidth, glassHeight, 0, 0.25 + glassHeight / 2, -0.35, matrix);
  addPlane(batch, 'interiorLobby', glassWidth - 0.4, glassHeight - 0.4, 0, 0.25 + glassHeight / 2, -0.55, matrix);
  for (let i = 0; i < 7; i += 1) {
    const x = -glassWidth / 2 + (glassWidth / 6) * i;
    batch.add('metal', box(0.1, glassHeight, 0.14, x, 0.25 + glassHeight / 2, -0.31, 2, 0, 0), matrix);
  }
  for (const y of [3.3, 6.5]) {
    batch.add('metal', box(glassWidth, 0.1, 0.14, 0, y, -0.31, 2, 0, 0), matrix);
  }
  // Door frame.
  batch.add('metal', box(2.6, 0.14, 0.2, 0, 3.15, -0.27, 2, 0, 0), matrix);
  for (const side of [-1, 1]) {
    batch.add('metal', box(0.14, 3.2, 0.2, side * 1.3, 1.6, -0.27, 2, 0, 0), matrix);
  }

  // Canopy slab and fascia.
  const canopyDepth = 4.4;
  batch.add('concrete', box(width + 0.4, 0.28, canopyDepth, 0, 8.05, canopyDepth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  batch.add('metal', box(width + 0.5, 0.14, 0.16, 0, 8.23, canopyDepth - 0.04, 2, 0, 0), matrix);
  for (let i = 0; i < 5; i += 1) {
    batch.add('lamp', box(0.18, 0.04, 0.18, -4.2 + i * 2.1, 7.9, 2.5, 2, 0, 0), matrix);
  }
  // Canopy support columns just inside the plaza.
  for (const side of [-1, 1]) {
    const x = side * 4.9;
    const z = canopyDepth - 0.65;
    addCylinder(batch, 'metal', 0.22, 7.9, x, 3.95, z, matrix, 14);
    columns.push({ x, z, radius: 0.28 });
  }

  // Steps at the threshold.
  batch.add('stone', box(width - 1.0, 0.18, 1.6, 0, 0.09, 0.7, BRICK_TILE_METERS, uvU, uvV), matrix);

  return { columns };
}

function addDowntownPassage(batch: GeometryBatch, matrix: THREE.Matrix4, rng: Rng): void {
  const width = 10.5;
  const height = 11.0;
  const depth = 8.0;
  const uvU = randRange(rng, 0, 2);
  const uvV = randRange(rng, 0, 2);
  for (const side of [-1, 1]) {
    batch.add('brick', box(0.8, height, depth, side * (width / 2 + 0.4), height / 2, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  }
  batch.add('brick', box(width + 1.6, 1.0, depth, 0, height - 0.5, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  batch.add('stone', box(width + 1.0, 0.4, depth, 0, height + 0.2, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  batch.add('stone', box(width, 0.12, depth, 0, 0.06, -depth / 2, BRICK_TILE_METERS, uvU, uvV), matrix);
  addPlane(batch, 'interiorWarm', width - 0.8, 5.8, 0, 3.1, -depth + 0.12, matrix);
  // Vertical light slots along the passage.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      const z = -1.4 - i * 1.7;
      batch.add('lamp', box(0.08, 3.2, 0.32, side * (width / 2 - 0.05), 3.4, z, 2, 0, 0), matrix);
    }
  }
  // A dark frame around the opening.
  for (const side of [-1, 1]) {
    batch.add('metal', box(0.22, height, 0.22, side * (width / 2 + 0.9), height / 2, 0.02, 2, 0, 0), matrix);
  }
  batch.add('metal', box(width + 2.0, 0.22, 0.22, 0, height + 0.02, 0.02, 2, 0, 0), matrix);
}

function addAtrium(
  batch: GeometryBatch,
  angle: number,
  index: number,
  rng: Rng,
  withCanopy: boolean,
): void {
  const radius = 6.4;
  const height = 10.8;
  const point = ellipsePoint(WORLD.radiusX, WORLD.radiusZ, angle);
  const outward = ellipseOutwardNormal(WORLD.radiusX, WORLD.radiusZ, angle);
  const center = point.clone().addScaledVector(outward, 3.6);
  const matrix = new THREE.Matrix4().makeTranslation(center.x, 0, center.z);
  const perimeter = 10;
  const uvU = randRange(rng, 0, 2);
  const uvV = randRange(rng, 0, 2);

  // Glass drum with a warm interior core.
  const drum = new THREE.CylinderGeometry(radius, radius, height, 36, 1, true);
  drum.translate(0, height / 2, 0);
  ensureUV1(drum);
  batch.add('glassAtrium', drum, matrix);

  const core = new THREE.CylinderGeometry(radius * 0.52, radius * 0.52, 5.0, 24, 1, true);
  core.translate(0, 2.5, 0);
  ensureUV1(core);
  batch.add('interiorWarm', core, matrix);

  const floor = new THREE.CircleGeometry(radius - 0.15, 36);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, 0.04, 0);
  ensureUV1(floor);
  batch.add('stone', floor, matrix);
  const floorLight = new THREE.CircleGeometry(radius * 0.72, 32);
  floorLight.rotateX(-Math.PI / 2);
  floorLight.translate(0, 0.06, 0);
  ensureUV1(floorLight);
  batch.add('interiorWarm', floorLight, matrix);

  const roof = new THREE.CircleGeometry(radius + 0.15, 36);
  roof.rotateX(-Math.PI / 2);
  roof.translate(0, height, 0);
  ensureUV1(roof);
  batch.add('glassAtrium', roof, matrix);
  const ring = new THREE.TorusGeometry(radius + 0.1, 0.06, 8, 36);
  ring.rotateX(-Math.PI / 2);
  ring.translate(0, height + 0.02, 0);
  ensureUV1(ring);
  batch.add('metalLight', ring, matrix);
  const baseRing = new THREE.TorusGeometry(radius + 0.08, 0.05, 8, 36);
  baseRing.rotateX(-Math.PI / 2);
  baseRing.translate(0, 0.1, 0);
  ensureUV1(baseRing);
  batch.add('metalLight', baseRing, matrix);

  for (let i = 0; i < perimeter; i += 1) {
    const a = (i / perimeter) * Math.PI * 2;
    addCylinder(batch, 'metalLight', 0.07, height, Math.cos(a) * radius, height / 2, Math.sin(a) * radius, matrix, 8);
  }

  // Warm inner mezzanine ring and railing.
  const mezzanine = new THREE.RingGeometry(radius * 0.55, radius * 0.92, 32);
  mezzanine.rotateX(-Math.PI / 2);
  mezzanine.translate(0, 5.2, 0);
  ensureUV1(mezzanine);
  batch.add('stone', mezzanine, matrix);
  const rail = new THREE.TorusGeometry(radius * 0.9, 0.04, 6, 32);
  rail.rotateX(-Math.PI / 2);
  rail.translate(0, 6.2, 0);
  ensureUV1(rail);
  batch.add('metal', rail, matrix);
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    batch.add(
      'metal',
      box(0.055, 1.0, 0.055, Math.cos(a) * radius * 0.9, 5.7, Math.sin(a) * radius * 0.9, 2, 0, 0),
      matrix,
    );
  }

  // A couple of interior planters for warmth.
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + index;
    const r = radius * 0.58;
    batch.add('stone', box(1.1, 0.55, 1.1, Math.cos(a) * r, 0.27, Math.sin(a) * r, BRICK_TILE_METERS, uvU, uvV), matrix);
    batch.add('soil', box(0.92, 0.08, 0.92, Math.cos(a) * r, 0.56, Math.sin(a) * r, 2, 0, 0), matrix);
  }

  if (withCanopy) {
    const canopyWidth = 13;
    const canopyDepth = 8;
    const canopyY = 8.2;
    batch.add('glassAtrium', box(canopyWidth, 0.07, canopyDepth, 0, canopyY, 2.2, 2, 0, 0), matrix);
    for (let i = 0; i <= 4; i += 1) {
      const x = -canopyWidth / 2 + (canopyWidth / 4) * i;
      batch.add('metalLight', box(0.07, 0.12, canopyDepth, x, canopyY - 0.07, 2.2, 2, 0, 0), matrix);
    }
    for (let i = 0; i <= 3; i += 1) {
      const z = 2.2 - canopyDepth / 2 + (canopyDepth / 3) * i;
      batch.add('metalLight', box(canopyWidth, 0.12, 0.07, 0, canopyY - 0.07, z, 2, 0, 0), matrix);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addCylinder(batch, 'metalLight', 0.11, canopyY, sx * (canopyWidth / 2 - 0.7), canopyY / 2, 2.2 + sz * (canopyDepth / 2 - 0.7), matrix, 10);
      }
    }
    for (let i = 0; i < 4; i += 1) {
      batch.add('lamp', box(0.2, 0.04, 0.2, -4.5 + i * 3, canopyY - 0.12, 2.2, 2, 0, 0), matrix);
    }
  }
}

export function buildFacades(materials: Materials): FacadeResult {
  const batch = new GeometryBatch();
  const rng = makeRng(0xfacade);
  const portalColumns: Array<{ x: number; z: number; radius: number }> = [];

  for (const segment of SEGMENTS) {
    const start = segment.start * Math.PI;
    const end = segment.end * Math.PI;
    const arc = ellipseArcLength(WORLD.radiusX, WORLD.radiusZ, start, end);
    const count = Math.max(1, Math.round(arc / MODULE_TARGET));
    const step = (end - start) / count;
    for (let i = 0; i < count; i += 1) {
      const angle = start + step * (i + 0.5);
      const point = ellipsePoint(WORLD.radiusX, WORLD.radiusZ, angle);
      const yaw = inwardYaw(WORLD.radiusX, WORLD.radiusZ, angle);
      const matrix = localMatrix(point.x, 0, point.z, yaw);
      const width = Math.max(6.5, (arc / count) * 1.015);
      if (segment.type === 'brick') {
        addBrickWallModule(batch, matrix, width, WORLD.heroWallHeight, WORLD.wallThickness + 0.2, rng, {
          arches: 2,
          blind: true,
          tall: true,
        });
      } else if (segment.type === 'arcade') {
        addArcadeModule(batch, matrix, width, WORLD.mallTop, WORLD.facadeDepth, rng, segment.variant ?? 0);
      } else {
        addStorefrontModule(batch, matrix, width, WORLD.mallTop, WORLD.facadeDepth, rng, segment.variant ?? 0);
      }
    }
  }

  // South portal.
  {
    const angle = ANGLES.south;
    const point = ellipsePoint(WORLD.radiusX, WORLD.radiusZ, angle);
    const yaw = inwardYaw(WORLD.radiusX, WORLD.radiusZ, angle);
    const matrix = localMatrix(point.x, 0, point.z, yaw);
    const portal = addSouthPortal(batch, matrix, rng);
    for (const column of portal.columns) {
      const rotated = new THREE.Vector3(column.x, 0, column.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      portalColumns.push({ x: point.x + rotated.x, z: point.z + rotated.z, radius: column.radius });
    }
  }

  // Downtown Walk passage.
  {
    const angle = ANGLES.downtown;
    const point = ellipsePoint(WORLD.radiusX, WORLD.radiusZ, angle);
    const yaw = inwardYaw(WORLD.radiusX, WORLD.radiusZ, angle);
    const matrix = localMatrix(point.x, 0, point.z, yaw);
    addDowntownPassage(batch, matrix, rng);
  }

  // Atria.
  addAtrium(batch, ANGLES.ciunik, 0, rng, false);
  addAtrium(batch, ANGLES.cibadak, 1, rng, false);
  addAtrium(batch, ANGLES.cileutik, 2, rng, true);

  const batchMaterials: BatchMaterialMap = {
    brick: materials.brick,
    brickDark: materials.brickDark,
    stone: materials.stone,
    concrete: materials.concrete,
    metal: materials.metal,
    metalLight: materials.metalLight,
    glass: materials.glass,
    glassAtrium: materials.glassAtrium,
    glassDark: materials.glassDark,
    wood: materials.wood,
    soil: materials.soil,
    lamp: materials.lamp,
    roof: materials.roof,
    interiorWarm: materials.interior.warm,
    interiorCool: materials.interior.cool,
    interiorGreen: materials.interior.green,
    interiorFashion: materials.interior.fashion,
    interiorLobby: materials.interior.lobby,
    shopSign0: materials.shopSigns[0],
    shopSign1: materials.shopSigns[1],
    shopSign2: materials.shopSigns[2],
    shopSign3: materials.shopSigns[3],
  };

  const group = batch.build(batchMaterials, {
    brick: { castShadow: true, receiveShadow: true },
    brickDark: { castShadow: false, receiveShadow: true },
    stone: { castShadow: true, receiveShadow: true },
    concrete: { castShadow: true, receiveShadow: true },
    metal: { castShadow: true, receiveShadow: true },
    metalLight: { castShadow: true, receiveShadow: true },
    glass: { castShadow: false, receiveShadow: false, renderOrder: 2 },
    glassAtrium: { castShadow: false, receiveShadow: false, renderOrder: 2 },
    glassDark: { castShadow: false, receiveShadow: false, renderOrder: 2 },
    wood: { castShadow: true, receiveShadow: true },
    soil: { castShadow: false, receiveShadow: true },
    lamp: { castShadow: false, receiveShadow: false },
    roof: { castShadow: true, receiveShadow: true },
    interiorWarm: { castShadow: false, receiveShadow: false },
    interiorCool: { castShadow: false, receiveShadow: false },
    interiorGreen: { castShadow: false, receiveShadow: false },
    interiorFashion: { castShadow: false, receiveShadow: false },
    interiorLobby: { castShadow: false, receiveShadow: false },
    shopSign0: { castShadow: false, receiveShadow: false },
    shopSign1: { castShadow: false, receiveShadow: false },
    shopSign2: { castShadow: false, receiveShadow: false },
    shopSign3: { castShadow: false, receiveShadow: false },
  });

  const heroPoint = ellipsePoint(WORLD.radiusX, WORLD.radiusZ, ANGLES.hero);
  const heroYaw = inwardYaw(WORLD.radiusX, WORLD.radiusZ, ANGLES.hero);
  const heroInward = ellipseOutwardNormal(WORLD.radiusX, WORLD.radiusZ, ANGLES.hero).multiplyScalar(-1);
  const southPoint = ellipsePoint(WORLD.radiusX, WORLD.radiusZ, ANGLES.south);
  const southYaw = inwardYaw(WORLD.radiusX, WORLD.radiusZ, ANGLES.south);
  const southInward = ellipseOutwardNormal(WORLD.radiusX, WORLD.radiusZ, ANGLES.south).multiplyScalar(-1);
  const downtownPoint = ellipsePoint(WORLD.radiusX, WORLD.radiusZ, ANGLES.downtown);
  const downtownYaw = inwardYaw(WORLD.radiusX, WORLD.radiusZ, ANGLES.downtown);
  const downtownInward = ellipseOutwardNormal(WORLD.radiusX, WORLD.radiusZ, ANGLES.downtown).multiplyScalar(-1);

  const anchors: FacadeAnchors = {
    main: {
      position: heroPoint.clone().addScaledVector(heroInward, 0.42).setY(11.3),
      yaw: heroYaw,
      width: 10,
      height: 2.9,
    },
    courtyard: {
      position: southPoint.clone().addScaledVector(southInward, 0.32).setY(11.25),
      yaw: southYaw,
      width: 7,
      height: 2.5,
    },
    downtown: {
      position: downtownPoint.clone().addScaledVector(downtownInward, 0.32).setY(10.2),
      yaw: downtownYaw,
      width: 5.4,
      height: 1.3,
    },
  };

  return { group, anchors, portalColumns };
}
