import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://127.0.0.1:5188/?mobile=1';
const out = process.argv[3] ?? 'artifacts/screenshots/mobile-plaza.png';
await mkdir('artifacts/screenshots', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`[console:error] ${msg.text()}`);
});
page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__COURTYARD__), null, { timeout: 30000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: out });
const state = await page.evaluate(() => {
  const app = window.__COURTYARD__?.app;
  return {
    app: Boolean(app),
    calls: app ? app.renderer.info.render.calls : null,
    triangles: app ? app.renderer.info.render.triangles : null,
    textures: app ? app.renderer.info.memory.textures : null,
    mobileControls: !document.getElementById('mobile-controls')?.hidden,
    presets: Array.from(document.querySelectorAll('[data-preset]')).map((b) => ({
      label: b.textContent,
      active: b.getAttribute('aria-pressed'),
    })),
  };
});
console.log(JSON.stringify(state, null, 2));
await browser.close();
