import * as THREE from 'three';
import Delaunator from 'delaunator';
import { makeRng, randRange, type Rng } from './rng';

export interface TextureOptions {
  srgb?: boolean;
  anisotropy?: number;
  wrap?: THREE.Wrapping;
  repeat?: THREE.Vector2;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function canvasTexture(
  canvas: HTMLCanvasElement,
  options: TextureOptions = {},
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = options.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.wrapS = options.wrap ?? THREE.ClampToEdgeWrapping;
  texture.wrapT = options.wrap ?? THREE.ClampToEdgeWrapping;
  texture.anisotropy = options.anisotropy ?? 8;
  if (options.repeat) texture.repeat.copy(options.repeat);
  texture.needsUpdate = true;
  return texture;
}

function hash2(x: number, y: number, seed: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface PavingTextures {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Large-format geometric paving inspired by the courtyard's triangulated stone.
 * Generated once at load; no runtime cost.
 */
export function makePavingTextures(
  width = 2048,
  height = 1536,
  seed = 4182,
): PavingTextures {
  const rng = makeRng(seed);
  const colorCanvas = createCanvas(width, height);
  const roughCanvas = createCanvas(width, height);
  const colorCtx = colorCanvas.getContext('2d')!;
  const roughCtx = roughCanvas.getContext('2d')!;

  colorCtx.fillStyle = '#382d24';
  colorCtx.fillRect(0, 0, width, height);
  roughCtx.fillStyle = '#f2f2f2';
  roughCtx.fillRect(0, 0, width, height);

  const points: number[] = [];
  const push = (x: number, y: number) => {
    points.push(Math.max(0, Math.min(width, x)), Math.max(0, Math.min(height, y)));
  };

  const edgeStep = 64;
  for (let x = 0; x <= width; x += edgeStep) {
    push(x, 0);
    push(x, height);
  }
  for (let y = 0; y <= height; y += edgeStep) {
    push(0, y);
    push(width, y);
  }

  const cols = 26;
  const rows = 19;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = ((col + 0.5) / cols) * width;
      const y = ((row + 0.5) / rows) * height;
      push(
        x + randRange(rng, -width / cols / 2.6, width / cols / 2.6),
        y + randRange(rng, -height / rows / 2.6, height / rows / 2.6),
      );
    }
  }
  for (let i = 0; i < 90; i += 1) push(randRange(rng, 0, width), randRange(rng, 0, height));

  const delaunay = new Delaunator(Float64Array.from(points));
  const triangles = delaunay.triangles;

  const palette = [
    '#a47a58',
    '#966b4c',
    '#b58f68',
    '#825c42',
    '#9c7656',
    '#6f6a61',
    '#867c6f',
    '#b3a084',
    '#795a43',
    '#997657',
    '#c0a17c',
    '#726b62',
  ];

  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i];
    const b = triangles[i + 1];
    const c = triangles[i + 2];
    const ax = points[a * 2];
    const ay = points[a * 2 + 1];
    const bx = points[b * 2];
    const by = points[b * 2 + 1];
    const cx = points[c * 2];
    const cy = points[c * 2 + 1];
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const colorIndex = Math.floor(hash2(Math.floor(mx / 40), Math.floor(my / 40), seed) * palette.length);
    const base = palette[colorIndex % palette.length];
    const inset = 0.988;
    const ix = (x: number, y: number) => mx + (x - mx) * inset;
    const iy = (x: number, y: number) => my + (y - my) * inset;

    colorCtx.beginPath();
    colorCtx.moveTo(ix(ax, ay), iy(ax, ay));
    colorCtx.lineTo(ix(bx, by), iy(bx, by));
    colorCtx.lineTo(ix(cx, cy), iy(cx, cy));
    colorCtx.closePath();
    colorCtx.fillStyle = base;
    colorCtx.fill();

