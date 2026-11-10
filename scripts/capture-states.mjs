import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://127.0.0.1:5188';
const states = (process.argv[3] ?? 'plaza,overview,balcony,day-plaza').split(',');
await mkdir('artifacts/screenshots', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`[console:error] ${msg.text()}`);
});
page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__COURTYARD__), null, { timeout: 30000 });
await page.waitForTimeout(2500);
for (const state of states) {
  await page.evaluate(async (name) => {
    if (name === 'south') {
      const app = window.__COURTYARD__.app;
      app.rig.position.set(0, 0, 4);
      app.rig.yaw = Math.PI;
      app.rig.pitch = 0.075;
      app.rig.mode = 'walk';
      app.rig.setEnabled(true);
      app.rig.update(0);
      return;
    }
    await window.__COURTYARD__.setState(name);
  }, state);
  await page.waitForTimeout(1200);
  const path = `artifacts/screenshots/desktop-${state}.png`;
  await page.screenshot({ path });
  console.log(`captured ${state} -> ${path}`);
}
await browser.close();
