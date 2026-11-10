import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { ANGLES, ASSETS, QUALITY, WORLD, type QualityLevel, type TimeOfDay } from './config';
import { ellipsePoint } from '../utils/geometry';
import { makeSkyTexture } from '../utils/canvas';

export interface EnvironmentMaps {
  background: THREE.Texture;
  environment: THREE.Texture;
}

interface TimeState {
  sunColor: THREE.Color;
  sunIntensity: number;
  sunPosition: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  fogColor: THREE.Color;
  fogDensity: number;
  exposure: number;
}

function state(
  sunColor: number,
  sunIntensity: number,
  sunPosition: [number, number, number],
  hemiSky: number,
  hemiGround: number,
  hemiIntensity: number,
  fogColor: number,
  fogDensity: number,
  exposure: number,
): TimeState {
  return {
    sunColor: new THREE.Color(sunColor),
    sunIntensity,
    sunPosition: new THREE.Vector3(...sunPosition),
    hemiSky: new THREE.Color(hemiSky),
    hemiGround: new THREE.Color(hemiGround),
    hemiIntensity,
    fogColor: new THREE.Color(fogColor),
    fogDensity,
    exposure,
  };
}

const SUNSET_STATE = state(
  0xffb877,
  4.8,
  [-55, 24, 35],
  0xffd2a8,
  0x5a3f2d,
  0.3,
  0xd7a37c,
  0.0027,
  1.0,
);

const DAY_STATE = state(
  0xfff1d8,
  5.2,
  [-46, 64, 24],
  0xcfe4f4,
  0x6c6657,
  0.36,
  0xc7dce8,
  0.00165,
  0.96,
);

