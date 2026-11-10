import * as THREE from 'three';
import { ASSETS } from './config';
import {
  canvasTexture,
  makeBarkTexture,
  makeConcreteTexture,
  makeInteriorTexture,
  makeLeafTexture,
  makeRoofTexture,
  makeSignTexture,
  makeVineTexture,
  type InteriorVariant,
} from '../utils/canvas';

export interface MaterialLoadProgress {
  loaded: number;
  total: number;
  url: string;
}

function loadTexture(
  loader: THREE.TextureLoader,
  url: string,
  options: { srgb?: boolean; anisotropy?: number; repeat?: boolean } = {},
): Promise<THREE.Texture> {
  return loader.loadAsync(url).then((texture) => {
    texture.colorSpace = options.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.wrapS = options.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.wrapT = options.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.anisotropy = options.anisotropy ?? 8;
    texture.needsUpdate = true;
    return texture;
  });
}

export class Materials {
  brick!: THREE.MeshStandardMaterial;
  brickDark!: THREE.MeshStandardMaterial;
  stone!: THREE.MeshStandardMaterial;
  concrete!: THREE.MeshStandardMaterial;
  roof!: THREE.MeshStandardMaterial;
  metal!: THREE.MeshStandardMaterial;
  metalLight!: THREE.MeshStandardMaterial;
  glass!: THREE.MeshStandardMaterial;
  glassAtrium!: THREE.MeshStandardMaterial;
  glassDark!: THREE.MeshStandardMaterial;
  wood!: THREE.MeshStandardMaterial;
  soil!: THREE.MeshStandardMaterial;
  foliage!: THREE.MeshStandardMaterial;
  shrub!: THREE.MeshStandardMaterial;
  vine!: THREE.MeshStandardMaterial;
  foliageDepth!: THREE.MeshDepthMaterial;
  vineDepth!: THREE.MeshDepthMaterial;
  bark!: THREE.MeshStandardMaterial;
  lamp!: THREE.MeshBasicMaterial;
  interior: Record<InteriorVariant, THREE.MeshBasicMaterial> = {} as never;
  signMain!: THREE.MeshBasicMaterial;
  signCourtyard!: THREE.MeshBasicMaterial;
  signDowntown!: THREE.MeshBasicMaterial;
  shopSigns: THREE.MeshBasicMaterial[] = [];
  leafTexture!: THREE.CanvasTexture;
  vineTexture!: THREE.CanvasTexture;

