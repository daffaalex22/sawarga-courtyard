import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ensureUV1 } from '../utils/geometry';

export interface BatchOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  customDepthMaterial?: THREE.Material;
  renderOrder?: number;
}

/**
 * Accumulates transformed geometries by material key, then merges each bucket
 * into a single draw call. Static architecture only.
 */
export class GeometryBatch {
  private buckets = new Map<string, THREE.BufferGeometry[]>();

  add(key: string, geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): void {
    let prepared = geometry;
    if (prepared.index) {
      const nonIndexed = prepared.toNonIndexed();
      prepared.dispose();
      prepared = nonIndexed;
    }
    if (!prepared.getAttribute('normal')) prepared.computeVertexNormals();
    ensureUV1(prepared);
    if (matrix) prepared.applyMatrix4(matrix);
    const bucket = this.buckets.get(key);
    if (bucket) bucket.push(prepared);
    else this.buckets.set(key, [prepared]);
  }

  addBox(
    key: string,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    matrix?: THREE.Matrix4,
  ): void {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.translate(x, y, z);
    this.add(key, geometry, matrix);
  }

  build(
    materials: Record<string, THREE.Material>,
    options: Record<string, BatchOptions> = {},
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'static-batch';

    for (const [key, geometries] of this.buckets) {
      const material = materials[key];
      if (!material) {
        console.warn(`[batch] missing material: ${key}`);
        continue;
      }
      const merged = mergeGeometries(geometries, false);
      if (!merged) {
        console.warn(`[batch] failed to merge ${key}; falling back to individual meshes`);
        for (const geometry of geometries) {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = options[key]?.castShadow ?? true;
          mesh.receiveShadow = options[key]?.receiveShadow ?? true;
          mesh.renderOrder = options[key]?.renderOrder ?? 0;
          group.add(mesh);
        }
        continue;
      }

      for (const geometry of geometries) geometry.dispose();
      const mesh = new THREE.Mesh(merged, material);
      const opts = options[key] ?? {};
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      mesh.renderOrder = opts.renderOrder ?? 0;
      if (opts.customDepthMaterial) mesh.customDepthMaterial = opts.customDepthMaterial;
      mesh.name = key;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }

    this.buckets.clear();
    return group;
  }
}