export class Lighting {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly fill: THREE.DirectionalLight;
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly pointLights: THREE.PointLight[] = [];
  private sunsetMaps?: EnvironmentMaps;
  private dayMaps?: EnvironmentMaps;
  private current: TimeState;
  private from: TimeState;
  private to: TimeState;
  private blend = 1;
  private timeOfDay: TimeOfDay = 'sunset';
  private quality: QualityLevel = 'medium';

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.sun = new THREE.DirectionalLight(0xffc184, 3.4);
    this.sun.position.set(-62, 20, -58);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -72;
    this.sun.shadow.camera.right = 72;
    this.sun.shadow.camera.top = 72;
    this.sun.shadow.camera.bottom = -72;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.025;
    this.sun.target.position.set(0, 2, 0);
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xffd7ad, 0x5a3f2d, 0.24);
    scene.add(this.hemi);

    this.fill = new THREE.DirectionalLight(0xffd9b8, 0.55);
    this.fill.position.set(-35, 26, -48);
    this.fill.castShadow = false;
    scene.add(this.fill);

    this.current = SUNSET_STATE;
    this.from = SUNSET_STATE;
    this.to = SUNSET_STATE;

    // Four warm practicals: three atrium interiors + the south canopy.
    const atriumAngles = [ANGLES.ciunik, ANGLES.cibadak, ANGLES.cileutik];
    for (const angle of atriumAngles) {
      const point = ellipsePoint(WORLD.radiusX - 3, WORLD.radiusZ - 3, angle);
      const light = new THREE.PointLight(0xffb877, 55, 20, 2);
      light.position.set(point.x, 5.4, point.z);
      light.castShadow = false;
      scene.add(light);
      this.pointLights.push(light);
    }
  }

  async load(manager: THREE.LoadingManager): Promise<void> {
    const loader = new HDRLoader(manager);
    const [sunsetHdr, dayHdr] = await Promise.all([
      loader.loadAsync(ASSETS.hdriSunset),
      loader.loadAsync(ASSETS.hdriDay),
    ]);
    sunsetHdr.mapping = THREE.EquirectangularReflectionMapping;
    dayHdr.mapping = THREE.EquirectangularReflectionMapping;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.sunsetMaps = {
      background: makeSkyTexture('sunset'),
      environment: pmrem.fromEquirectangular(sunsetHdr).texture,
    };
    this.dayMaps = {
      background: makeSkyTexture('day'),
      environment: pmrem.fromEquirectangular(dayHdr).texture,
    };
    pmrem.dispose();
    sunsetHdr.dispose();
    dayHdr.dispose();

    this.scene.backgroundRotation.set(0, 0, 0);
    this.scene.environmentRotation.set(0, Math.PI * 0.75, 0);
    this.setTimeOfDay('sunset', true);
  }

  setTimeOfDay(time: TimeOfDay, immediate = false): void {
    this.timeOfDay = time;
    const maps = time === 'sunset' ? this.sunsetMaps : this.dayMaps;
    if (maps) {
      this.scene.background = maps.background;
      this.scene.environment = maps.environment;
    }
    this.from = this.capture();
    this.to = time === 'sunset' ? SUNSET_STATE : DAY_STATE;
    this.blend = immediate ? 1 : 0;
    for (const light of this.pointLights) {
      light.intensity = time === 'sunset' ? 55 : 18;
    }
    this.fill.intensity = time === 'sunset' ? 0.75 : 0.55;
    if (immediate) this.apply(this.to);
    this.renderer.shadowMap.needsUpdate = true;
  }

  getTimeOfDay(): TimeOfDay {
    return this.timeOfDay;
  }

  setQuality(level: QualityLevel): void {
    this.quality = level;
    const actual = level === 'auto' ? 'medium' : level;
    const settings = QUALITY[actual];
    this.scene.environmentIntensity = settings.envIntensity;
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.shadow.mapSize.set(settings.shadowMap, settings.shadowMap);
    this.sun.castShadow = settings.shadows;
    this.renderer.shadowMap.needsUpdate = true;
  }

  getQuality(): QualityLevel {
    return this.quality;
  }

  update(dt: number): void {
    if (this.blend >= 1) return;
    this.blend = Math.min(1, this.blend + dt / 0.85);
    const t = this.blend * this.blend * (3 - 2 * this.blend);
    this.current = {
      sunColor: this.from.sunColor.clone().lerp(this.to.sunColor, t),
      sunIntensity: THREE.MathUtils.lerp(this.from.sunIntensity, this.to.sunIntensity, t),
      sunPosition: this.from.sunPosition.clone().lerp(this.to.sunPosition, t),
      hemiSky: this.from.hemiSky.clone().lerp(this.to.hemiSky, t),
      hemiGround: this.from.hemiGround.clone().lerp(this.to.hemiGround, t),
      hemiIntensity: THREE.MathUtils.lerp(this.from.hemiIntensity, this.to.hemiIntensity, t),
      fogColor: this.from.fogColor.clone().lerp(this.to.fogColor, t),
      fogDensity: THREE.MathUtils.lerp(this.from.fogDensity, this.to.fogDensity, t),
      exposure: THREE.MathUtils.lerp(this.from.exposure, this.to.exposure, t),
    };
    this.apply(this.current);
    if (this.blend >= 1) this.renderer.shadowMap.needsUpdate = true;
  }

  private capture(): TimeState {
    return {
      sunColor: this.sun.color.clone(),
      sunIntensity: this.sun.intensity,
      sunPosition: this.sun.position.clone(),
      hemiSky: this.hemi.color.clone(),
      hemiGround: this.hemi.groundColor.clone(),
      hemiIntensity: this.hemi.intensity,
      fogColor: this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.color.clone() : new THREE.Color(0xffffff),
      fogDensity: this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.density : 0,
      exposure: this.renderer.toneMappingExposure,
    };
  }

  private apply(stateToApply: TimeState): void {
    this.sun.color.copy(stateToApply.sunColor);
    this.sun.intensity = stateToApply.sunIntensity;
    this.sun.position.copy(stateToApply.sunPosition);
    this.hemi.color.copy(stateToApply.hemiSky);
    this.hemi.groundColor.copy(stateToApply.hemiGround);
    this.hemi.intensity = stateToApply.hemiIntensity;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(stateToApply.fogColor);
      this.scene.fog.density = stateToApply.fogDensity;
    } else {
      this.scene.fog = new THREE.FogExp2(stateToApply.fogColor.getHex(), stateToApply.fogDensity);
    }
    this.renderer.toneMappingExposure = stateToApply.exposure;
    this.current = stateToApply;
  }

  dispose(): void {
    for (const light of this.pointLights) {
      this.scene.remove(light);
      light.dispose();
    }
    this.sun.dispose();
    this.hemi.dispose();
    this.fill.dispose();
    this.sunsetMaps?.background.dispose();
    this.sunsetMaps?.environment.dispose();
    this.dayMaps?.background.dispose();
    this.dayMaps?.environment.dispose();
  }

  get qualityLevel(): QualityLevel {
    return this.quality;
  }
}
