export type Rng = () => number;

/** Fast deterministic PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed = 0x5a7a9a): Rng {
  return mulberry32(seed);
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function pick<T>(rng: Rng, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length) % values.length];
}
