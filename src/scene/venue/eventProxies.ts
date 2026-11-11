import * as THREE from 'three';
import { CATEGORY_COLORS, VENUE_SEATS, VENUE_WORLD } from './layout';
import type { Materials } from '../materials';
import { canvasTexture, createCanvas } from '../../utils/canvas';
import { makeSignTexture } from '../../utils/canvas';

function makeBoardTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(1024, 512);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0b0912';
  ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = 'rgba(245,197,66,0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 1008, 496);

  ctx.fillStyle = '#f5c542';
  ctx.font = '600 22px "Inter", sans-serif';
  ctx.fillText('PATAKA · LIVE', 42, 58);

  ctx.fillStyle = '#f4f1ff';
  ctx.font = '600 46px "Cormorant Garamond", serif';
  ctx.fillText('CLOSING NIGHT', 42, 126);

  ctx.fillStyle = 'rgba(244,241,255,0.7)';
  ctx.font = '400 22px "Inter", sans-serif';
  ctx.fillText('Sawarga Courtyard · Summarecon Mall Bandung', 42, 168);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(42, 196, 940, 2);

  const rows = [
    ['VIP', '48 seats', '#f5c542'],
    ['CAT 1', '128 seats', '#9b7bff'],
    ['TRIBUNE', '120 seats', '#38bdf8'],
    ['REGULAR', '150 seats', '#2dd4bf'],
  ];
  rows.forEach(([name, count, color], index) => {
    const y = 254 + index * 58;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(56, y - 8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f1ff';
    ctx.font = '600 26px "Inter", sans-serif';
    ctx.fillText(name, 84, y);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '400 23px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(count, 984, y);
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = 'rgba(245,197,66,0.7)';
  ctx.font = '500 18px "Inter", sans-serif';
  ctx.fillText('TAP TO EXPLORE', 42, 492);
  return canvasTexture(canvas, { anisotropy: 8 });
}

function makeBoothSignTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(512, 160);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0b0912';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = 'rgba(245,197,66,0.7)';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 148);
  ctx.fillStyle = '#f5c542';
  ctx.textAlign = 'center';
  ctx.font = '700 46px "Inter", sans-serif';
  ctx.fillText('TIKET · TICKETS', 256, 98);
  ctx.textAlign = 'left';
  return canvasTexture(canvas, { anisotropy: 8 });
}

function makeStagePanelTexture(colors: [string, string, string]): THREE.CanvasTexture {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.55, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, Math.random() * 512, 512, 1 + Math.random() * 3);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, 512, 24);
  ctx.fillRect(0, 488, 512, 24);
  return canvasTexture(canvas, { anisotropy: 4 });
}

function buildStage(materials: Materials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'venue-stage-proxy';

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(26, 1.4, 9),
    new THREE.MeshStandardMaterial({ color: 0x171020, roughness: 0.5, metalness: 0.28 }),
  );
  deck.position.set(0, 0.7, -13);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const backdrop = new THREE.Mesh(
    new THREE.BoxGeometry(28, 9.2, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x0a0811, roughness: 0.9, metalness: 0.05 }),
  );
  backdrop.position.set(0, 4.6, -17.8);
  backdrop.castShadow = true;
  backdrop.receiveShadow = true;
  group.add(backdrop);

  const panelTextures = [
    makeStagePanelTexture(['#2b1b4d', '#7c5cff', '#1b1233']),
    makeStagePanelTexture(['#4b3510', '#f5c542', '#241a10']),
    makeStagePanelTexture(['#102b3d', '#38bdf8', '#101a2b']),
  ];
  [-6, 0, 6].forEach((x, index) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 6.4),
      new THREE.MeshBasicMaterial({ map: panelTextures[index], toneMapped: false }),
    );
    panel.position.set(x, 4.4, -17.57);
    group.add(panel);
  });

  const trussMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2438,
    metalness: 0.8,
    roughness: 0.3,
  });
  const truss = new THREE.Mesh(new THREE.BoxGeometry(28, 0.35, 0.35), trussMaterial);
  truss.position.set(0, 8.6, -11.5);
  truss.castShadow = true;
  group.add(truss);
  for (const x of [-13, 13]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 8.6, 8), trussMaterial);
    column.position.set(x, 4.3, -11.5);
    column.castShadow = true;
    group.add(column);
  }

  const ledStrip = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xf5c542, toneMapped: false }),
  );
  ledStrip.position.set(0, 1.45, -8.54);
  group.add(ledStrip);

  // Front step.
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.35, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x20182d, roughness: 0.6, metalness: 0.2 }),
  );
  step.position.set(0, 0.175, -8.1);
  step.receiveShadow = true;
  group.add(step);

  group.userData.layoutProxy = true;
  return group;
}

