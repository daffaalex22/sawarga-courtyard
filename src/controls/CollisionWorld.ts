import * as THREE from 'three';
import { WORLD } from '../scene/config';

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
}

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  nx: number;
  nz: number;
}

/**
 * Lightweight 2D collision for a first-person walker: ellipse boundary,
 * circles for planters/trees/poles, and axis-aligned boxes for benches.
 */
export class CollisionWorld {
  readonly circles: CircleCollider[] = [];
  readonly boxes: BoxCollider[] = [];
  private readonly segments: Segment[] = [];

  constructor(rx = WORLD.radiusX, rz = WORLD.radiusZ, inset = 0.55, count = 128) {
    const innerX = rx - inset;
    const innerZ = rz - inset;
    const points: THREE.Vector2[] = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      points.push(new THREE.Vector2(Math.cos(angle) * innerX, Math.sin(angle) * innerZ));
    }
    for (let i = 0; i < count; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % count];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const inward = mid.clone().multiplyScalar(-1).normalize();
      this.segments.push({ ax: a.x, az: a.y, bx: b.x, bz: b.y, nx: inward.x, nz: inward.y });
    }
  }

  addCircle(x: number, z: number, radius: number): void {
    this.circles.push({ x, z, radius });
  }

  addBox(minX: number, maxX: number, minZ: number, maxZ: number): void {
    this.boxes.push({ minX, maxX, minZ, maxZ });
  }

  resolve(
    x: number,
    z: number,
    radius: number,
    skipObstacles = false,
  ): { x: number; z: number } {
    let px = x;
    let pz = z;

    for (let iteration = 0; iteration < 3; iteration += 1) {
      for (const segment of this.segments) {
        const closest = closestPointOnSegment(px, pz, segment);
        const dx = px - closest.x;
        const dz = pz - closest.z;
        const distance = Math.hypot(dx, dz);
        if (distance < radius) {
          const push = radius - distance;
          px += segment.nx * push;
          pz += segment.nz * push;
        }
      }

      if (skipObstacles) continue;

      for (const circle of this.circles) {
        const dx = px - circle.x;
        const dz = pz - circle.z;
        const distance = Math.hypot(dx, dz);
        const minimum = radius + circle.radius;
        if (distance < minimum) {
          const nx = distance > 0.0001 ? dx / distance : 1;
          const nz = distance > 0.0001 ? dz / distance : 0;
          const push = minimum - distance;
          px += nx * push;
          pz += nz * push;
        }
      }

      for (const box of this.boxes) {
        const minX = box.minX - radius;
        const maxX = box.maxX + radius;
        const minZ = box.minZ - radius;
        const maxZ = box.maxZ + radius;
        if (px <= minX || px >= maxX || pz <= minZ || pz >= maxZ) continue;
        const dl = px - minX;
        const dr = maxX - px;
        const dt = pz - minZ;
        const db = maxZ - pz;
        const minimum = Math.min(dl, dr, dt, db);
        if (minimum === dl) px = minX;
        else if (minimum === dr) px = maxX;
        else if (minimum === dt) pz = minZ;
        else pz = maxZ;
      }
    }

    return { x: px, z: pz };
  }
}

function closestPointOnSegment(
  x: number,
  z: number,
  segment: Segment,
): { x: number; z: number } {
  const dx = segment.bx - segment.ax;
  const dz = segment.bz - segment.az;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) return { x: segment.ax, z: segment.az };
  let t = ((x - segment.ax) * dx + (z - segment.az) * dz) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return { x: segment.ax + dx * t, z: segment.az + dz * t };
}
