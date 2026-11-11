import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const url = args.find((arg) => arg.startsWith('http')) ?? 'http://127.0.0.1:5188';
const headless = args.includes('--headless');
const errors = [];

function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) errors.push(name);
}

// Headed is the default: headless Chromium falls back to SwiftShader and
// throttles time-based transitions on this machine.
const browser = await chromium.launch({
  headless,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__COURTYARD__?.app), null, { timeout: 30000 });
await page.waitForTimeout(1200);

// Help modal.
await page.click('#btn-help');
check('help opens', !(await page.locator('#help-modal').isHidden()));
await page.keyboard.press('Escape');
check('help closes with Escape', await page.locator('#help-modal').isHidden());

// Quality menu.
await page.click('#btn-quality');
check('quality menu opens', !(await page.locator('#quality-menu').isHidden()));
await page.click('[data-quality="high"]');
await page.waitForTimeout(300);
const qualityAfterHigh = await page.evaluate(() => window.__COURTYARD__.app.quality);
check('quality switches to high', qualityAfterHigh === 'high', qualityAfterHigh);
await page.click('#btn-quality');
await page.click('[data-quality="auto"]');
await page.waitForTimeout(300);

// Event layout and overlay.
const layoutOn = await page.evaluate(() => window.__COURTYARD__.app.eventProxies.visible);
await page.click('#btn-layout');
const layoutOff = await page.evaluate(() => window.__COURTYARD__.app.eventProxies.visible);
check('layout button hides event proxies', layoutOn === true && layoutOff === false);
await page.click('#btn-layout');
await page.waitForTimeout(250);
const layoutBackOn = await page.evaluate(() => window.__COURTYARD__.app.eventProxies.visible);
check('layout button restores event proxies', layoutBackOn === true);
await page.keyboard.press('l');
const overlayOn = await page.evaluate(() => window.__COURTYARD__.app.layoutOverlay.visible);
check('L shows layout overlay', overlayOn === true);
await page.keyboard.press('l');
const overlayOff = await page.evaluate(() => window.__COURTYARD__.app.layoutOverlay.visible);
check('L hides layout overlay', overlayOff === false);

// Time of day.
const initialTime = await page.evaluate(() => window.__COURTYARD__.app.time);
await page.click('#btn-time');
await page.waitForTimeout(300);
const dayTime = await page.evaluate(() => window.__COURTYARD__.app.time);
check('time toggles to day', initialTime === 'sunset' && dayTime === 'day', `${initialTime} -> ${dayTime}`);
await page.click('#btn-time');
await page.waitForTimeout(300);

// Presets.
await page.click('[data-preset="overview"]');
await page.waitForTimeout(1500);
const overviewMode = await page.evaluate(() => window.__COURTYARD__.app.rig.currentMode);
check('overview enters orbit', overviewMode === 'orbit', overviewMode);
await page.click('[data-preset="plaza"]');
await page.waitForTimeout(1500);
const plazaMode = await page.evaluate(() => window.__COURTYARD__.app.rig.currentMode);
check('plaza returns to walk', plazaMode === 'walk', plazaMode);

// Keyboard movement.
const beforeMove = await page.evaluate(() => window.__COURTYARD__.app.rig.position.toArray());
await page.keyboard.down('w');
await page.waitForTimeout(450);
await page.keyboard.up('w');
const afterMove = await page.evaluate(() => window.__COURTYARD__.app.rig.position.toArray());
const moved = Math.hypot(afterMove[0] - beforeMove[0], afterMove[2] - beforeMove[2]);
check('W moves the camera', moved > 0.3, `${moved.toFixed(2)} m`);

// Mobile controls. Close the desktop page so the mobile tab is foregrounded;
// background WebGL tabs throttle shader compilation and rAF.
await page.close();
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
mobile.on('pageerror', (error) => errors.push(`mobile pageerror: ${error.message}`));
mobile.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`mobile console: ${msg.text()}`);
});
await mobile.goto(`${url}?mobile=1`, { waitUntil: 'networkidle' });
await mobile.bringToFront();
await mobile.waitForFunction(() => Boolean(window.__COURTYARD__?.app), null, { timeout: 60000 });
await mobile.waitForTimeout(1200);

const mobileControlsVisible = await mobile.evaluate(
  () => !document.getElementById('mobile-controls')?.hidden,
);
check('mobile controls visible', mobileControlsVisible);

const mobileLayoutBefore = await mobile.evaluate(
  () => window.__COURTYARD__.app.eventProxies.visible,
);
await mobile.click('#btn-layout');
await mobile.waitForTimeout(250);
const mobileLayoutAfter = await mobile.evaluate(
  () => window.__COURTYARD__.app.eventProxies.visible,
);
check(
  'mobile layout button toggles event proxies',
  mobileLayoutBefore === true && mobileLayoutAfter === false,
);
await mobile.click('#btn-layout');
await mobile.waitForTimeout(250);

await mobile.click('#btn-fly');
const flyMode = await mobile.evaluate(() => window.__COURTYARD__.app.rig.currentMode);
check('mobile fly toggle', flyMode === 'fly', flyMode);
await mobile.click('#btn-fly');
await mobile.waitForTimeout(200);

const joystickBefore = await mobile.evaluate(() => window.__COURTYARD__.app.rig.position.toArray());
await mobile.evaluate(() => {
  const canvas = document.querySelector('#scene');
  const fire = (type, x, y, id) => {
    canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: id,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
      }),
    );
  };
  fire('pointerdown', 80, 600, 11);
  fire('pointermove', 80, 548, 11);
});
await mobile.waitForTimeout(500);
const joystickActive = await mobile.evaluate(() =>
  document.getElementById('joystick')?.classList.contains('is-active'),
);
const joystickAfter = await mobile.evaluate(() => window.__COURTYARD__.app.rig.position.toArray());
check('mobile joystick appears', Boolean(joystickActive));
const joystickMoved = Math.hypot(
  joystickAfter[0] - joystickBefore[0],
  joystickAfter[2] - joystickBefore[2],
);
check('mobile joystick moves camera', joystickMoved > 0.2, `${joystickMoved.toFixed(2)} m`);
await mobile.evaluate(() => {
  const canvas = document.querySelector('#scene');
  canvas.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerId: 11,
      pointerType: 'touch',
      clientX: 80,
      clientY: 548,
      button: 0,
      buttons: 0,
    }),
  );
});

const yawBefore = await mobile.evaluate(() => window.__COURTYARD__.app.rig.yaw);
await mobile.evaluate(() => {
  const canvas = document.querySelector('#scene');
  const fire = (type, x, y, id) => {
    canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: id,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
      }),
    );
  };
  fire('pointerdown', 300, 500, 12);
  fire('pointermove', 250, 500, 12);
});
await mobile.waitForTimeout(200);
const yawAfter = await mobile.evaluate(() => window.__COURTYARD__.app.rig.yaw);
check('mobile look changes yaw', Math.abs(yawAfter - yawBefore) > 0.05, `${yawBefore.toFixed(2)} -> ${yawAfter.toFixed(2)}`);

await mobile.close();
await browser.close();

if (errors.length > 0) {
  console.error(`\n${errors.length} failure(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
