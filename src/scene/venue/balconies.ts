import * as THREE from 'three';
import { GeometryBatch } from '../batch';
import type { Materials } from '../materials';
import {
  BALCONY,
  SHELL,
  VENUE_WORLD,
  shellInwardNormal,
  shellOffsetPoint,
  shellPoint,
} from './layout';

export interface BalconyCollision {
  x: number;
  z: number;
  radius: number;
}

export interface BalconyResult {
  group: THREE.Group;
  collisions: BalconyCollision[];
  deckAngles: { east: [number, number]; west: [number, number] };
}

const TAU = Math.PI * 2;

function samples(start: number, end: number, count = 28): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) out.push(start + ((end - start) * i) / (count - 1));
  return out;
}

/**
 * Curved horizontal slab between two inward offsets. Builds top, bottom,
 * outer/inner vertical sides and end caps as one geometry.
 */
function curvedSlabGeometry(
  angles: number[],
  innerOffset: number,
  outerOffset: number,
  topY: number,
  thickness: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = angles.length;

  for (let i = 0; i < n; i += 1) {
    const angle = angles[i];
    const inner = shellOffsetPoint(angle, innerOffset);
    const outer = shellOffsetPoint(angle, outerOffset);
    const yBottom = topY - thickness;
    const u = i / (n - 1);
    // 0 inner top, 1 outer top, 2 inner bottom, 3 outer bottom
    positions.push(inner.x, topY, inner.z);
    positions.push(outer.x, topY, outer.z);
    positions.push(inner.x, yBottom, inner.z);
    positions.push(outer.x, yBottom, outer.z);
    uvs.push(u, 0, u, 1, u, 0, u, 1);
  }

  for (let i = 0; i < n - 1; i += 1) {
    const a = i * 4;
    const b = (i + 1) * 4;
    // Top: inner_i -> inner_next -> outer_next -> outer_i (faces +Y).
    indices.push(a, b, b + 1, a, b + 1, a + 1);
    // Bottom: reversed.
    indices.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2);
    // Outer side.
    indices.push(a + 1, b + 1, b + 3, a + 1, b + 3, a + 3);
    // Inner side.
    indices.push(a, a + 2, b + 2, a, b + 2, b);
  }
  // End caps.
  const last = (n - 1) * 4;
  indices.push(0, 1, 3, 0, 3, 2);
  indices.push(last, last + 2, last + 3, last, last + 3, last + 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function addOrientedBox(
  batch: GeometryBatch,
  key: string,
  width: number,
  height: number,
  depth: number,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
): void {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1));
  batch.add(key, geometry, matrix);
}

function addSegmentBox(
  batch: GeometryBatch,
  key: string,
  from: { x: number; z: number },
  to: { x: number; z: number },
  y: number,
  height: number,
  thickness: number,
): void {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return;
  const yaw = Math.atan2(dx, dz);
  const position = new THREE.Vector3((from.x + to.x) / 2, y + height / 2, (from.z + to.z) / 2);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  addOrientedBox(batch, key, thickness, height, length, position, quaternion);
}

function addRailing(
  batch: GeometryBatch,
  angles: number[],
  offset: number,
  baseY = BALCONY.rowY[0],
  glassHeight = 1.0,
): void {
  const points = angles.map((angle) => shellOffsetPoint(angle, offset));
  for (let i = 0; i < points.length - 1; i += 1) {
    addSegmentBox(batch, 'venueGlass', points[i], points[i + 1], baseY + 0.08, glassHeight, 0.035);
  }
  for (let i = 0; i < points.length; i += 2) {
    const point = points[i];
    const angle = angles[i];
    const normal = shellInwardNormal(angle);
    const post = new THREE.CylinderGeometry(0.035, 0.045, glassHeight + 0.25, 6);
    post.translate(point.x - normal.x * 0.04, baseY + (glassHeight + 0.25) / 2, point.z - normal.z * 0.04);
    batch.add('venueMetal', post);
  }
  // Continuous top rail.
  for (let i = 0; i < points.length - 1; i += 1) {
    addSegmentBox(batch, 'venueMetal', points[i], points[i + 1], baseY + glassHeight + 0.17, 0.07, 0.07);
  }
}

function addBridge(
  batch: GeometryBatch,
  from: THREE.Vector3,
  to: THREE.Vector3,
  width = 2.6,
): void {
  const direction = to.clone().sub(from);
  const length = direction.length();
  if (length < 0.1) return;
  const yaw = Math.atan2(direction.x, direction.z);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  const mid = from.clone().add(to).multiplyScalar(0.5);
  addOrientedBox(batch, 'venueStone', width, 0.24, length, mid, quaternion);
  addOrientedBox(batch, 'venueMetal', width + 0.12, 0.08, 0.08, mid.clone().add(new THREE.Vector3(0, 0.15, 0)), quaternion);
  const perp = direction.clone().normalize().cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(width / 2);
  for (const side of [-1, 1]) {
    const railMid = mid.clone().addScaledVector(perp, side).add(new THREE.Vector3(0, 0.55, 0));
    addOrientedBox(batch, 'venueGlass', 0.035, 1.0, length, railMid, quaternion);
    const topMid = mid.clone().addScaledVector(perp, side).add(new THREE.Vector3(0, 1.08, 0));
    addOrientedBox(batch, 'venueMetal', 0.07, 0.07, length, topMid, quaternion);
  }
}