function buildBoard(): THREE.Group {
  const group = new THREE.Group();
  const data = VENUE_WORLD.southEdge.board;
  group.position.set(data.x, 0, data.z);
  group.rotation.y = data.rotationY;
  group.name = 'venue-board-proxy';

  const texture = makeBoardTexture();
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 3.0, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x0c0a14, roughness: 0.8, metalness: 0.1 }),
  );
  backing.position.set(0, 2.0, -0.06);
  backing.castShadow = true;
  group.add(backing);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 2.7),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  screen.position.set(0, 2.0, 0.02);
  group.add(screen);

  for (const x of [-2.3, 2.3]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2438, metalness: 0.6, roughness: 0.4 }),
    );
    post.position.set(x, 0.6, 0);
    post.castShadow = true;
    group.add(post);
  }
  group.userData.layoutProxy = true;
  return group;
}

function buildBooth(): THREE.Group {
  const group = new THREE.Group();
  const data = VENUE_WORLD.southEdge.booth;
  group.position.set(data.x, 0, data.z);
  group.rotation.y = data.rotationY;
  group.name = 'venue-booth-proxy';

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.1, 1),
    new THREE.MeshStandardMaterial({ color: 0x1a1426, roughness: 0.5, metalness: 0.3 }),
  );
  counter.position.set(0, 0.55, 0);
  counter.castShadow = true;
  group.add(counter);

  for (const x of [-1.2, 1.2]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 2.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2438, metalness: 0.7, roughness: 0.35 }),
    );
    post.position.set(x, 1.15, 0);
    post.castShadow = true;
    group.add(post);
  }

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.18, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x1a1426, roughness: 0.55, metalness: 0.3 }),
  );
  roof.position.set(0, 2.3, 0);
  roof.castShadow = true;
  group.add(roof);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.62),
    new THREE.MeshBasicMaterial({ map: makeBoothSignTexture(), toneMapped: false }),
  );
  sign.position.set(0, 2.3, 0.92);
  group.add(sign);

  const frontLight = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xf5c542, toneMapped: false, transparent: true, opacity: 0.85 }),
  );
  frontLight.position.set(0, 0.62, 0.52);
  group.add(frontLight);
  group.userData.layoutProxy = true;
  return group;
}

function buildSeatProxies(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'venue-seat-proxies';
  const count = VENUE_SEATS.length;

  const padGeometry = new THREE.BoxGeometry(0.78, 0.24, 0.78);
  const backGeometry = new THREE.BoxGeometry(0.78, 0.4, 0.14);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.15,
  });
  const pads = new THREE.InstancedMesh(padGeometry, material, count);
  const backs = new THREE.InstancedMesh(backGeometry, material.clone(), count);
  pads.castShadow = false;
  pads.receiveShadow = false;
  backs.castShadow = false;
  backs.receiveShadow = false;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  VENUE_SEATS.forEach((seat, index) => {
    dummy.position.set(seat.x, seat.y + 0.55, seat.z);
    dummy.rotation.set(0, seat.rotationY, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    pads.setMatrixAt(index, dummy.matrix);

    dummy.position.set(
      seat.x + Math.sin(seat.rotationY) * 0.42,
      seat.y + 0.78,
      seat.z + Math.cos(seat.rotationY) * 0.42,
    );
    dummy.updateMatrix();
    backs.setMatrixAt(index, dummy.matrix);

    color.setHex(CATEGORY_COLORS[seat.categoryKey]);
    pads.setColorAt(index, color);
    backs.setColorAt(index, color);
  });
  pads.instanceMatrix.needsUpdate = true;
  backs.instanceMatrix.needsUpdate = true;
  if (pads.instanceColor) pads.instanceColor.needsUpdate = true;
  if (backs.instanceColor) backs.instanceColor.needsUpdate = true;
  pads.computeBoundingSphere();
  backs.computeBoundingSphere();
  pads.userData.layoutProxy = true;
  backs.userData.layoutProxy = true;
  group.add(pads, backs);
  return group;
}

export interface EventProxyResult {
  group: THREE.Group;
  seatCount: number;
}

/** Lightweight stand-ins for the ticketing project's real event components. */
export function buildEventProxies(materials: Materials): EventProxyResult {
  const group = new THREE.Group();
  group.name = 'venue-event-proxies';
  group.userData.layoutProxy = true;

  group.add(buildStage(materials));
  group.add(buildBoard());
  group.add(buildBooth());
  group.add(buildSeatProxies());

  return { group, seatCount: VENUE_SEATS.length };
}

void makeSignTexture;
