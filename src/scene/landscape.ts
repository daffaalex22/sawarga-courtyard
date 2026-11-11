import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ANGLES, WORLD } from './config';
import type { Materials } from './materials';
import { GeometryBatch } from './batch';
import type { CollisionWorld } from '../controls/CollisionWorld';
import {
  ellipseOutwardNormal,
  ellipsePoint,
  inwardYaw,
  triplanarUVs,
  ensureUV1,
} from '../utils/geometry';
import { makeRng, randRange, type Rng } from '../utils/rng';

interface TreeVariant {
  trunk: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry;
}

function branchGeometry(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radiusBottom: number,
  radiusTop: number,
  segments = 6,
): THREE.BufferGeometry {
  const direction = to.clone().sub(from);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments, 1);
  geometry.translate(0, length / 2, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  geometry.applyQuaternion(quaternion);
  geometry.translate(from.x, from.y, from.z);
  return geometry;
}

function makeTreeVariant(seed: number, variant: number): TreeVariant {
  const rng = makeRng(seed);
  const trunkParts: THREE.BufferGeometry[] = [];
  const trunkHeight = 4.1 + rng() * 0.8;
  trunkParts.push(branchGeometry(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(randRange(rng, -0.2, 0.2), trunkHeight, randRange(rng, -0.2, 0.2)),
    0.27,
    0.13,
    7,
  ));

  const branchCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < branchCount; i += 1) {
    const angle = rng() * Math.PI * 2;
    const start = new THREE.Vector3(
      randRange(rng, -0.08, 0.08),
      trunkHeight * randRange(rng, 0.68, 0.96),
      randRange(rng, -0.08, 0.08),
    );
    const length = 1.2 + rng() * 1.2;
    const end = new THREE.Vector3(
      Math.cos(angle) * length,
      start.y + randRange(rng, 0.6, 1.5),
      Math.sin(angle) * length,
    );
    trunkParts.push(branchGeometry(start, end, 0.075, 0.035, 5));
  }
  const trunk = mergeGeometries(trunkParts, false) ?? trunkParts[0];
  for (const part of trunkParts) if (part !== trunk) part.dispose();
  trunk.computeBoundingSphere();

  const leafParts: THREE.BufferGeometry[] = [];
  const canopyRadius = variant === 0 ? 2.85 : 3.15;
  const canopyHeight = variant === 0 ? 2.4 : 2.7;
  const clusters = 16;
  for (let i = 0; i < clusters; i += 1) {
    const angle = (i / clusters) * Math.PI * 2 + randRange(rng, -0.35, 0.35);
    const ring = 0.3 + rng() * 0.7;
    const cx = Math.cos(angle) * canopyRadius * ring;
    const cz = Math.sin(angle) * canopyRadius * ring * 0.9;
    const cy = trunkHeight + canopyHeight * randRange(rng, -0.4, 0.7);
    const size = 3.2 + rng() * 1.6;
    const planes = 3;
    for (let p = 0; p < planes; p += 1) {
      const plane = new THREE.PlaneGeometry(size, size * randRange(rng, 0.72, 0.95));
      plane.rotateY(angle + (p / planes) * Math.PI + randRange(rng, -0.25, 0.25));
      plane.rotateX(randRange(rng, -0.18, 0.18));
      plane.translate(cx, cy, cz);
      leafParts.push(plane);
    }
  }
  const leaves = mergeGeometries(leafParts, false) ?? leafParts[0];
  for (const part of leafParts) if (part !== leaves) part.dispose();
  leaves.computeBoundingSphere();

  return { trunk, leaves };
}

function makeStoneBenchGeometry(): THREE.BufferGeometry {
  const base = new THREE.BoxGeometry(2.05, 0.36, 0.52);
  base.translate(0, 0.18, 0);
  const top = new THREE.BoxGeometry(2.3, 0.1, 0.64);
  top.translate(0, 0.41, 0);
  const merged = mergeGeometries([base, top], false)!;
  base.dispose();
  top.dispose();
  return merged;
}

export interface LandscapeResult {
  group: THREE.Group;
  treeInstances: number;
}