function addRamp(
  batch: GeometryBatch,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  width = 2.6,
): void {
  const start = new THREE.Vector3(from.x, from.y, from.z);
  const end = new THREE.Vector3(to.x, to.y, to.z);
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 0.1) return;
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.clone().normalize(),
  );
  const mid = start.clone().add(end).multiplyScalar(0.5);
  addOrientedBox(batch, 'venueStone', width, 0.28, length, mid, quaternion);
  // Approximate side rails following the ramp direction.
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).multiplyScalar(width / 2 + 0.08);
  for (const sign of [-1, 1]) {
    const railMid = mid.clone().addScaledVector(side, sign).add(new THREE.Vector3(0, 0.6, 0));
    addOrientedBox(batch, 'venueMetal', 0.08, 1.1, length, railMid, quaternion);
  }
}

function addPortal(
  batch: GeometryBatch,
  surface: THREE.Vector3,
  direction: THREE.Vector3,
  width = 2.7,
  height = 3.2,
): void {
  const yaw = Math.atan2(direction.x, direction.z);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
  for (const sign of [-1, 1]) {
    addOrientedBox(
      batch,
      'venueMetal',
      0.16,
      height,
      0.22,
      surface.clone().addScaledVector(tangent, sign * (width / 2 + 0.08)).add(new THREE.Vector3(0, height / 2, 0)),
      quaternion,
    );
  }
  addOrientedBox(
    batch,
    'venueMetal',
    width + 0.32,
    0.16,
    0.22,
    surface.clone().add(new THREE.Vector3(0, height, 0)),
    quaternion,
  );
}

function atriumCenter(spec: { angle: number; radius: number; offset: number }): THREE.Vector3 {
  const point = shellPoint(spec.angle * Math.PI);
  const inward = shellInwardNormal(spec.angle * Math.PI);
  return new THREE.Vector3(
    point.x - inward.x * spec.offset,
    0,
    point.z - inward.z * spec.offset,
  );
}

function connectAtrium(
  batch: GeometryBatch,
  endAngle: number,
  spec: { angle: number; radius: number; offset: number },
): void {
  const deckEnd = shellOffsetPoint(endAngle, 3);
  const center = atriumCenter(spec);
  const direction = new THREE.Vector3(deckEnd.x - center.x, 0, deckEnd.z - center.z);
  const distance = direction.length();
  if (distance <= spec.radius) return;
  direction.normalize();
  const surface = center.clone().addScaledVector(direction, spec.radius);
  const top = new THREE.Vector3(deckEnd.x, BALCONY.rowY[0], deckEnd.z);
  const surfaceTop = new THREE.Vector3(surface.x, BALCONY.rowY[0], surface.z);
  addBridge(batch, surfaceTop, top, 2.7);
  addPortal(batch, surfaceTop, direction, 2.8, 3.2);
}

function addStairTower(
  batch: GeometryBatch,
  angle: number,
  deckEndAngle: number,
): void {
  const groundPoint = shellOffsetPoint(angle, 11);
  const topPoint = shellOffsetPoint(angle, 4.6);
  addRamp(
    batch,
    { x: groundPoint.x, y: 0.1, z: groundPoint.z },
    { x: topPoint.x, y: BALCONY.rowY[0], z: topPoint.z },
    2.7,
  );
  const landing = shellOffsetPoint(angle, 3);
  addBridge(
    batch,
    new THREE.Vector3(topPoint.x, BALCONY.rowY[0], topPoint.z),
    new THREE.Vector3(landing.x, BALCONY.rowY[0], landing.z),
    2.6,
  );
  const deckEnd = shellOffsetPoint(deckEndAngle, 3);
  addBridge(
    batch,
    new THREE.Vector3(landing.x, BALCONY.rowY[0], landing.z),
    new THREE.Vector3(deckEnd.x, BALCONY.rowY[0], deckEnd.z),
    2.6,
  );
}

function addOriginalStair(
  batch: GeometryBatch,
  side: 'east' | 'west',
  deckEndAngle: number,
): void {
  const x = side === 'east' ? 19.5 : -19.5;
  const ground = { x, y: 0, z: 20 };
  const top = { x, y: BALCONY.rowY[0], z: 14 };
  addRamp(batch, ground, top, 3);
  const deckEnd = shellOffsetPoint(deckEndAngle, 3);
  addBridge(
    batch,
    new THREE.Vector3(top.x, top.y, top.z),
    new THREE.Vector3(deckEnd.x, BALCONY.rowY[0], deckEnd.z),
    2.4,
  );
}

