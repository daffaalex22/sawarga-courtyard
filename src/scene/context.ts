import * as THREE from 'three';
import { COLORS, WORLD } from './config';
import type { Materials } from './materials';
import { GeometryBatch } from './batch';
import { makeRng, randRange } from '../utils/rng';

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

/** Mall roof, distant city silhouettes and the ground plane outside the courtyard. */
export function buildContext(materials: Materials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'context';
  const rng = makeRng(0xc0ffee);

  // Roof ring over the mall wings.
  const roofShape = ellipseRingShape(
    WORLD.radiusX + 30,
    WORLD.radiusZ + 30,
    WORLD.radiusX + WORLD.facadeDepth,
    WORLD.radiusZ + WORLD.facadeDepth,
  );
  const roofGeometry = new THREE.ExtrudeGeometry(roofShape, {
    depth: 0.55,
    bevelEnabled: false,
    curveSegments: 64,
    steps: 1,
  });
  const roof = new THREE.Mesh(roofGeometry, materials.roof);
  roof.rotation.x = -Math.PI / 2;
  roof.position.y = WORLD.mallTop - 0.55;
  roof.receiveShadow = true;
  roof.castShadow = true;
  roof.name = 'mall-roof';
  group.add(roof);

  // Parapets at the courtyard edge and at the outer roof edge.
  const innerParapetShape = ellipseRingShape(
    WORLD.radiusX + WORLD.facadeDepth + 0.7,
    WORLD.radiusZ + WORLD.facadeDepth + 0.7,
    WORLD.radiusX + WORLD.facadeDepth,
    WORLD.radiusZ + WORLD.facadeDepth,
  );
  const innerParapet = new THREE.Mesh(
    new THREE.ExtrudeGeometry(innerParapetShape, {
      depth: 0.75,
      bevelEnabled: false,
      curveSegments: 64,
      steps: 1,
    }),
    materials.stone,
  );
  innerParapet.rotation.x = -Math.PI / 2;
  innerParapet.position.y = WORLD.mallTop - 0.05;
  innerParapet.castShadow = true;
  innerParapet.receiveShadow = true;
  innerParapet.name = 'roof-inner-parapet';
  group.add(innerParapet);

  const outerParapetShape = ellipseRingShape(
    WORLD.radiusX + 30.7,
    WORLD.radiusZ + 30.7,
    WORLD.radiusX + 30,
    WORLD.radiusZ + 30,
  );
  const outerParapet = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outerParapetShape, {
      depth: 0.9,
      bevelEnabled: false,
      curveSegments: 64,
      steps: 1,
    }),
    materials.stone,
  );
  outerParapet.rotation.x = -Math.PI / 2;
  outerParapet.position.y = WORLD.mallTop - 0.05;
  outerParapet.castShadow = true;
  outerParapet.receiveShadow = true;
  outerParapet.name = 'roof-outer-parapet';
  group.add(outerParapet);

  // Rooftop plant and skylights.
  const roofBatch = new GeometryBatch();
  for (let i = 0; i < 22; i += 1) {
    const angle = (i / 22) * Math.PI * 2 + randRange(rng, -0.08, 0.08);
    const radius = 1 + randRange(rng, 0.2, 0.9);
    const x = Math.cos(angle) * (WORLD.radiusX + 6) * radius;
    const z = Math.sin(angle) * (WORLD.radiusZ + 6) * radius;
    const w = randRange(rng, 3, 9);
    const d = randRange(rng, 2, 7);
    const h = randRange(rng, 0.7, 2.4);
    roofBatch.addBox('roofUnit', w, h, d, x, WORLD.mallTop + h / 2, z);
    if (i % 4 === 0) {
      roofBatch.addBox('roofGlass', w * 0.35, 0.18, d * 0.7, x, WORLD.mallTop + h + 0.1, z);
    }
  }

  // Linear skylights and green roof strips along the inner edge.
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + 0.2;
    const x = Math.cos(angle) * (WORLD.radiusX + 9);
    const z = Math.sin(angle) * (WORLD.radiusZ + 9);
    roofBatch.addBox('roofGlass', 5.2, 0.2, 1.6, x, WORLD.mallTop + 0.12, z);
  }
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2 + 0.38;
    const x = Math.cos(angle) * (WORLD.radiusX + 5.4);
    const z = Math.sin(angle) * (WORLD.radiusZ + 5.4);
    roofBatch.addBox('roofGreen', 2.6, 0.7, 1.4, x, WORLD.mallTop + 0.35, z);
  }

  const roofUnits = roofBatch.build(
    {
      roofUnit: materials.concrete,
      roofGlass: materials.glassDark,
      roofGreen: materials.shrub,
    },
    {
      roofUnit: { castShadow: true, receiveShadow: true },
      roofGlass: { castShadow: false, receiveShadow: false },
      roofGreen: { castShadow: false, receiveShadow: true },
    },
  );
  group.add(roofUnits);

  // Ground plane outside the mall.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(460, 64),
    new THREE.MeshStandardMaterial({ color: 0x716b5b, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.24;
  ground.receiveShadow = false;
  ground.name = 'outer-ground';
  group.add(ground);

  // Distant low-rise city; one instanced draw call.
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  buildingGeometry.translate(0, 0.5, 0);
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8b0a3,
    roughness: 0.92,
    metalness: 0.02,
  });
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, 42);
  buildings.castShadow = false;
  buildings.receiveShadow = false;
  buildings.name = 'distant-buildings';
  const dummy = new THREE.Object3D();
  const buildingColors = [0xb8b0a3, 0xc4bbae, 0xa8a194, 0xcfc7b8, 0x9f978b];
  const color = new THREE.Color();
  for (let i = 0; i < 42; i += 1) {
    const angle = (i / 42) * Math.PI * 2 + randRange(rng, -0.06, 0.06);
    const radius = randRange(rng, 95, 230);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const w = randRange(rng, 8, 26);
    const d = randRange(rng, 8, 24);
    const h = randRange(rng, 7, 34);
    dummy.position.set(x, -0.2, z);
    dummy.rotation.set(0, randRange(rng, 0, Math.PI), 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    buildings.setMatrixAt(i, dummy.matrix);
    color.setHex(buildingColors[i % buildingColors.length]);
    buildings.setColorAt(i, color);
  }
  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  group.add(buildings);

  // Treeline between the mall and the city.
  const treeGeometry = new THREE.IcosahedronGeometry(1, 1);
  const treeMaterial = new THREE.MeshStandardMaterial({
    color: 0x4d5c3d,
    roughness: 1,
    metalness: 0,
  });
  const treeline = new THREE.InstancedMesh(treeGeometry, treeMaterial, 76);
  treeline.castShadow = false;
  treeline.receiveShadow = false;
  treeline.name = 'distant-treeline';
  for (let i = 0; i < 76; i += 1) {
    const angle = (i / 76) * Math.PI * 2 + randRange(rng, -0.04, 0.04);
    const radius = randRange(rng, 72, 112);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const s = randRange(rng, 2.4, 6.2);
    dummy.position.set(x, s * 0.55 - 0.2, z);
    dummy.rotation.set(randRange(rng, -0.1, 0.1), randRange(rng, 0, Math.PI), randRange(rng, -0.08, 0.08));
    dummy.scale.set(s * 1.25, s, s * 1.1);
    dummy.updateMatrix();
    treeline.setMatrixAt(i, dummy.matrix);
  }
  treeline.instanceMatrix.needsUpdate = true;
  group.add(treeline);

  // A few taller landmarks for the overview.
  const landmarkMaterial = new THREE.MeshStandardMaterial({
    color: 0xa7a198,
    roughness: 0.9,
    metalness: 0.03,
  });
  for (let i = 0; i < 5; i += 1) {
    const angle = 0.35 + (i / 5) * Math.PI * 0.9;
    const x = Math.cos(angle) * randRange(rng, 140, 220);
    const z = Math.sin(angle) * randRange(rng, 140, 220);
    const h = randRange(rng, 38, 68);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(randRange(rng, 10, 18), h, randRange(rng, 10, 18)), landmarkMaterial);
    tower.position.set(x, h / 2 - 0.2, z);
    tower.castShadow = false;
    tower.receiveShadow = false;
    group.add(tower);
  }

  // Warm landscape strip immediately outside the facade base.
  const verge = new THREE.Mesh(
    new THREE.RingGeometry(WORLD.radiusX + 1.4, WORLD.radiusX + 3.2, 96),
    new THREE.MeshStandardMaterial({ color: 0x4e5f36, roughness: 1 }),
  );
  verge.rotation.x = -Math.PI / 2;
  verge.position.y = -0.02;
  verge.scale.y = WORLD.radiusZ / WORLD.radiusX;
  verge.receiveShadow = true;
  group.add(verge);

  void COLORS;
  return group;
}