    const rough = 0.62 + hash2(Math.floor(mx), Math.floor(my), seed + 9) * 0.24;
    roughCtx.beginPath();
    roughCtx.moveTo(ix(ax, ay), iy(ax, ay));
    roughCtx.lineTo(ix(bx, by), iy(bx, by));
    roughCtx.lineTo(ix(cx, cy), iy(cx, cy));
    roughCtx.closePath();
    roughCtx.fillStyle = `rgb(${Math.floor(rough * 255)}, ${Math.floor(rough * 255)}, ${Math.floor(rough * 255)})`;
    roughCtx.fill();
  }

  // Circular inlay at the centre of the plaza.
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.108;
  colorCtx.save();
  colorCtx.translate(cx, cy);
  colorCtx.fillStyle = '#5d4b3e';
  colorCtx.beginPath();
  colorCtx.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
  colorCtx.fill();
  const rings = [
    { r: 1.04, color: '#b39b7d' },
    { r: 0.96, color: '#795d47' },
    { r: 0.8, color: '#a88360' },
    { r: 0.56, color: '#7d604b' },
    { r: 0.34, color: '#b49d80' },
    { r: 0.18, color: '#765b46' },
  ];
  for (const ring of rings) {
    colorCtx.beginPath();
    colorCtx.arc(0, 0, radius * ring.r, 0, Math.PI * 2);
    colorCtx.fillStyle = ring.color;
    colorCtx.fill();
  }
  colorCtx.strokeStyle = 'rgba(74, 56, 42, 0.65)';
  colorCtx.lineWidth = 3;
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    colorCtx.beginPath();
    colorCtx.moveTo(Math.cos(angle) * radius * 0.18, Math.sin(angle) * radius * 0.18);
    colorCtx.lineTo(Math.cos(angle) * radius * 1.02, Math.sin(angle) * radius * 1.02);
    colorCtx.stroke();
  }
  colorCtx.restore();

  // Gentle stone variation and weathering.
  const noise = colorCtx.getImageData(0, 0, width, height);
  const data = noise.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * 10;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  colorCtx.putImageData(noise, 0, 0);

  const anisotropy = 8;
  const map = canvasTexture(colorCanvas, { anisotropy });
  const roughnessMap = canvasTexture(roughCanvas, { srgb: false, anisotropy });
  return { map, roughnessMap };
}

/** A cluster of leaves on a transparent background, used on crossed cards. */
export function makeLeafTexture(size = 512, seed = 7331): THREE.CanvasTexture {
  const rng = makeRng(seed);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const greens = ['#1e3a19', '#284a20', '#335a28', '#3e6b31', '#4a7a3a', '#578b45', '#669a50'];
  const clusters = 20;
  for (let cluster = 0; cluster < clusters; cluster += 1) {
    const angle = rng() * Math.PI * 2;
    const distance = rng() * size * 0.33;
    const cx = size / 2 + Math.cos(angle) * distance;
    const cy = size / 2 + Math.sin(angle) * distance * 0.82;
    const leaves = 18 + Math.floor(rng() * 10);
    for (let i = 0; i < leaves; i += 1) {
      const leafAngle = rng() * Math.PI * 2;
      const leafDistance = rng() * size * 0.1;
      const x = cx + Math.cos(leafAngle) * leafDistance;
      const y = cy + Math.sin(leafAngle) * leafDistance * 0.8;
      const rotation = rng() * Math.PI * 2;
      const length = size * (0.022 + rng() * 0.026);
      const width = length * (0.42 + rng() * 0.18);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = 0.82 + rng() * 0.18;

      // Leaf body: two mirrored quadratic curves.
      ctx.beginPath();
      ctx.moveTo(0, -length * 0.5);
      ctx.quadraticCurveTo(width * 0.62, 0, 0, length * 0.5);
      ctx.quadraticCurveTo(-width * 0.62, 0, 0, -length * 0.5);
      ctx.closePath();
      ctx.fillStyle = greens[Math.floor(rng() * greens.length)];
      ctx.fill();

      ctx.strokeStyle = 'rgba(22, 44, 18, 0.35)';
      ctx.lineWidth = Math.max(0.6, size * 0.0016);
      ctx.beginPath();
      ctx.moveTo(0, -length * 0.36);
      ctx.lineTo(0, length * 0.36);
      ctx.stroke();
      ctx.restore();
    }
  }

  // A few highlight leaves catch the sun.
  for (let i = 0; i < 22; i += 1) {
    ctx.save();
    ctx.translate(size * (0.2 + rng() * 0.6), size * (0.2 + rng() * 0.6));
    ctx.rotate(rng() * Math.PI * 2);
    ctx.globalAlpha = 0.4 + rng() * 0.28;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.014, size * 0.03, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#87b46a';
    ctx.fill();
    ctx.restore();
  }

  const texture = canvasTexture(canvas, { anisotropy: 8 });
  return texture;
}