export function buildLandscape(
  materials: Materials,
  collision: CollisionWorld,
): LandscapeResult {
  const group = new THREE.Group();
  group.name = 'landscape';
  const rng = makeRng(0x1a4d5c);

  // Planter positions around the perimeter, skipping the main gaps.
  const planterAngles = [1.24, 1.5, 1.6];
  const planterRadius = 2.7;
  const batches = new GeometryBatch();
  const placements: Array<{ x: number; z: number; angle: number; variant: number; scale: number; rotation: number }> = [];

  for (const angle of planterAngles) {
    const point = ellipsePoint(WORLD.radiusX - 4.2, WORLD.radiusZ - 3.4, angle * Math.PI);
    const yaw = inwardYaw(WORLD.radiusX, WORLD.radiusZ, angle * Math.PI);
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(point.x, 0, point.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    // Stone planter box, rim and soil.
    batches.add('stone', new THREE.BoxGeometry(planterRadius * 2, 0.62, planterRadius * 2).translate(0, 0.31, 0), matrix);
    batches.add('stone', new THREE.BoxGeometry(planterRadius * 2 + 0.24, 0.14, planterRadius * 2 + 0.24).translate(0, 0.67, 0), matrix);
    batches.add('soil', new THREE.BoxGeometry(planterRadius * 2 - 0.3, 0.08, planterRadius * 2 - 0.3).translate(0, 0.68, 0), matrix);
    collision.addCircle(point.x, point.z, planterRadius + 0.2);

    placements.push({
      x: point.x,
      z: point.z,
      angle,
      variant: placements.length % 2,
      scale: randRange(rng, 1.0, 1.28),
      rotation: randRange(rng, 0, Math.PI * 2),
    });
  }

  // Venue-side trees: between the floor seating and the shell-attached
  // balconies. These replace the old perimeter planters that would have
  // collided with the curved decks.
  const venueTreePositions: Array<[number, number]> = [
    [-20.5, -7], [-20.5, 1], [-20.5, 7],
    [20.5, -7], [20.5, 1], [20.5, 7],
  ];
  const venuePlanterRadius = 2;
  for (const [x, z] of venueTreePositions) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0, z),
      new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1),
    );
    batches.add('stone', new THREE.BoxGeometry(venuePlanterRadius * 2, 0.62, venuePlanterRadius * 2).translate(0, 0.31, 0), matrix);
    batches.add('stone', new THREE.BoxGeometry(venuePlanterRadius * 2 + 0.24, 0.14, venuePlanterRadius * 2 + 0.24).translate(0, 0.67, 0), matrix);
    batches.add('soil', new THREE.BoxGeometry(venuePlanterRadius * 2 - 0.3, 0.08, venuePlanterRadius * 2 - 0.3).translate(0, 0.68, 0), matrix);
    collision.addCircle(x, z, venuePlanterRadius + 0.2);
    placements.push({
      x,
      z,
      angle: 0,
      variant: placements.length % 2,
      // Lower than the perimeter trees so the curved balconies keep a clear
      // sightline to the stage.
      scale: randRange(rng, 0.55, 0.72),
      rotation: randRange(rng, 0, Math.PI * 2),
    });
  }

  const planterMeshes = batches.build(
    { stone: materials.stone, soil: materials.soil },
    { stone: { castShadow: true, receiveShadow: true }, soil: { castShadow: false, receiveShadow: true } },
  );
  group.add(planterMeshes);

  // Trees: two merged variants, instanced by variant.
  const variants = [makeTreeVariant(0x7a11, 0), makeTreeVariant(0x9b22, 1)];
  for (let v = 0; v < variants.length; v += 1) {
    const variant = variants[v];
    const items = placements.filter((placement) => placement.variant === v);
    if (items.length === 0) continue;
    const trunkMesh = new THREE.InstancedMesh(variant.trunk, materials.bark, items.length);
    const leafMesh = new THREE.InstancedMesh(variant.leaves, materials.foliage, items.length);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    leafMesh.customDepthMaterial = materials.foliageDepth;
    trunkMesh.name = `tree-trunks-${v}`;
    leafMesh.name = `tree-leaves-${v}`;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      dummy.position.set(item.x, 0.68, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      leafMesh.setMatrixAt(i, dummy.matrix);
      const shade = 0.78 + rng() * 0.28;
      color.setRGB(shade, shade, shade);
      leafMesh.setColorAt(i, color);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    leafMesh.computeBoundingSphere();
    trunkMesh.computeBoundingSphere();
    group.add(trunkMesh, leafMesh);
  }

  // Low shrubs inside each planter, hiding the bare soil around the trunks.
  const bushGeometry = new THREE.IcosahedronGeometry(0.55, 1);
  bushGeometry.scale(1.25, 0.72, 1.1);
  const bushCount = placements.length * 3;
  const planterBushes = new THREE.InstancedMesh(bushGeometry, materials.shrub, bushCount);
  planterBushes.castShadow = true;
  planterBushes.receiveShadow = true;
  planterBushes.name = 'planter-bushes';
  const bushDummy = new THREE.Object3D();
  const bushColor = new THREE.Color();
  let bushIndex = 0;
  for (const placement of placements) {
    for (let j = 0; j < 3; j += 1) {
      const angle = (j / 3) * Math.PI * 2 + randRange(rng, -0.35, 0.35);
      const radius = randRange(rng, 0.55, 1.05);
      bushDummy.position.set(
        placement.x + Math.cos(angle) * radius,
        0.82,
        placement.z + Math.sin(angle) * radius,
      );
      bushDummy.rotation.set(0, randRange(rng, 0, Math.PI * 2), 0);
      bushDummy.scale.setScalar(randRange(rng, 0.65, 1.05));
      bushDummy.updateMatrix();
      planterBushes.setMatrixAt(bushIndex, bushDummy.matrix);
      const shade = 0.8 + rng() * 0.3;
      bushColor.setRGB(shade * 0.88, shade, shade * 0.78);
      planterBushes.setColorAt(bushIndex, bushColor);
      bushIndex += 1;
    }
  }
  planterBushes.instanceMatrix.needsUpdate = true;
  if (planterBushes.instanceColor) planterBushes.instanceColor.needsUpdate = true;
  planterBushes.computeBoundingSphere();
  group.add(planterBushes);

  // Hanging vines on the brick wall tops.
  const vineGeometry = new THREE.PlaneGeometry(2.7, 4.1);
  vineGeometry.translate(0, -2.05, 0);
  ensureUV1(vineGeometry);
  const vinePlacements: Array<{ x: number; z: number; yaw: number; height: number; scale: number }> = [];
  const vineSegments: Array<[number, number]> = [
    [0.82, 1.02],
    [1.14, 1.7],
  ];
  for (const [start, end] of vineSegments) {
    const step = 0.014;
    for (let a = start; a <= end; a += step) {
      if (rng() > 0.56) continue;
      const angle = a * Math.PI;
      const point = ellipsePoint(WORLD.radiusX, WORLD.radiusZ, angle);
      const yaw = inwardYaw(WORLD.radiusX, WORLD.radiusZ, angle);
      const inward = ellipseOutwardNormal(WORLD.radiusX, WORLD.radiusZ, angle).multiplyScalar(-1);
      vinePlacements.push({
        x: point.x + inward.x * 0.09,
        z: point.z + inward.z * 0.09,
        yaw,
        height: WORLD.heroWallHeight - 0.1,
        scale: randRange(rng, 0.82, 1.35),
      });
    }
  }
  if (vinePlacements.length > 0) {
    const vines = new THREE.InstancedMesh(vineGeometry, materials.vine, vinePlacements.length);
    vines.castShadow = true;
    vines.receiveShadow = true;
    vines.customDepthMaterial = materials.vineDepth;
    vines.name = 'wall-vines';
    const dummy = new THREE.Object3D();
    for (let i = 0; i < vinePlacements.length; i += 1) {
      const item = vinePlacements[i];
      dummy.position.set(item.x, item.height, item.z);
      dummy.rotation.set(0, item.yaw, 0);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      vines.setMatrixAt(i, dummy.matrix);
    }
    vines.instanceMatrix.needsUpdate = true;
    vines.computeBoundingSphere();
    group.add(vines);
  }

  // Benches along the plaza edge.
  const benchData = [{ angle: 1.74, offset: 4.6 }];
  const benchGeometry = makeStoneBenchGeometry();
  const benchCount = benchData.length;
  const benches = new THREE.InstancedMesh(benchGeometry, materials.stone, benchCount);
  benches.castShadow = true;
  benches.receiveShadow = true;
  const benchDummy = new THREE.Object3D();
  for (let i = 0; i < benchData.length; i += 1) {
    const item = benchData[i];
    const point = ellipsePoint(WORLD.radiusX - item.offset, WORLD.radiusZ - item.offset * 0.7, item.angle * Math.PI);
    const yaw = inwardYaw(WORLD.radiusX, WORLD.radiusZ, item.angle * Math.PI) + Math.PI / 2;
    benchDummy.position.set(point.x, 0, point.z);
    benchDummy.rotation.set(0, yaw, 0);
    benchDummy.scale.setScalar(1);
    benchDummy.updateMatrix();
    benches.setMatrixAt(i, benchDummy.matrix);
    collision.addCircle(point.x, point.z, 1.3);
  }
  benches.instanceMatrix.needsUpdate = true;
  benches.computeBoundingSphere();
  group.add(benches);

  // Slim light poles around the plaza.
  const poleAngles = [1.75, 4.105];
  const poleCount = poleAngles.length;
  const poleGeometry = new THREE.CylinderGeometry(0.06, 0.075, 3.7, 8);
  poleGeometry.translate(0, 1.85, 0);
  const poleMesh = new THREE.InstancedMesh(poleGeometry, materials.metal, poleCount);
  const lanternGeometry = new THREE.CylinderGeometry(0.15, 0.19, 0.42, 8);
  lanternGeometry.translate(0, 3.72, 0);
  const lanternMesh = new THREE.InstancedMesh(lanternGeometry, materials.lamp, poleCount);
  poleMesh.castShadow = true;
  poleMesh.receiveShadow = true;
  lanternMesh.castShadow = false;
  lanternMesh.receiveShadow = false;
  const poleDummy = new THREE.Object3D();
  for (let i = 0; i < poleCount; i += 1) {
    const angle = poleAngles[i];
    const point = ellipsePoint(WORLD.radiusX - 6.2, WORLD.radiusZ - 5.4, angle);
    poleDummy.position.set(point.x, 0, point.z);
    poleDummy.rotation.set(0, 0, 0);
    poleDummy.updateMatrix();
    poleMesh.setMatrixAt(i, poleDummy.matrix);
    lanternMesh.setMatrixAt(i, poleDummy.matrix);
    collision.addCircle(point.x, point.z, 0.24);
  }
  poleMesh.instanceMatrix.needsUpdate = true;
  lanternMesh.instanceMatrix.needsUpdate = true;
  poleMesh.computeBoundingSphere();
  lanternMesh.computeBoundingSphere();
  group.add(poleMesh, lanternMesh);

  // A few low shrubs near the atria to soften the glass edges.
  const shrubGeometry = new THREE.IcosahedronGeometry(0.85, 1);
  shrubGeometry.scale(1.25, 0.8, 1.1);
  const shrubs = new THREE.InstancedMesh(shrubGeometry, materials.shrub, 14);
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  const shrubDummy = new THREE.Object3D();
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2 + 0.1;
    const point = ellipsePoint(WORLD.radiusX - 1.8, WORLD.radiusZ - 1.8, angle);
    shrubDummy.position.set(point.x, 0.55, point.z);
    shrubDummy.rotation.set(0, randRange(rng, 0, Math.PI * 2), 0);
    shrubDummy.scale.setScalar(randRange(rng, 0.75, 1.35));
    shrubDummy.updateMatrix();
    shrubs.setMatrixAt(i, shrubDummy.matrix);
  }
  shrubs.instanceMatrix.needsUpdate = true;
  shrubs.computeBoundingSphere();
  group.add(shrubs);

  void ANGLES;
  return { group, treeInstances: placements.length };
}
