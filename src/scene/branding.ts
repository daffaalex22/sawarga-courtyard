import * as THREE from 'three';
import type { Materials } from './materials';
import type { FacadeAnchors, SignAnchor } from './facades';

function signMesh(
  material: THREE.Material,
  anchor: SignAnchor,
  backing: THREE.Material,
  backingDepth: number,
): THREE.Group {
  const group = new THREE.Group();
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, anchor.yaw, 0));
  const inward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(anchor.width + 0.38, anchor.height + 0.3, backingDepth),
    backing,
  );
  frame.position.copy(anchor.position).addScaledVector(inward, -backingDepth / 2 - 0.01);
  frame.quaternion.copy(quaternion);
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(anchor.width, anchor.height), material);
  plane.position.copy(anchor.position).addScaledVector(inward, 0.006);
  plane.quaternion.copy(quaternion);
  plane.castShadow = false;
  plane.receiveShadow = false;
  group.add(plane);

  return group;
}

/** Wall-mounted Summarecon / Sawarga / Downtown Walk signs. */
export function buildBranding(materials: Materials, anchors: FacadeAnchors): THREE.Group {
  const group = new THREE.Group();
  group.name = 'branding';
  group.add(signMesh(materials.signMain, anchors.main, materials.metal, 0.32));
  group.add(signMesh(materials.signCourtyard, anchors.courtyard, materials.metal, 0.28));
  group.add(signMesh(materials.signDowntown, anchors.downtown, materials.metal, 0.22));
  return group;
}