/** Vertical vine curtain for the top of the brick wall. */
export function makeVineTexture(width = 256, height = 512, seed = 991): THREE.CanvasTexture {
  const rng = makeRng(seed);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);
  const greens = ['#34582b', '#456b35', '#537c3f', '#68934e', '#7da65e'];

  for (let strand = 0; strand < 9; strand += 1) {
    const baseX = width * (0.12 + (strand / 8) * 0.76) + randRange(rng, -10, 10);
    let x = baseX;
    let y = 0;
    const length = height * (0.55 + rng() * 0.4);
    while (y < length) {
      y += 18 + rng() * 20;
      x += randRange(rng, -8, 8);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(randRange(rng, -1.2, 1.2));
      ctx.globalAlpha = 0.7 + rng() * 0.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5 + rng() * 5, 9 + rng() * 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = greens[Math.floor(rng() * greens.length)];
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(54, 76, 38, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(baseX, 0);
    ctx.quadraticCurveTo(baseX + 20, height * 0.4, x, length);
    ctx.stroke();
  }

  return canvasTexture(canvas, { anisotropy: 8 });
}

export function makeBarkTexture(size = 256, seed = 4471): THREE.CanvasTexture {
  const rng = makeRng(seed);
  const canvas = createCanvas(size, size * 2);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5b402f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 90; i += 1) {
    const x = rng() * canvas.width;
    const y = rng() * canvas.height;
    const w = 1 + rng() * 5;
    const h = 20 + rng() * 90;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(38, 25, 18, 0.35)' : 'rgba(137, 101, 73, 0.25)';
    ctx.fillRect(x, y, w, h);
  }
  for (let i = 0; i < 24; i += 1) {
    ctx.fillStyle = 'rgba(30, 20, 14, 0.4)';
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size * 2, 2 + rng() * 5, 4 + rng() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(canvas, { wrap: THREE.RepeatWrapping, anisotropy: 4 });
}

export function makeRoofTexture(size = 512, seed = 881): THREE.CanvasTexture {
  const rng = makeRng(seed);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b7b0a4';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 7000; i += 1) {
    const v = Math.floor(155 + rng() * 55);
    ctx.fillStyle = `rgba(${v}, ${v - 3}, ${v - 9}, ${0.04 + rng() * 0.08})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }

  // Expansion joints read as roof panels from the overview.
  const step = 128;
  ctx.strokeStyle = 'rgba(104, 98, 90, 0.5)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = `rgba(120, 112, 102, ${0.03 + rng() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size, 12 + rng() * 40, 8 + rng() * 22, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = canvasTexture(canvas, { wrap: THREE.RepeatWrapping, anisotropy: 4 });
  texture.repeat.set(0.12, 0.12);
  return texture;
}

export function makeConcreteTexture(size = 512, seed = 227): THREE.CanvasTexture {
  const rng = makeRng(seed);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c9c1b4';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 9000; i += 1) {
    const v = Math.floor(150 + rng() * 80);
    ctx.fillStyle = `rgba(${v}, ${v - 4}, ${v - 10}, ${0.05 + rng() * 0.1})`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
  for (let i = 0; i < 14; i += 1) {
    ctx.strokeStyle = `rgba(100, 92, 82, ${0.06 + rng() * 0.08})`;
    ctx.lineWidth = 1 + rng() * 3;
    ctx.beginPath();
    ctx.moveTo(rng() * size, rng() * size);
    ctx.lineTo(rng() * size, rng() * size);
    ctx.stroke();
  }
  return canvasTexture(canvas, { wrap: THREE.RepeatWrapping, anisotropy: 4 });
}

export type InteriorVariant = 'warm' | 'cool' | 'green' | 'fashion' | 'lobby';

/** Blurred, luminous shop interior seen through the glass. */
export function makeInteriorTexture(variant: InteriorVariant, seed = 55): THREE.CanvasTexture {
  const rng = makeRng(seed + variant.length * 17);
  const width = 1024;
  const height = 512;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  const palettes: Record<InteriorVariant, { top: string; bottom: string; glow: string; accent: string }> = {
    warm: { top: '#1a1008', bottom: '#8a4d1f', glow: '#ffc57e', accent: '#d88a3f' },
    cool: { top: '#0d1416', bottom: '#475c60', glow: '#e9f6f4', accent: '#9fc9c4' },
    green: { top: '#10170d', bottom: '#43592d', glow: '#d7e7a8', accent: '#87a95a' },
    fashion: { top: '#160f12', bottom: '#6b4a50', glow: '#ffe1d4', accent: '#c9949d' },
    lobby: { top: '#5b3f2a', bottom: '#d69a5e', glow: '#fff0cf', accent: '#a96f42' },
  };
  const palette = palettes[variant];

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette.top);
  gradient.addColorStop(0.55, palette.bottom);
  gradient.addColorStop(1, palette.accent);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Ceiling light strip.
  ctx.fillStyle = palette.glow;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, height * 0.08, width, height * 0.035);
  ctx.globalAlpha = 1;

  // Back-wall panels and shelves.
  const panels = 7 + Math.floor(rng() * 4);
  for (let i = 0; i < panels; i += 1) {
    const x = (i / panels) * width;
    const w = width / panels - 8;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 235, 205, 0.14)' : 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(x + 4, height * 0.18, w, height * 0.58);
    if (rng() > 0.35) {
      ctx.fillStyle = palette.glow;
      ctx.globalAlpha = 0.35 + rng() * 0.3;
      ctx.fillRect(x + 18, height * (0.22 + rng() * 0.2), w - 36, 6 + rng() * 10);
      ctx.globalAlpha = 1;
    }
  }

  // Counters / display tables.
  for (let i = 0; i < 5; i += 1) {
    const x = rng() * width * 0.8;
    const y = height * (0.62 + rng() * 0.16);
    const w = 80 + rng() * 160;
    ctx.fillStyle = 'rgba(20, 15, 12, 0.55)';
    ctx.fillRect(x, y, w, 18 + rng() * 24);
    ctx.fillStyle = palette.glow;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x + 8, y - 4, w - 16, 4);
    ctx.globalAlpha = 1;
  }

  // Soft silhouettes.
  for (let i = 0; i < 7; i += 1) {
    const x = rng() * width;
    const y = height * (0.42 + rng() * 0.2);
    const h = height * (0.18 + rng() * 0.16);
    ctx.fillStyle = 'rgba(10, 8, 7, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, 14 + rng() * 12, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.filter = 'blur(5px)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  return canvasTexture(canvas, { anisotropy: 4 });
}

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
): void {
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, chars.length - 1);
  let cursor = x - total / 2;
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], cursor, y);
    cursor += widths[i] + spacing;
  }
}