  static async load(
    renderer: THREE.WebGLRenderer,
    manager: THREE.LoadingManager,
    onProgress?: (progress: MaterialLoadProgress) => void,
  ): Promise<Materials> {
    const materials = new Materials();
    const loader = new THREE.TextureLoader(manager);
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    void onProgress;
    const [diffuse, normal, roughness, ao] = await Promise.all([
      loadTexture(loader, ASSETS.brickDiffuse, { srgb: true, anisotropy, repeat: true }),
      loadTexture(loader, ASSETS.brickNormal, { srgb: false, anisotropy, repeat: true }),
      loadTexture(loader, ASSETS.brickRoughness, { srgb: false, anisotropy, repeat: true }),
      loadTexture(loader, ASSETS.brickAo, { srgb: false, anisotropy, repeat: true }),
    ]);

    materials.brick = new THREE.MeshStandardMaterial({
      map: diffuse,
      normalMap: normal,
      roughnessMap: roughness,
      aoMap: ao,
      aoMapIntensity: 0.85,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 1,
      metalness: 0,
    });
    materials.brickDark = materials.brick.clone();
    materials.brickDark.color.set(0x7d5a48);
    materials.brickDark.aoMapIntensity = 1;

    const concreteTexture = makeConcreteTexture();
    materials.stone = new THREE.MeshStandardMaterial({
      map: concreteTexture,
      bumpMap: concreteTexture,
      bumpScale: 0.008,
      color: 0xd8cbb8,
      roughness: 0.84,
      metalness: 0.02,
    });
    materials.concrete = new THREE.MeshStandardMaterial({
      map: concreteTexture,
      bumpMap: concreteTexture,
      bumpScale: 0.006,
      color: 0xd2ccc0,
      roughness: 0.9,
      metalness: 0.02,
    });
    const roofTexture = makeRoofTexture();
    materials.roof = new THREE.MeshStandardMaterial({
      map: roofTexture,
      bumpMap: roofTexture,
      bumpScale: 0.008,
      color: 0xd0c9bd,
      roughness: 0.92,
      metalness: 0.02,
    });
    materials.metal = new THREE.MeshStandardMaterial({
      color: 0x2a2623,
      roughness: 0.33,
      metalness: 0.82,
    });
    materials.metalLight = new THREE.MeshStandardMaterial({
      color: 0x6f6861,
      roughness: 0.42,
      metalness: 0.7,
    });
    materials.glass = new THREE.MeshStandardMaterial({
      color: 0x9fc3bf,
      transparent: true,
      opacity: 0.26,
      roughness: 0.06,
      metalness: 0.0,
      envMapIntensity: 2.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.glassAtrium = new THREE.MeshStandardMaterial({
      color: 0x9fc4bf,
      transparent: true,
      opacity: 0.4,
      roughness: 0.05,
      metalness: 0.06,
      envMapIntensity: 2.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.glassDark = new THREE.MeshStandardMaterial({
      color: 0x54706e,
      transparent: true,
      opacity: 0.38,
      roughness: 0.08,
      metalness: 0.0,
      envMapIntensity: 1.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.wood = new THREE.MeshStandardMaterial({
      color: 0x8a5a38,
      roughness: 0.78,
      metalness: 0.0,
    });
    materials.soil = new THREE.MeshStandardMaterial({
      color: 0x3b2a1c,
      roughness: 1,
    });

    const leaf = makeLeafTexture();
    const vine = makeVineTexture();
    materials.leafTexture = leaf;
    materials.vineTexture = vine;
    materials.foliage = new THREE.MeshStandardMaterial({
      map: leaf,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
      color: 0xffffff,
    });
    materials.shrub = new THREE.MeshStandardMaterial({
      color: 0x3f5a32,
      roughness: 1,
      metalness: 0,
    });
    materials.vine = new THREE.MeshStandardMaterial({
      map: vine,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
      color: 0xffffff,
    });
    materials.foliageDepth = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: leaf,
      alphaTest: 0.42,
    });
    materials.vineDepth = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: vine,
      alphaTest: 0.38,
    });

    const barkTexture = makeBarkTexture();
    materials.bark = new THREE.MeshStandardMaterial({
      map: barkTexture,
      color: 0x9a7a62,
      roughness: 1,
      metalness: 0,
    });
    materials.lamp = new THREE.MeshBasicMaterial({ color: 0xffd9a2, toneMapped: true });

    const variants: InteriorVariant[] = ['warm', 'cool', 'green', 'fashion', 'lobby'];
    for (const variant of variants) {
      materials.interior[variant] = new THREE.MeshBasicMaterial({
        map: makeInteriorTexture(variant),
        toneMapped: true,
      });
    }

    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('600 120px "Cormorant Garamond"'),
      document.fonts.load('500 60px "Inter"'),
      document.fonts.load('400 40px "Inter"'),
    ]);

    materials.signMain = new THREE.MeshBasicMaterial({
      map: makeSignTexture({
        text: 'SUMMARECON MALL',
        mark: true,
        color: '#f6efe3',
        font: '600 190px "Cormorant Garamond", serif',
        spacing: 12,
        width: 2048,
        height: 512,
      }),
      transparent: true,
      depthWrite: false,
      toneMapped: true,
    });
    materials.signCourtyard = new THREE.MeshBasicMaterial({
      map: makeSignTexture({
        text: 'SAWARGA',
        subtext: 'COURTYARD',
        color: '#f0e3c8',
        subColor: '#b7c99a',
        font: '600 200px "Cormorant Garamond", serif',
        spacing: 16,
        width: 2048,
        height: 768,
      }),
      transparent: true,
      depthWrite: false,
      toneMapped: true,
    });
    materials.signDowntown = new THREE.MeshBasicMaterial({
      map: makeSignTexture({
        text: 'DOWNTOWN WALK',
        color: '#f3ead9',
        font: '500 84px "Inter", sans-serif',
        spacing: 12,
        width: 1024,
        height: 256,
      }),
      transparent: true,
      depthWrite: false,
      toneMapped: true,
    });

    const shopNames = ['SAWARGA', 'KOPI BAIK', 'TOKO', 'SELATAN', 'BUMI'];
    materials.shopSigns = shopNames.map((name, index) => {
      const texture = makeSignTexture({
        text: name,
        color: '#e9ddc8',
        font: '500 96px "Cormorant Garamond", serif',
        spacing: 12,
        width: 1024,
        height: 256,
      });
      void index;
      return new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: true,
      });
    });

    return materials;
  }
}