export function buildCurvedBalconies(materials: Materials): BalconyResult {
  const batch = new GeometryBatch();
  const collisions: BalconyCollision[] = [];
  const eastAngles = samples(BALCONY.eastAngleRange[0] * Math.PI, BALCONY.eastAngleRange[1] * Math.PI, 34);
  const westAngles = samples(BALCONY.westAngleRange[0] * Math.PI, BALCONY.westAngleRange[1] * Math.PI, 34);

  for (const angles of [eastAngles, westAngles]) {
    // Three stepped terraces, outer/high to inner/low.
    batch.add('venueStone', curvedSlabGeometry(angles, 0.18, 2.0, BALCONY.rowY[2], 0.55));
    batch.add('venueStone', curvedSlabGeometry(angles, 2.0, 4.0, BALCONY.rowY[1], 0.5));
    batch.add('venueStone', curvedSlabGeometry(angles, 4.0, 6.0, BALCONY.rowY[0], 0.5));
    // Soffit and inner fascia.
    batch.add('venueConcrete', curvedSlabGeometry(angles, 0.18, 6.0, 4.72, 0.2));
    addRailing(batch, angles, 6.0, BALCONY.rowY[0], 1.0);

    // End railings.
    const first = angles[0];
    const last = angles[angles.length - 1];
    for (const angle of [first, last]) {
      const inner = shellOffsetPoint(angle, 0.18);
      const outer = shellOffsetPoint(angle, 6.0);
      addSegmentBox(batch, 'venueGlass', inner, outer, BALCONY.rowY[0] + 0.08, 1.0, 0.035);
      addSegmentBox(batch, 'venueMetal', inner, outer, BALCONY.rowY[0] + 1.08, 0.07, 0.07);
    }

    // Support columns under the inner edge.
    for (let i = 2; i < angles.length - 1; i += 5) {
      const angle = angles[i];
      const point = shellOffsetPoint(angle, 5.65);
      const column = new THREE.CylinderGeometry(0.18, 0.22, 4.8, 10);
      column.translate(point.x, 2.4, point.z);
      batch.add('venueMetal', column);
      collisions.push({ x: point.x, z: point.z, radius: 0.35 });
    }
  }

  // Atria portals / bridges. East south -> Cibadak, east north -> Cileutik,
  // west south -> Ciunik. West north has the new stair tower.
  connectAtrium(batch, BALCONY.eastAngleRange[1] * Math.PI, BALCONY.atria.cibadak);
  connectAtrium(batch, BALCONY.eastAngleRange[0] * Math.PI, BALCONY.atria.cileutik);
  connectAtrium(batch, BALCONY.westAngleRange[0] * Math.PI, BALCONY.atria.ciunik);

  // Secondary original stairs retained, plus the two new access towers.
  addOriginalStair(batch, 'east', BALCONY.eastAngleRange[1] * Math.PI);
  addOriginalStair(batch, 'west', BALCONY.westAngleRange[0] * Math.PI);
  addStairTower(batch, BALCONY.eastAngleRange[0] * Math.PI, BALCONY.eastAngleRange[0] * Math.PI);
  addStairTower(batch, BALCONY.westAngleRange[1] * Math.PI, BALCONY.westAngleRange[1] * Math.PI);

  // Clone materials double-sided for the custom curved slabs.
  const venueStone = materials.stone.clone();
  venueStone.side = THREE.DoubleSide;
  const venueConcrete = materials.concrete.clone();
  venueConcrete.side = THREE.DoubleSide;
  const venueMetal = materials.metal.clone();
  venueMetal.side = THREE.DoubleSide;
  const venueGlass = materials.glass.clone();
  venueGlass.side = THREE.DoubleSide;

  const group = batch.build(
    {
      venueStone,
      venueConcrete,
      venueMetal,
      venueGlass,
    },
    {
      venueStone: { castShadow: true, receiveShadow: true },
      venueConcrete: { castShadow: true, receiveShadow: true },
      venueMetal: { castShadow: true, receiveShadow: true },
      venueGlass: { castShadow: false, receiveShadow: false, renderOrder: 2 },
    },
  );
  group.name = 'curved-venue-balconies';
  group.userData.permanent = true;

  return {
    group,
    collisions,
    deckAngles: {
      east: [BALCONY.eastAngleRange[0] * Math.PI, BALCONY.eastAngleRange[1] * Math.PI],
      west: [BALCONY.westAngleRange[0] * Math.PI, BALCONY.westAngleRange[1] * Math.PI],
    },
  };
}

void TAU;
void VENUE_WORLD;