export interface SignOptions {
  text: string;
  subtext?: string;
  width?: number;
  height?: number;
  color?: string;
  subColor?: string;
  font?: string;
  spacing?: number;
  mark?: boolean;
  markColor?: string;
  align?: 'center' | 'left';
}

export function makeSignTexture(options: SignOptions): THREE.CanvasTexture {
  const width = options.width ?? 2048;
  const height = options.height ?? 512;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);

  const color = options.color ?? '#f7f1e6';
  const subColor = options.subColor ?? color;
  const font = options.font ?? '600 ' + Math.floor(height * 0.36) + 'px "Cormorant Garamond", serif';
  const centerX = width / 2;

  if (options.mark) {
    const markColor = options.markColor ?? color;
    const cx = centerX;
    const cy = height * 0.24;
    const s = height * 0.14;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = markColor;
    ctx.lineWidth = Math.max(4, height * 0.022);
    ctx.lineCap = 'round';
    // Abstract leaf / bird mark.
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.55);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.8, s * 0.95, -s * 0.5);
    ctx.quadraticCurveTo(s * 0.2, s * 0.15, -s, s * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, s * 0.25);
    ctx.quadraticCurveTo(0, s * 0.05, s * 0.45, -s * 0.25);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textY = options.mark ? height * 0.64 : height * 0.5;
  drawSpacedText(ctx, options.text, centerX, textY, options.spacing ?? height * 0.02);

  if (options.subtext) {
    ctx.fillStyle = subColor;
    ctx.font = `400 ${Math.floor(height * 0.15)}px "Inter", sans-serif`;
    drawSpacedText(ctx, options.subtext, centerX, textY + height * 0.2, height * 0.035);
  }

  return canvasTexture(canvas, { anisotropy: 8 });
}

