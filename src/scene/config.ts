export const WORLD = {
  /** Courtyard inner boundary (ellipse). */
  radiusX: 35,
  radiusZ: 25,
  /** How far the facade body extends away from the courtyard. */
  facadeDepth: 4.6,
  /** Ground floor / balcony level. */
  groundFloor: 5.2,
  /** Upper floor top (before parapet). */
  upperFloor: 9.6,
  /** Mall parapet top. */
  mallTop: 11.2,
  /** Hero event wall height. */
  heroWallHeight: 13.6,
  wallThickness: 0.8,
  /** Player collision radius. */
  playerRadius: 0.38,
  eyeHeight: 1.68,
} as const;

export const ANGLES = {
  cibadak: Math.PI * 0.25,
  south: Math.PI * 0.5,
  ciunik: Math.PI * 0.75,
  downtown: Math.PI * 1.08,
  hero: Math.PI * 1.42,
  cileutik: Math.PI * 1.77,
  east: 0,
} as const;

export const COLORS = {
  fogSunset: 0xd8a273,
  fogDay: 0xbfd4e2,
  sunSunset: 0xffc184,
  sunDay: 0xfff1d8,
  skySunset: 0xffd7a8,
  skyDay: 0xdcecf7,
  groundSunset: 0x5a3f2d,
  groundDay: 0x6c6657,
  stone: 0xd3c4ad,
  concrete: 0xc9c1b4,
  metal: 0x2b2724,
  glass: 0xb7d2d1,
  glassDark: 0x5d7a78,
  leaf: 0xffffff,
  bark: 0x5d4130,
  wood: 0x8a5a38,
  roof: 0xcfc9bd,
  distant: 0xb7b0a5,
} as const;

export type QualityLevel = 'auto' | 'low' | 'medium' | 'high';
export type TimeOfDay = 'sunset' | 'day';
export type CameraMode = 'walk' | 'fly' | 'orbit';
export type PresetName = 'plaza' | 'balcony' | 'overview';

export const QUALITY = {
  low: { pixelRatio: 1.25, shadowMap: 1024, shadows: true, envIntensity: 0.36 },
  medium: { pixelRatio: 1.25, shadowMap: 1024, shadows: true, envIntensity: 0.46 },
  high: { pixelRatio: 1.5, shadowMap: 2048, shadows: true, envIntensity: 0.58 },
} as const;

export const ASSETS = {
  hdriSunset: '/assets/hdri/belfast_sunset_puresky_2k.hdr',
  hdriDay: '/assets/hdri/kloppenheim_06_puresky_2k.hdr',
  brickDiffuse: '/assets/textures/red_brick/red_brick_diff_2k.jpg',
  brickNormal: '/assets/textures/red_brick/red_brick_nor_gl_2k.jpg',
  brickRoughness: '/assets/textures/red_brick/red_brick_rough_2k.jpg',
  brickAo: '/assets/textures/red_brick/red_brick_ao_2k.jpg',
} as const;

export const BRICK_TILE_METERS = 3.4;
export const PAVING_WIDTH = 82;
export const PAVING_DEPTH = 62;
