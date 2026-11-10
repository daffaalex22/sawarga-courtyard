import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://127.0.0.1:5188';
const out = process.argv[3] ?? 'artifacts/screenshots/desktop-plaza.png';
await mkdir('artifacts/screenshots', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[console:${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
page.on('requestfailed', (request) => console.log(`[requestfailed] ${request.url()} ${request.failure()?.errorText}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
await page.screenshot({ path: out });
const state = await page.evaluate(() => ({
  app: Boolean(window.__COURTYARD__),
  loadingHidden: document.getElementById('loading')?.hidden ?? null,
  canvas: (() => {
    const canvas = document.querySelector('canvas');
    return canvas ? { width: canvas.width, height: canvas.height } : null;
  })(),
}));
console.log(JSON.stringify(state, null, 2));
await browser.close();
