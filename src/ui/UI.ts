import type { CameraMode, PresetName, QualityLevel, TimeOfDay } from '../scene/config';

export interface UICallbacks {
  onTimeToggle: () => void;
  onQualityChange: (level: QualityLevel) => void;
  onReset: () => void;
  onPreset: (preset: PresetName) => void;
  onFlyToggle: () => void;
  onVertical: (value: number) => void;
  onHelp: () => void;
  onLayoutToggle: () => void;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element #${id}`);
  return element as T;
}

export class UI {
  private readonly callbacks: UICallbacks;
  private readonly loading = byId<HTMLDivElement>('loading');
  private readonly loadingBar = byId<HTMLSpanElement>('loading-progress');
  private readonly loadingStatus = byId<HTMLParagraphElement>('loading-status');
  private readonly timeButton = byId<HTMLButtonElement>('btn-time');
  private readonly layoutButton = byId<HTMLButtonElement>('btn-layout');
  private readonly qualityButton = byId<HTMLButtonElement>('btn-quality');
  private readonly fullscreenButton = byId<HTMLButtonElement>('btn-fullscreen');
  private readonly resetButton = byId<HTMLButtonElement>('btn-reset');
  private readonly helpButton = byId<HTMLButtonElement>('btn-help');
  private readonly qualityMenu = byId<HTMLDivElement>('quality-menu');
  private readonly qualityOptions = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-quality]'),
  );
  private readonly presets = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-preset]'));
  private readonly helpModal = byId<HTMLDivElement>('help-modal');
  private readonly helpClose = byId<HTMLButtonElement>('btn-help-close');
  private readonly toast = byId<HTMLDivElement>('toast');
  private readonly debug = byId<HTMLDivElement>('debug');
  private readonly debugFps = byId<HTMLSpanElement>('debug-fps');
  private readonly debugCalls = byId<HTMLSpanElement>('debug-calls');
  private readonly debugTris = byId<HTMLSpanElement>('debug-tris');
  private readonly debugQuality = byId<HTMLSpanElement>('debug-quality');
  private readonly mobileControls = byId<HTMLDivElement>('mobile-controls');
  private readonly mobileActions = document.querySelector<HTMLDivElement>('.mobile-actions')!;
  private readonly mobileHint = byId<HTMLParagraphElement>('mobile-hint');
  private readonly joystick = byId<HTMLDivElement>('joystick');
  private readonly joystickKnob = byId<HTMLDivElement>('joystick-knob');
  private readonly flyButton = byId<HTMLButtonElement>('btn-fly');
  private readonly upButton = byId<HTMLButtonElement>('btn-up');
  private readonly downButton = byId<HTMLButtonElement>('btn-down');
  private toastTimer: number | null = null;
  private helpOpen = false;

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;
    this.wire();
    this.updateFullscreenLabel();
  }

  get isHelpOpen(): boolean {
    return this.helpOpen;
  }

  setProgress(progress: number, status?: string): void {
    this.loadingBar.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    if (status) this.loadingStatus.textContent = status;
  }

  hideLoading(): void {
    this.loading.classList.add('is-hidden');
    window.setTimeout(() => {
      this.loading.hidden = true;
    }, 900);
  }

  /** Test/state captures must never include the loading overlay. */
  hideLoadingNow(): void {
    this.loading.classList.add('is-hidden');
    this.loading.hidden = true;
    this.loading.style.display = 'none';
  }

  showLoadError(message: string): void {
    this.loadingStatus.textContent = message;
    this.loadingStatus.classList.add('is-error');
    this.loadingBar.style.background = 'linear-gradient(90deg, #b64b3f, #e08a6a)';
  }

  setTime(time: TimeOfDay): void {
    this.timeButton.title = time === 'sunset' ? 'Switch to day' : 'Switch to sunset';
    this.timeButton.setAttribute(
      'aria-label',
      time === 'sunset' ? 'Switch to day' : 'Switch to sunset',
    );
    this.timeButton.dataset.time = time;
  }

  setQuality(level: QualityLevel): void {
    for (const option of this.qualityOptions) {
      option.setAttribute('aria-pressed', String(option.dataset.quality === level));
    }
    const label = level.charAt(0).toUpperCase() + level.slice(1);
    this.qualityButton.title = `Graphics: ${label}`;
    this.qualityButton.setAttribute('aria-label', `Graphics quality: ${label}`);
  }

  setPreset(name: PresetName): void {
    for (const preset of this.presets) {
      preset.setAttribute('aria-pressed', String(preset.dataset.preset === name));
    }
  }

  setMode(mode: CameraMode): void {
    const orbit = mode === 'orbit';
    this.mobileActions.style.display = orbit ? 'none' : '';
    if (orbit) {
      this.joystick.classList.remove('is-active');
      this.mobileHint.textContent = 'Drag to orbit · Pinch to zoom';
    } else {
      this.mobileHint.textContent =
        mode === 'fly'
          ? 'Left: move · Right: look · ↑/↓: height'
          : 'Left: move · Right: look';
      this.flyButton.setAttribute('aria-pressed', String(mode === 'fly'));
      this.flyButton.textContent = mode === 'fly' ? 'Land' : 'Fly';
    }
  }

  setFlying(flying: boolean): void {
    this.flyButton.setAttribute('aria-pressed', String(flying));
    this.flyButton.textContent = flying ? 'Land' : 'Fly';
    this.flyButton.classList.toggle('is-active', flying);
  }

  setMobileVisible(visible: boolean): void {
    this.mobileControls.hidden = !visible;
    document.body.classList.toggle('is-touch', visible);
  }

  setLayoutVisible(visible: boolean): void {
    this.layoutButton.setAttribute('aria-pressed', String(visible));
    this.layoutButton.title = visible ? 'Hide event layout' : 'Show event layout';
    this.layoutButton.setAttribute(
      'aria-label',
      visible ? 'Hide event layout' : 'Show event layout',
    );
  }

  showJoystick(visible: boolean, x: number, y: number, dx: number, dy: number): void {
    if (!visible) {
      this.joystick.classList.remove('is-active');
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
      return;
    }
    const clampedX = Math.min(Math.max(x, 74), window.innerWidth - 74);
    const clampedY = Math.min(Math.max(y, 92), window.innerHeight - 160);
    this.joystick.style.left = `${clampedX}px`;
    this.joystick.style.top = `${clampedY}px`;
    this.joystickKnob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
    this.joystick.classList.add('is-active');
  }

  setLocked(locked: boolean): void {
    document.body.classList.toggle('is-locked', locked);
  }

  toggleDebug(): void {
    this.debug.hidden = !this.debug.hidden;
  }

  updateDebug(fps: number, calls: number, triangles: number, quality: string): void {
    this.debugFps.textContent = `${fps.toFixed(0)} fps`;
    this.debugCalls.textContent = `${calls} calls`;
    this.debugTris.textContent = `${(triangles / 1000).toFixed(0)}k tris`;
    this.debugQuality.textContent = quality;
  }

  showToast(message: string, duration = 2200): void {
    this.toast.textContent = message;
    this.toast.hidden = false;
    this.toast.classList.add('is-visible');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove('is-visible');
      this.toastTimer = window.setTimeout(() => {
        this.toast.hidden = true;
      }, 250);
    }, duration);
  }

  hideToast(): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.toast.classList.remove('is-visible');
    this.toast.hidden = true;
  }

  openHelp(): void {
    this.helpOpen = true;
    this.helpModal.hidden = false;
    this.helpClose.focus();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeHelp(): void {
    this.helpOpen = false;
    this.helpModal.hidden = true;
    this.helpButton.focus();
  }

  private wire(): void {
    this.timeButton.addEventListener('click', () => this.callbacks.onTimeToggle());
    this.layoutButton.addEventListener('click', () => this.callbacks.onLayoutToggle());
    this.qualityButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.qualityMenu.hidden = !this.qualityMenu.hidden;
    });
    for (const option of this.qualityOptions) {
      option.addEventListener('click', () => {
        const level = option.dataset.quality as QualityLevel;
        this.callbacks.onQualityChange(level);
        this.qualityMenu.hidden = true;
      });
    }
    this.fullscreenButton.addEventListener('click', () => {
      void this.toggleFullscreen();
    });
    this.resetButton.addEventListener('click', () => this.callbacks.onReset());
    this.helpButton.addEventListener('click', () => this.openHelp());
    this.helpClose.addEventListener('click', () => this.closeHelp());
    this.helpModal.addEventListener('click', (event) => {
      if (event.target === this.helpModal) this.closeHelp();
    });
    for (const preset of this.presets) {
      preset.addEventListener('click', () => {
        this.callbacks.onPreset(preset.dataset.preset as PresetName);
      });
    }
    this.flyButton.addEventListener('click', () => this.callbacks.onFlyToggle());
    this.bindVertical(this.upButton, 1);
    this.bindVertical(this.downButton, -1);
    document.addEventListener('pointerdown', (event) => {
      if (this.qualityMenu.hidden) return;
      const target = event.target as Node;
      if (this.qualityMenu.contains(target) || this.qualityButton.contains(target)) return;
      this.qualityMenu.hidden = true;
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.helpOpen) {
        this.closeHelp();
      }
    });
    document.addEventListener('fullscreenchange', () => this.updateFullscreenLabel());
    window.addEventListener('resize', () => {
      this.joystick.classList.remove('is-active');
    });
  }

  private bindVertical(button: HTMLButtonElement, value: number): void {
    const start = (event: PointerEvent) => {
      event.preventDefault();
      this.callbacks.onVertical(value);
      try {
        button.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic pointer events in automated tests have no active capture target.
      }
    };
    const end = (event: PointerEvent) => {
      event.preventDefault();
      this.callbacks.onVertical(0);
    };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('pointerleave', end);
  }

  private async toggleFullscreen(): Promise<void> {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  private updateFullscreenLabel(): void {
    const active = Boolean(document.fullscreenElement);
    this.fullscreenButton.setAttribute(
      'aria-label',
      active ? 'Exit fullscreen' : 'Enter fullscreen',
    );
    this.fullscreenButton.title = active ? 'Exit fullscreen' : 'Fullscreen';
  }
}
