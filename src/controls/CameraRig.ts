import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WORLD, type CameraMode, type PresetName } from '../scene/config';
import type { CollisionWorld } from './CollisionWorld';

export interface CameraRigCallbacks {
  onLockChange?: (locked: boolean) => void;
  onModeChange?: (mode: CameraMode) => void;
  onPresetChange?: (preset: PresetName) => void;
  onJoystick?: (visible: boolean, x: number, y: number, dx: number, dy: number) => void;
  onFlyChange?: (flying: boolean) => void;
  onHelp?: () => void;
  isBlocked?: () => boolean;
}

interface Transition {
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
  endQuaternion: THREE.Quaternion;
  elapsed: number;
  duration: number;
  targetMode: CameraMode;
  endFeet: THREE.Vector3;
  endYaw: number;
  endPitch: number;
  orbitTarget?: THREE.Vector3;
}

interface Preset {
  feet: THREE.Vector3;
  yaw: number;
  pitch: number;
  mode: CameraMode;
  orbitTarget?: THREE.Vector3;
}

const PRESETS: Record<PresetName, Preset> = {
  plaza: {
    feet: new THREE.Vector3(0, 0, 22.5),
    yaw: 0.06,
    pitch: -0.015,
    mode: 'walk',
  },
  balcony: {
    feet: new THREE.Vector3(31, 5.2, 0),
    yaw: 1.17,
    pitch: -0.08,
    mode: 'fly',
  },
  overview: {
    feet: new THREE.Vector3(0, 50, 58),
    yaw: 0,
    pitch: -0.7,
    mode: 'orbit',
    orbitTarget: new THREE.Vector3(0, 2, 0),
  },
};

