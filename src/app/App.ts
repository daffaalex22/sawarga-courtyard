import * as THREE from 'three';
import { QUALITY, type PresetName, type QualityLevel, type TimeOfDay } from '../scene/config';
import { Materials } from '../scene/materials';
import { Lighting } from '../scene/lighting';
import { buildPaving } from '../scene/paving';
import { buildFacades } from '../scene/facades';
import { buildLandscape } from '../scene/landscape';
import { buildContext } from '../scene/context';
import { buildBranding } from '../scene/branding';
import { CollisionWorld } from '../controls/CollisionWorld';
import { CameraRig } from '../controls/CameraRig';
import { UI } from '../ui/UI';

type EffectiveQuality = 'low' | 'medium' | 'high';

interface DebugHooks {
  app: App;
  setState: (name: string) => Promise<{ state: string }>;
  setPausedForScreenshot: (paused: boolean) => void;
  seed: (seed: number) => { seed: number };
}

declare global {
  interface Window {
    __COURTYARD__?: DebugHooks;
    __THREE_GAME_TEST_HOOKS__?: {
      setState: (name: string) => Promise<{ state: string }>;
      setPausedForScreenshot: (paused: boolean) => void;
      seed: (seed: number) => { seed: number };
    };
  }
}

function nextFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export class App {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private ui!: UI;
  private materials!: Materials;
  private lighting!: Lighting;
  private rig!: CameraRig;
  private collision!: CollisionWorld;
  private timer!: THREE.Timer;

  private quality: QualityLevel = 'auto';
  private effectiveQuality: EffectiveQuality = 'medium';
  private time: TimeOfDay = 'sunset';
  private paused = false;
  private debugEnabled = false;
  private autoReduced = false;

  private frameAccumulator = 0;
  private frameCount = 0;
  private debugAccumulator = 0;
  private debugFrames = 0;
  private fps = 0;
  private shadowFrames = 0;

  async init(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const isTouch = params.get('mobile') === '1' ||
      (window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);
    this.quality = (params.get('quality') as QualityLevel) ?? 'auto';
    if (!['auto', 'low', 'medium', 'high'].includes(this.quality)) this.quality = 'auto';
    this.time = params.get('time') === 'day' ? 'day' : 'sunset';
    this.debugEnabled = params.has('debug');
    this.effectiveQuality = this.quality === 'auto' ? (isTouch ? 'low' : 'medium') : (this.quality as EffectiveQuality);

    const canvas = document.querySelector<HTMLCanvasElement>('#scene');
    if (!canvas) throw new Error('Canvas #scene not found');

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[this.effectiveQuality].pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x17110d);
    this.scene.fog = new THREE.FogExp2(0xd8a273, 0.00235);

    this.camera = new THREE.PerspectiveCamera(
      this.cameraFov(),
      window.innerWidth / window.innerHeight,
      0.1,
      900,
    );
    this.camera.rotation.order = 'YXZ';

    this.ui = new UI({
      onTimeToggle: () => this.toggleTime(),
      onQualityChange: (level) => this.setQuality(level),
      onReset: () => this.rig?.reset(),
      onPreset: (preset) => this.rig?.setPreset(preset),
      onFlyToggle: () => this.rig?.toggleFly(),
      onVertical: (value) => this.rig?.setTouchVertical(value),
      onHelp: () => undefined,
    });
    this.ui.setProgress(0.04, 'Loading sky and materials');
    this.ui.setQuality(this.quality);
    this.ui.setTime(this.time);

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      const progress = 0.05 + (loaded / Math.max(1, total)) * 0.55;
      this.ui.setProgress(Math.min(0.62, progress), 'Loading sky and materials');
    };

    try {
      this.lighting = new Lighting(this.scene, this.renderer);
      const materialsPromise = Materials.load(this.renderer, manager);
      const lightingPromise = this.lighting.load(manager);
      this.materials = await materialsPromise;
      await lightingPromise;
      this.ui.setProgress(0.66, 'Building the courtyard');

      this.collision = new CollisionWorld();

      const paving = buildPaving(this.materials, this.effectiveQuality);
      this.scene.add(paving.group);
      this.ui.setProgress(0.73, 'Raising the facades');

      const facades = buildFacades(this.materials);
      this.scene.add(facades.group);
      this.ui.setProgress(0.84, 'Planting the courtyard');

      const landscape = buildLandscape(this.materials, this.collision);
      this.scene.add(landscape.group);
      this.ui.setProgress(0.9, 'Adding the skyline');

      const context = buildContext(this.materials);
      this.scene.add(context);
      this.scene.add(buildBranding(this.materials, facades.anchors));
      for (const column of facades.portalColumns) {
        this.collision.addCircle(column.x, column.z, column.radius);
      }

      this.ui.setProgress(0.95, 'Preparing the light');
      this.lighting.setQuality(this.effectiveQuality);
      this.lighting.setTimeOfDay(this.time, true);
      this.ui.setTime(this.time);

      this.rig = new CameraRig(
        this.camera,
        this.renderer.domElement,
        this.collision,
        {
          onLockChange: (locked) => this.ui.setLocked(locked),
          onModeChange: (mode) => this.ui.setMode(mode),
          onPresetChange: (preset) => this.ui.setPreset(preset),
          onJoystick: (visible, x, y, dx, dy) => this.ui.showJoystick(visible, x, y, dx, dy),
          onFlyChange: (flying) => this.ui.setFlying(flying),
          onHelp: () => this.ui.openHelp(),
          isBlocked: () => this.ui.isHelpOpen,
        },
        isTouch,
      );
      this.rig.setEnabled(false);
      this.rig.setPreset('plaza', true);
      this.ui.setMobileVisible(this.rig.touch);
      this.ui.setMode(this.rig.currentMode);
      this.ui.setPreset('plaza');

      const initialState = params.get('state');
      if (initialState) await this.setState(initialState);

      this.ui.setProgress(0.98, 'Compiling shaders');
      await this.renderer.compileAsync(this.scene, this.camera);
      this.ui.setProgress(1, 'Welcome to Sawarga');

      this.rig.setEnabled(true);
      this.renderer.shadowMap.autoUpdate = true;
      this.shadowFrames = 0;
      this.startLoop();
      window.addEventListener('resize', this.onResize);
      window.setTimeout(() => this.ui.hideLoading(), 650);
      window.setTimeout(() => {
        if (this.rig.touch) {
          this.ui.showToast('Left side to move · Right side to look', 3600);
        } else {
          this.ui.showToast('Click and drag to look around', 3200);
        }
      }, 1400);

      const setPausedForScreenshot = (paused: boolean) => this.setPaused(paused);
      const seed = (value: number) => ({ seed: value });
      window.__COURTYARD__ = {
        app: this,
        setState: (name) => this.setState(name),
        setPausedForScreenshot,
        seed,
      };
      if (this.debugEnabled) this.ui.toggleDebug();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Unable to load the courtyard';
      this.ui.showLoadError(`Could not start the scene — ${message}`);
      throw error;
    }
  }

  private startLoop(): void {
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.renderer.setAnimationLoop(() => {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.05);

      if (!this.paused) {
        this.rig.update(dt);
        this.lighting.update(dt);
        this.updateAdaptiveQuality(dt);
      }

      this.renderer.render(this.scene, this.camera);

      if (this.shadowFrames < 3) {
        this.shadowFrames += 1;
        if (this.shadowFrames === 3) this.renderer.shadowMap.autoUpdate = false;
      }

      this.updateDebug(dt);
    });
  }

  private updateAdaptiveQuality(dt: number): void {
    if (this.quality !== 'auto' || document.hidden) return;
    this.frameAccumulator += dt;
    this.frameCount += 1;
    if (this.frameCount < 90) return;
    const average = this.frameAccumulator / this.frameCount;
    this.frameAccumulator = 0;
    this.frameCount = 0;
    if (average > 0.024 && this.effectiveQuality !== 'low' && !this.autoReduced) {
      this.autoReduced = true;
      this.setEffectiveQuality(this.effectiveQuality === 'high' ? 'medium' : 'low');
      this.ui.showToast('Graphics reduced for smoother motion', 2600);
    }
  }

  private updateDebug(dt: number): void {
    if (!this.debugEnabled) return;
    this.debugAccumulator += dt;
    this.debugFrames += 1;
    if (this.debugAccumulator < 0.5) return;
    this.fps = this.debugFrames / this.debugAccumulator;
    this.debugAccumulator = 0;
    this.debugFrames = 0;
    this.ui.updateDebug(
      this.fps,
      this.renderer.info.render.calls,
      this.renderer.info.render.triangles,
      `${this.quality}${this.quality === 'auto' ? `/${this.effectiveQuality}` : ''}`,
    );
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.rig?.setPausedForScreenshot(paused);
  }

  private toggleTime(): void {
    this.time = this.time === 'sunset' ? 'day' : 'sunset';
    this.lighting.setTimeOfDay(this.time);
    this.ui.setTime(this.time);
    this.ui.showToast(this.time === 'sunset' ? 'Golden hour' : 'Daylight');
  }

  private setQuality(level: QualityLevel): void {
    this.quality = level;
    this.autoReduced = false;
    this.frameAccumulator = 0;
    this.frameCount = 0;
    const effective: EffectiveQuality =
      level === 'auto' ? (this.rig?.touch ? 'low' : 'medium') : level;
    this.setEffectiveQuality(effective);
    this.ui.setQuality(level);
    this.ui.showToast(
      level === 'auto' ? `Auto graphics · ${effective}` : `Graphics: ${level}`,
    );
  }

  private setEffectiveQuality(effective: EffectiveQuality): void {
    this.effectiveQuality = effective;
    const settings = QUALITY[effective];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.lighting?.setQuality(effective);
  }

  async setState(name: string): Promise<{ state: string }> {
    this.ui.hideLoadingNow();
    const parts = name.split('-');
    for (const part of parts) {
      if (part === 'day' || part === 'sunset') {
        this.time = part;
        this.lighting.setTimeOfDay(part, true);
        this.ui.setTime(part);
      } else if (part === 'plaza' || part === 'balcony' || part === 'overview') {
        this.rig.setPreset(part as PresetName, true);
      }
    }
    await nextFrames(2);
    return { state: name };
  }

  private cameraFov(): number {
    const aspect = window.innerWidth / window.innerHeight;
    return aspect < 0.8 ? 66 : 55;
  }

  private onResize = (): void => {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.fov = this.cameraFov();
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, QUALITY[this.effectiveQuality].pixelRatio),
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