export function makeShopSignTexture(name: string, seed = 3): THREE.CanvasTexture {
  const width = 1024;
  const height = 192;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1e1a16';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(214, 195, 162, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, width - 20, height - 20);
  ctx.fillStyle = '#e9ddc8';
  ctx.font = '500 74px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawSpacedText(ctx, name.toUpperCase(), width / 2, height / 2 + 4, 8);
  return canvasTexture(canvas, { anisotropy: 4 });
}

/**
 * Hand-painted equirectangular sky. The HDRI is still used for environment
 * lighting; this gives a controlled, cinematic backdrop without a blown-out
 * horizon.
 */
export function makeSkyTexture(time: 'sunset' | 'day'): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const rng = makeRng(time === 'sunset' ? 0x5e7a : 0x2a19);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (time === 'sunset') {
    gradient.addColorStop(0, '#1b2b44');
    gradient.addColorStop(0.16, '#33445f');
    gradient.addColorStop(0.3, '#6f5a6b');
    gradient.addColorStop(0.4, '#a76d64');
    gradient.addColorStop(0.48, '#d18b68');
    gradient.addColorStop(0.53, '#f0b47d');
    gradient.addColorStop(0.58, '#c98d66');
    gradient.addColorStop(0.7, '#745b4b');
    gradient.addColorStop(1, '#3d322b');
  } else {
    gradient.addColorStop(0, '#1d4f86');
    gradient.addColorStop(0.16, '#3b75a9');
    gradient.addColorStop(0.32, '#6fa6cf');
    gradient.addColorStop(0.44, '#a9cbe4');
    gradient.addColorStop(0.5, '#dcebf5');
    gradient.addColorStop(0.56, '#b9cfda');
    gradient.addColorStop(0.72, '#7e9a9e');
    gradient.addColorStop(1, '#4d5a58');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Broad horizon glow.
  const glowX = time === 'sunset' ? width * 0.3 : width * 0.66;
  const glowY = height * 0.51;
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, width * 0.33);
  if (time === 'sunset') {
    glow.addColorStop(0, 'rgba(255, 224, 174, 0.68)');
    glow.addColorStop(0.2, 'rgba(255, 178, 116, 0.34)');
    glow.addColorStop(0.55, 'rgba(205, 113, 86, 0.1)');
    glow.addColorStop(1, 'rgba(90, 63, 70, 0)');
  } else {
    glow.addColorStop(0, 'rgba(255, 250, 225, 0.9)');
    glow.addColorStop(0.25, 'rgba(225, 242, 255, 0.35)');
    glow.addColorStop(1, 'rgba(150, 190, 215, 0)');
  }
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Layered soft clouds.
  const cloudPalettes =
    time === 'sunset'
      ? [
          ['rgba(62, 58, 76, 0.55)', 'rgba(119, 90, 105, 0.4)', 'rgba(224, 157, 133, 0.28)'],
          ['rgba(82, 72, 87, 0.4)', 'rgba(167, 113, 114, 0.32)', 'rgba(255, 196, 146, 0.22)'],
        ]
      : [
          ['rgba(255, 255, 255, 0.46)', 'rgba(228, 240, 249, 0.4)', 'rgba(183, 207, 225, 0.25)'],
          ['rgba(245, 250, 255, 0.34)', 'rgba(211, 229, 241, 0.28)', 'rgba(154, 184, 203, 0.2)'],
        ];

  ctx.save();
  ctx.filter = 'blur(18px)';
  for (let layer = 0; layer < 2; layer += 1) {
    const palette = cloudPalettes[layer];
    const count = 30;
    for (let i = 0; i < count; i += 1) {
      const x = rng() * width;
      const y = height * (0.08 + rng() * 0.34);
      const w = width * (0.04 + rng() * 0.13);
      const h = height * (0.014 + rng() * 0.04);
      ctx.globalAlpha = 0.65 + rng() * 0.35;
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, randRange(rng, -0.12, 0.12), 0, Math.PI * 2);
      ctx.fill();
      if (rng() > 0.4) {
        ctx.beginPath();
        ctx.ellipse(x + w * 0.42, y + h * 0.7, w * 0.55, h * 0.6, randRange(rng, -0.2, 0.2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Low band of clouds just above the horizon, visible from inside the courtyard.
  ctx.filter = 'blur(12px)';
  for (let i = 0; i < 22; i += 1) {
    const x = rng() * width;
    const y = height * (0.35 + rng() * 0.13);
    const w = width * (0.08 + rng() * 0.18);
    const h = height * (0.016 + rng() * 0.032);
    ctx.globalAlpha = 0.5 + rng() * 0.38;
    ctx.fillStyle =
      time === 'sunset'
        ? ['rgba(255, 205, 172, 0.82)', 'rgba(186, 116, 108, 0.72)', 'rgba(77, 61, 79, 0.66)'][i % 3]
        : ['rgba(255, 255, 255, 0.82)', 'rgba(215, 232, 244, 0.7)', 'rgba(140, 166, 184, 0.58)'][i % 3];
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, randRange(rng, -0.06, 0.06), 0, Math.PI * 2);
    ctx.fill();
    if (rng() > 0.6) {
      ctx.globalAlpha *= 0.7;
      ctx.beginPath();
      ctx.ellipse(x + w * 0.35, y - h * 0.5, w * 0.55, h * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Delicate high cirrus streaks.
  ctx.save();
  ctx.filter = 'blur(8px)';
  for (let i = 0; i < 18; i += 1) {
    const x = rng() * width;
    const y = height * (0.04 + rng() * 0.18);
    const w = width * (0.04 + rng() * 0.13);
    const h = 2 + rng() * 5;
    ctx.globalAlpha = 0.2 + rng() * 0.24;
    ctx.fillStyle = time === 'sunset' ? 'rgba(255, 213, 181, 0.55)' : 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, randRange(rng, -0.04, 0.04), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const texture = canvasTexture(canvas, { anisotropy: 8 });
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export function makeNoiseTexture(size = 256, seed = 17): THREE.CanvasTexture {
  const rng = makeRng(seed);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 90 + Math.floor(rng() * 120);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvasTexture(canvas, { srgb: false, wrap: THREE.RepeatWrapping, anisotropy: 4 });
}

export function makeRngForCanvas(seed: number): Rng {
  return makeRng(seed);
}
