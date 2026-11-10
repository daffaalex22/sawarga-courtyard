import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const url = args.find((arg) => arg.startsWith('http')) ?? 'http://127.0.0.1:5188';
const mobile = args.includes('mobile');
const headed = args.includes('--headed');
const quality = args.find((arg) => ['auto', 'low', 'medium', 'high'].includes(arg));
const query = new URLSearchParams();
if (mobile) query.set('mobile', '1');
if (quality) query.set('quality', quality);
const target = `${url}${query.toString() ? `?${query.toString()}` : ''}`;

const browser = await chromium.launch({
  headless: !headed,
  args: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-frame-rate-limit',
  ],
});
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 3 : 1,
  isMobile: mobile,
  hasTouch: mobile,
});
page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
await page.goto(target, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__COURTYARD__), null, { timeout: 30000 });
await page.waitForTimeout(4000);

const result = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const app = window.__COURTYARD__.app;
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const intervals = [];
      let last = performance.now();
      const start = last;
      const tick = (now) => {
        intervals.push(now - last);
        last = now;
        if (now - start < 4000) {
          requestAnimationFrame(tick);
          return;
        }
        const sorted = [...intervals].sort((a, b) => a - b);
        const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
        const seconds = (now - start) / 1000;
        resolve({
          frames: intervals.length,
          seconds: Number(seconds.toFixed(2)),
          fps: Number((intervals.length / seconds).toFixed(1)),
          avgFrameMs: Number(average.toFixed(2)),
          medianFrameMs: Number(sorted[Math.floor(sorted.length * 0.5)].toFixed(2)),
          p95FrameMs: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)),
          calls: app.renderer.info.render.calls,
          triangles: app.renderer.info.render.triangles,
          textures: app.renderer.info.memory.textures,
          pixelRatio: app.renderer.getPixelRatio(),
          quality: `${app.quality}/${app.effectiveQuality}`,
          gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
        });
      };
      requestAnimationFrame(tick);
    }),
);

console.log(JSON.stringify({ mobile, headed, target, ...result }, null, 2));
await browser.close();
