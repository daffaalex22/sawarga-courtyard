import * as THREE from 'three';

/**
 * Project UVs from world/local position using the dominant normal axis.
 * Keeps brick and stone scale consistent across boxes, extrusions and curves.
 */
export function triplanarUVs(
  geometry: THREE.BufferGeometry,
  scale: number,
  offsetU = 0,
  offsetV = 0,
): void {
  const pos = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv') ?? new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
  if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', uv);

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));

    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) {
      u = z / scale;
      v = y / scale;
    } else if (ny >= nx && ny >= nz) {
      u = x / scale;
      v = z / scale;
    } else {
      u = x / scale;
      v = y / scale;
    }
    uv.setXY(i, u + offsetU, v + offsetV);
  }
  uv.needsUpdate = true;
}

/** Duplicate UV0 into UV1 so aoMap works after geometry merging. */
export function ensureUV1(geometry: THREE.BufferGeometry): void {
  if (geometry.getAttribute('uv1')) return;
  const uv = geometry.getAttribute('uv');
  if (!uv) return;
  geometry.setAttribute('uv1', uv.clone());
}

export function translateGeometry(
  geometry: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  geometry.translate(x, y, z);
  return geometry;
}

export function box(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  uvScale = 3.4,
  uvOffsetU = 0,
  uvOffsetV = 0,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  translateGeometry(geometry, x, y, z);
  triplanarUVs(geometry, uvScale, uvOffsetU, uvOffsetV);
  ensureUV1(geometry);
  return geometry;
}

/** Round arch opening path from the ground to the springline plus a semicircle. */
export function archOpeningShape(width: number, springHeight: number): THREE.Shape {
  const r = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-r, 0);
  shape.lineTo(-r, springHeight);
  shape.absarc(0, springHeight, r, Math.PI, 0, true);
  shape.lineTo(r, 0);
  shape.lineTo(-r, 0);
  return shape;
}

/**
 * The solid above an arch: a rectangle whose bottom edge follows the arch curve.
 * Used with side piers to build an open/ blind arch wall without CSG.
 */
export function archSpandrelShape(
  width: number,
  springHeight: number,
  topHeight: number,
): THREE.Shape {
  const r = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-r, springHeight);
  shape.lineTo(-r, topHeight);
  shape.lineTo(r, topHeight);
  shape.lineTo(r, springHeight);
  shape.absarc(0, springHeight, r, 0, Math.PI, false);
  shape.lineTo(-r, springHeight);
  return shape;
}

export function extrudeWallShape(
  shape: THREE.Shape,
  depth: number,
  uvScale: number,
  uvOffsetU: number,
  uvOffsetV: number,
): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 14,
    steps: 1,
  });
  // ExtrudeGeometry builds from z=0 to z=depth. Put the front face at z=0.
  geometry.translate(0, 0, -depth);
  triplanarUVs(geometry, uvScale, uvOffsetU, uvOffsetV);
  ensureUV1(geometry);
  return geometry;
}

export function ellipsePoint(rx: number, rz: number, angle: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(Math.cos(angle) * rx, 0, Math.sin(angle) * rz);
}

/** Outward normal of the courtyard ellipse at a parameter angle. */
export function ellipseOutwardNormal(
  rx: number,
  rz: number,
  angle: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const x = Math.cos(angle) / rx;
  const z = Math.sin(angle) / rz;
  const len = Math.hypot(x, z) || 1;
  return target.set(x / len, 0, z / len);
}

/** Yaw that makes local +Z point inward toward the courtyard center. */
export function inwardYaw(rx: number, rz: number, angle: number): number {
  const n = ellipseOutwardNormal(rx, rz, angle);
  return Math.atan2(-n.x, -n.z);
}

export function ellipseArcLength(
  rx: number,
  rz: number,
  start: number,
  end: number,
  steps = 48,
): number {
  let length = 0;
  let prev = ellipsePoint(rx, rz, start);
  for (let i = 1; i <= steps; i += 1) {
    const t = start + ((end - start) * i) / steps;
    const p = ellipsePoint(rx, rz, t);
    length += p.distanceTo(prev);
    prev = p;
  }
  return length;
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if ((value as THREE.Texture | undefined)?.isTexture) {
          (value as THREE.Texture).dispose();
        }
      }
      material.dispose();
    }
  });
}