const SENSITIVITY = 0.0022;
const TOUCH_SENSITIVITY = 0.0042;
const JOYSTICK_RADIUS = 46;
const WALK_SPEED = 3.4;
const WALK_SPRINT = 6.8;
const FLY_SPEED = 7.0;
const FLY_SPRINT = 14.0;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly orbit: OrbitControls;

  private readonly domElement: HTMLElement;
  private readonly collision: CollisionWorld;
  private readonly callbacks: CameraRigCallbacks;
  private readonly isTouch: boolean;

  private mode: CameraMode = 'walk';
  private position = PRESETS.plaza.feet.clone();
  private yaw = PRESETS.plaza.yaw;
  private pitch = PRESETS.plaza.pitch;
  private velocity = new THREE.Vector3();
  private verticalVelocity = 0;
  private readonly keys = new Set<string>();
  private enabled = false;
  private locked = false;
  private transition: Transition | null = null;
  private currentPreset: PresetName = 'plaza';
  private touchVertical = 0;

  private joystickPointerId: number | null = null;
  private lookPointerId: number | null = null;
  private joystickOrigin = new THREE.Vector2();
  private joystickVector = new THREE.Vector2();
  private lastLook = new THREE.Vector2();

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    collision: CollisionWorld,
    callbacks: CameraRigCallbacks = {},
    forceTouch = false,
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.collision = collision;
    this.callbacks = callbacks;
    this.isTouch = forceTouch ||
      (typeof window !== 'undefined' &&
        (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0));
    this.camera.rotation.order = 'YXZ';

    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enabled = false;
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.06;
    this.orbit.minDistance = 5;
    this.orbit.maxDistance = 190;
    this.orbit.minPolarAngle = 0.08;
    this.orbit.maxPolarAngle = Math.PI * 0.495;
    this.orbit.screenSpacePanning = false;
    this.orbit.target.set(0, 2, 0);
    this.orbit.addEventListener('start', () => {
      if (this.mode === 'orbit') this.transition = null;
    });

    this.domElement.addEventListener('click', this.onCanvasClick);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    this.domElement.addEventListener('pointerdown', this.onTouchStart, { passive: false });
    this.domElement.addEventListener('pointermove', this.onTouchMove, { passive: false });
    this.domElement.addEventListener('pointerup', this.onTouchEnd);
    this.domElement.addEventListener('pointercancel', this.onTouchEnd);
    this.domElement.addEventListener('contextmenu', this.onContextMenu);

    this.applyCamera();
  }

  get touch(): boolean {
    return this.isTouch;
  }

  get currentMode(): CameraMode {
    return this.mode;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setPreset(name: PresetName, immediate = false): void {
    const preset = PRESETS[name];
    this.currentPreset = name;
    this.callbacks.onPresetChange?.(name);

    if (preset.mode === 'orbit') {
      const target = preset.orbitTarget ?? new THREE.Vector3(0, 2, 0);
      const endPosition = preset.feet.clone();
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(endPosition, target, new THREE.Vector3(0, 1, 0)),
      );
      if (immediate) {
        this.transition = null;
        this.mode = 'orbit';
        this.camera.position.copy(endPosition);
        this.camera.quaternion.copy(quaternion);
        this.orbit.target.copy(target);
        this.orbit.enabled = true;
        this.orbit.update();
        this.callbacks.onModeChange?.('orbit');
        return;
      }
      this.beginTransition(
        endPosition,
        quaternion,
        'orbit',
        new THREE.Vector3(0, 0, 0),
        preset.yaw,
        preset.pitch,
        target,
      );
      return;
    }

    const endCamera = new THREE.Vector3(
      preset.feet.x,
      preset.feet.y + WORLD.eyeHeight,
      preset.feet.z,
    );
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(preset.pitch, preset.yaw, 0, 'YXZ'),
    );
    if (immediate) {
      this.transition = null;
      this.mode = preset.mode;
      this.orbit.enabled = false;
      this.position.copy(preset.feet);
      this.yaw = preset.yaw;
      this.pitch = preset.pitch;
      this.velocity.set(0, 0, 0);
      this.verticalVelocity = 0;
      this.applyCamera();
      this.callbacks.onModeChange?.(preset.mode);
      this.callbacks.onFlyChange?.(preset.mode === 'fly');
      return;
    }
    this.beginTransition(
      endCamera,
      quaternion,
      preset.mode,
      preset.feet,
      preset.yaw,
      preset.pitch,
    );
  }

  reset(): void {
    this.setPreset('plaza');
  }

  toggleFly(): void {
    if (this.mode === 'orbit') {
      this.exitOrbit();
      this.mode = 'fly';
      this.callbacks.onModeChange?.('fly');
      this.callbacks.onFlyChange?.(true);
      return;
    }
    this.mode = this.mode === 'fly' ? 'walk' : 'fly';
    if (this.mode === 'walk') {
      this.position.y = 0;
      this.verticalVelocity = 0;
    }
    this.callbacks.onModeChange?.(this.mode);
    this.callbacks.onFlyChange?.(this.mode === 'fly');
  }

  toggleOrbit(): void {
    if (this.mode === 'orbit') {
      this.exitOrbit();
      return;
    }
    if (document.pointerLockElement) document.exitPointerLock();
    this.mode = 'orbit';
    this.orbit.enabled = true;
    this.orbit.target.set(0, 2.5, 0);
    this.orbit.update();
    this.callbacks.onModeChange?.('orbit');
  }

  setTouchVertical(value: number): void {
    this.touchVertical = value;
  }

  setPausedForScreenshot(paused: boolean): void {
    this.enabled = !paused;
  }

  getDebugState(): Record<string, unknown> {
    return {
      mode: this.mode,
      position: this.position.toArray(),
      yaw: this.yaw,
      pitch: this.pitch,
      locked: this.locked,
      preset: this.currentPreset,
    };
  }

  update(dt: number): void {
    if (this.transition) {
      this.updateTransition(dt);
      return;
    }
    if (this.mode === 'orbit') {
      this.orbit.update(dt);
      return;
    }
    if (!this.enabled) {
      this.applyCamera();
      return;
    }

    if (this.isBlocked()) {
      this.velocity.multiplyScalar(0.85);
      this.applyCamera();
      return;
    }

    const forwardInput =
      (this.keys.has('KeyW') ? 1 : 0) -
      (this.keys.has('KeyS') ? 1 : 0) +
      this.joystickVector.y;
    const rightInput =
      (this.keys.has('KeyD') ? 1 : 0) -
      (this.keys.has('KeyA') ? 1 : 0) +
      this.joystickVector.x;
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const flying = this.mode === 'fly';
    const speed = flying
      ? sprint
        ? FLY_SPRINT
        : FLY_SPEED
      : sprint
        ? WALK_SPRINT
        : WALK_SPEED;

    let forward = forwardInput;
    let right = rightInput;
    const length = Math.hypot(forward, right);
    if (length > 1) {
      forward /= length;
      right /= length;
    }

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const targetX = (-sin * forward + cos * right) * speed;
    const targetZ = (-cos * forward - sin * right) * speed;

    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetX, 12, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetZ, 12, dt);

    if (flying) {
      const verticalInput =
        (this.keys.has('Space') ? 1 : 0) -
        (this.keys.has('ControlLeft') || this.keys.has('ControlRight') ? 1 : 0) +
        this.touchVertical;
      const targetY = verticalInput * speed;
      this.verticalVelocity = THREE.MathUtils.damp(this.verticalVelocity, targetY, 10, dt);
      this.position.y += this.verticalVelocity * dt;
      this.position.y = THREE.MathUtils.clamp(this.position.y, 0, 70);
    } else {
      this.position.y = 0;
      this.verticalVelocity = 0;
    }

    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;

    const aboveWalls = flying && this.position.y > WORLD.heroWallHeight + 1.5;
    if (!aboveWalls) {
      const skipObstacles = flying && this.position.y > 1.2;
      const resolved = this.collision.resolve(
        nextX,
        nextZ,
        WORLD.playerRadius,
        skipObstacles,
      );
      this.position.x = resolved.x;
      this.position.z = resolved.z;
    } else {
      this.position.x = nextX;
      this.position.z = nextZ;
    }

    this.applyCamera();
  }

  private beginTransition(
    endPosition: THREE.Vector3,
    endQuaternion: THREE.Quaternion,
    targetMode: CameraMode,
    endFeet: THREE.Vector3,
    endYaw: number,
    endPitch: number,
    orbitTarget?: THREE.Vector3,
  ): void {
    this.orbit.enabled = false;
    this.transition = {
      startPosition: this.camera.position.clone(),
      endPosition,
      startQuaternion: this.camera.quaternion.clone(),
      endQuaternion,
      elapsed: 0,
      duration: 1.1,
      targetMode,
      endFeet: endFeet.clone(),
      endYaw,
      endPitch,
      orbitTarget: orbitTarget?.clone(),
    };
  }

  private updateTransition(dt: number): void {
    const transition = this.transition;
    if (!transition) return;
    transition.elapsed += dt;
    const raw = Math.min(1, transition.elapsed / transition.duration);
    const t = raw * raw * (3 - 2 * raw);
    this.camera.position.lerpVectors(transition.startPosition, transition.endPosition, t);
    this.camera.quaternion.copy(transition.startQuaternion).slerp(transition.endQuaternion, t);
    if (raw < 1) return;

    this.transition = null;
    this.mode = transition.targetMode;
    if (this.mode === 'orbit') {
      this.orbit.target.copy(transition.orbitTarget ?? new THREE.Vector3(0, 2, 0));
      this.orbit.enabled = true;
      this.orbit.update();
    } else {
      this.position.copy(transition.endFeet);
      this.yaw = transition.endYaw;
      this.pitch = transition.endPitch;
      this.velocity.set(0, 0, 0);
      this.verticalVelocity = 0;
      this.applyCamera();
    }
    this.callbacks.onModeChange?.(this.mode);
    this.callbacks.onFlyChange?.(this.mode === 'fly');
  }

  private exitOrbit(): void {
    this.orbit.enabled = false;
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = THREE.MathUtils.clamp(euler.x, -1.45, 1.45);
    const height = Math.max(0, this.camera.position.y - WORLD.eyeHeight);
    this.mode = height > 0.4 ? 'fly' : 'walk';
    this.position.set(this.camera.position.x, height, this.camera.position.z);
    this.velocity.set(0, 0, 0);
    this.callbacks.onModeChange?.(this.mode);
    this.callbacks.onFlyChange?.(this.mode === 'fly');
    this.applyCamera();
  }

  private applyCamera(): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + WORLD.eyeHeight,
      this.position.z,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private isBlocked(): boolean {
    return this.callbacks.isBlocked?.() ?? false;
  }

  private onCanvasClick = (event: MouseEvent): void => {
    if (!this.enabled || this.isTouch || this.mode === 'orbit' || this.transition) return;
    if (event.button !== 0) return;
    if (!document.pointerLockElement) {
      this.domElement.requestPointerLock();
    }
  };

  private onPointerLockChange = (): void => {
    this.locked = document.pointerLockElement === this.domElement;
    this.callbacks.onLockChange?.(this.locked);
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.locked || this.mode === 'orbit' || this.transition) return;
    this.yaw -= event.movementX * SENSITIVITY;
    this.pitch -= event.movementY * SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (this.isBlocked()) return;
    const code = event.code;
    if (['Space', 'ControlLeft', 'ControlRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      event.preventDefault();
    }
    if (code === 'KeyH') {
      this.callbacks.onHelp?.();
      return;
    }
    if (code === 'KeyF' && !event.repeat) {
      this.toggleFly();
      return;
    }
    if (code === 'KeyO' && !event.repeat) {
      this.toggleOrbit();
      return;
    }
    if (code === 'KeyR' && !event.repeat) {
      this.setPreset('plaza');
      return;
    }
    if (code === 'Digit1' && !event.repeat) {
      this.setPreset('plaza');
      return;
    }
    if (code === 'Digit2' && !event.repeat) {
      this.setPreset('balcony');
      return;
    }
    if (code === 'Digit3' && !event.repeat) {
      this.setPreset('overview');
      return;
    }
    if (code === 'Escape' && this.mode === 'orbit') {
      this.exitOrbit();
      return;
    }
    this.keys.add(code);
    if (this.transition) this.transition = null;
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private onTouchStart = (event: PointerEvent): void => {
    if (!this.enabled || !this.isTouch || this.mode === 'orbit' || this.transition) return;
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    if (this.joystickPointerId === event.pointerId || this.lookPointerId === event.pointerId) return;
    const isLeft = event.clientX < window.innerWidth * 0.5;
    if (isLeft && this.joystickPointerId === null) {
      this.joystickPointerId = event.pointerId;
      this.joystickOrigin.set(event.clientX, event.clientY);
      this.joystickVector.set(0, 0);
      this.callbacks.onJoystick?.(true, event.clientX, event.clientY, 0, 0);
      try {
        this.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic pointer events in automated tests have no active capture target.
      }
      event.preventDefault();
      return;
    }
    if (this.lookPointerId === null) {
      this.lookPointerId = event.pointerId;
      this.lastLook.set(event.clientX, event.clientY);
      event.preventDefault();
    }
  };

  private onTouchMove = (event: PointerEvent): void => {
    if (!this.enabled || !this.isTouch || this.mode === 'orbit') return;
    if (event.pointerId === this.joystickPointerId) {
      const dx = event.clientX - this.joystickOrigin.x;
      const dy = event.clientY - this.joystickOrigin.y;
      const length = Math.hypot(dx, dy);
      const scale = length > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / length : 1;
      const clampedX = dx * scale;
      const clampedY = dy * scale;
      this.joystickVector.set(clampedX / JOYSTICK_RADIUS, -clampedY / JOYSTICK_RADIUS);
      this.callbacks.onJoystick?.(
        true,
        this.joystickOrigin.x,
        this.joystickOrigin.y,
        clampedX,
        clampedY,
      );
      event.preventDefault();
      return;
    }
    if (event.pointerId === this.lookPointerId) {
      const dx = event.clientX - this.lastLook.x;
      const dy = event.clientY - this.lastLook.y;
      this.yaw -= dx * TOUCH_SENSITIVITY;
      this.pitch -= dy * TOUCH_SENSITIVITY;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
      this.lastLook.set(event.clientX, event.clientY);
      event.preventDefault();
    }
  };

  private onTouchEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.joystickPointerId) {
      this.joystickPointerId = null;
      this.joystickVector.set(0, 0);
      this.callbacks.onJoystick?.(false, 0, 0, 0, 0);
    }
    if (event.pointerId === this.lookPointerId) {
      this.lookPointerId = null;
    }
  };

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  dispose(): void {
    this.domElement.removeEventListener('click', this.onCanvasClick);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('pointerdown', this.onTouchStart);
    this.domElement.removeEventListener('pointermove', this.onTouchMove);
    this.domElement.removeEventListener('pointerup', this.onTouchEnd);
    this.domElement.removeEventListener('pointercancel', this.onTouchEnd);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.orbit.dispose();
  }
}
