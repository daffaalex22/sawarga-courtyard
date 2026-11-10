import * as THREE from 'three';
import { PAVING_DEPTH, PAVING_WIDTH, WORLD } from './config';
import type { Materials } from './materials';
import { makePavingTextures } from '../utils/canvas';

export interface PavingResult {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
}

function ellipseRingShape(
  outerX: number,
  outerZ: number,
  innerX: number,
  innerZ: number,
): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, outerX, outerZ, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, innerX, innerZ, 0, Math.PI * 2, true, 0);
  shape.holes.push(hole);
  return shape;
}

export function buildPaving(materials: Materials, quality: 'low' | 'medium' | 'high'): PavingResult {
  const group = new THREE.Group();
  group.name = 'paving';

  const resolution = quality === 'low' ? 1024 : 2048;
  const textures = makePavingTextures(resolution, Math.floor(resolution * 0.75));
  const material = new THREE.MeshStandardMaterial({
    map: textures.map,
    roughnessMap: textures.roughnessMap,
    bumpMap: textures.map,
    bumpScale: 0.012,
    roughness: 0.88,
    metalness: 0.0,
    color: 0xc0ab94,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(PAVING_WIDTH, PAVING_DEPTH), material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  floor.name = 'paving-floor';
  group.add(floor);

  // Raised stone curb around the courtyard.
  const curbShape = ellipseRingShape(
    WORLD.radiusX + 1.05,
    WORLD.radiusZ + 1.05,
    WORLD.radiusX + 0.08,
    WORLD.radiusZ + 0.08,
  );
  const curbGeometry = new THREE.ExtrudeGeometry(curbShape, {
    depth: 0.22,
    bevelEnabled: false,
    curveSegments: 96,
    steps: 1,
  });
  const curb = new THREE.Mesh(curbGeometry, materials.stone);
  curb.rotation.x = -Math.PI / 2;
  curb.position.y = 0;
  curb.castShadow = true;
  curb.receiveShadow = true;
  curb.name = 'paving-curb';
  group.add(curb);

  return { group, material };
}
