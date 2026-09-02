#!/usr/bin/env node

/* eslint-disable import/no-nodejs-modules -- This skill helper is a Node.js CLI. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import process from 'node:process';
import {parseArgs} from 'node:util';

const requireFromRepo = createRequire(path.join(process.cwd(), 'package.json'));

// This helper deliberately does not decide what deserves a screenshot. The agent
// reads the diff and builds a plan; this script only performs repeatable safety
// validation, browser capture, and before/after composition.

// Plan validation and customer-data guardrails ---------------------------------

function assertObject(value, description) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object`);
  }
}

function validateUrl(value, targetKind) {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`Capture URL must use HTTPS: ${value}`);
  }
  if (url.hostname !== 'demo.dev.getsentry.net') {
    throw new Error(`Captures must use the demo organization hostname: ${value}`);
  }
  if (targetKind === 'story' && !url.pathname.startsWith('/scraps/')) {
    throw new Error(`Story captures must use the demo Scraps route: ${value}`);
  }
  return url;
}

function assertCaptureLocation(page, targetKind, stage) {
  const current = new URL(page.url());
  if (current.pathname.startsWith('/auth/login/')) {
    throw new Error(`${stage} redirected to login; refresh the dedicated Chrome session`);
  }
  if (current.hostname !== 'demo.dev.getsentry.net') {
    throw new Error(`${stage} left the synthetic demo organization: ${current.href}`);
  }
  if (targetKind === 'story' && !current.pathname.startsWith('/scraps/')) {
    throw new Error(`${stage} left the demo Scraps route: ${current.href}`);
  }
}

function validatePlan(plan) {
  assertObject(plan, 'Plan');
  assertObject(plan.target, 'Plan target');
  if (!['product', 'story'].includes(plan.target.kind)) {
    throw new Error(`Unsupported target kind: ${plan.target.kind}`);
  }
  if (!plan.name || typeof plan.name !== 'string') {
    throw new Error('Plan name is required');
  }
  validateUrl(plan.beforeUrl, plan.target.kind);
  validateUrl(plan.afterUrl, plan.target.kind);
  if (plan.themes) {
    if (
      plan.themes.some(theme => !['light', 'dark'].includes(theme)) ||
      new Set(plan.themes).size !== plan.themes.length
    ) {
      throw new Error('Plan themes must contain unique light and/or dark values');
    }
  }
  for (const viewport of plan.viewports ?? []) {
    if (
      !viewport.name ||
      !Number.isInteger(viewport.width) ||
      !Number.isInteger(viewport.height) ||
      viewport.width <= 0 ||
      viewport.height <= 0
    ) {
      throw new Error('Each viewport requires a name and positive integer dimensions');
    }
  }
  for (const action of plan.actions ?? []) {
    if (!['click', 'fill', 'press', 'wait'].includes(action.kind)) {
      throw new Error(`Unsupported action kind: ${action.kind}`);
    }
    if (action.selector) {
      throw new Error('CSS selectors are not accepted; use accessible roles or labels');
    }
  }
}

function safeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Browser state -----------------------------------------------------------------

async function setTheme(page, theme) {
  const toLight = page.getByRole('button', {name: 'Switch to Light Mode'});
  const toDark = page.getByRole('button', {name: 'Switch to Dark Mode'});
  await Promise.race([
    toLight.first().waitFor({state: 'visible', timeout: 5000}),
    toDark.first().waitFor({state: 'visible', timeout: 5000}),
  ]).catch(() => {});

  const control = theme === 'light' ? toLight : toDark;
  const desiredStateControl = theme === 'light' ? toDark : toLight;
  if ((await control.count()) === 1 && (await control.isVisible())) {
    await control.click();
    await desiredStateControl.first().waitFor({state: 'visible', timeout: 5000});
    return;
  }
  if (
    (await desiredStateControl.count()) === 1 &&
    (await desiredStateControl.isVisible())
  ) {
    return;
  }
  await page.emulateMedia({colorScheme: theme});
}

async function runActions(page, actions, assertLocation) {
  for (const action of actions ?? []) {
    if (action.kind === 'wait') {
      await page.waitForTimeout(action.ms ?? 500);
      assertLocation();
      continue;
    }
    if (action.kind === 'press') {
      await page.keyboard.press(action.key);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      assertLocation();
      continue;
    }
    const locator = action.label
      ? page.getByLabel(action.label, {exact: action.exact ?? true})
      : page.getByRole(action.role, {name: action.name, exact: action.exact ?? true});
    if ((await locator.count()) !== 1) {
      throw new Error(
        `Action ${action.kind} did not resolve exactly one accessible element`
      );
    }
    if (action.kind === 'click') {
      await locator.click();
    } else if (action.kind === 'fill') {
      await locator.fill(action.value);
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    assertLocation();
  }
}

// Story captures use the section around an accessible heading. Product captures
// intentionally keep the viewport so reviewers can see modal/drawer surroundings.
async function storySectionClip(page, headingName) {
  const heading = page.getByRole('heading', {name: headingName, exact: true});
  await heading.first().waitFor({state: 'visible', timeout: 10000});
  if ((await heading.count()) !== 1) {
    throw new Error(`Expected exactly one story heading named ${headingName}`);
  }
  await heading.scrollIntoViewIfNeeded();
  await page.evaluate(
    element =>
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 24),
    await heading.elementHandle()
  );
  return heading.evaluate(element => {
    const root = element.closest('section');
    if (!root) {
      throw new Error('Story heading has no section ancestor');
    }
    const children = [...root.children];
    const start = children.findIndex(child => child.contains(element));
    const selected = [];
    for (const child of children.slice(start)) {
      if (selected.length > 0 && child.querySelector('h1,h2,h3,h4,h5,h6')) {
        break;
      }
      if (child.classList.contains('expressive-code')) {
        break;
      }
      selected.push(child);
    }
    const boxes = selected.map(child => child.getBoundingClientRect());
    const left = Math.min(...boxes.map(box => box.left)) - 16;
    const top = Math.min(...boxes.map(box => box.top)) - 16;
    const right = Math.max(...boxes.map(box => box.right)) + 16;
    const bottom = Math.max(...boxes.map(box => box.bottom)) + 16;
    return {x: left, y: top, width: right - left, height: bottom - top};
  });
}

async function resolveTarget(page, target) {
  if (target.kind === 'story') {
    if (target.heading) {
      return {clip: await storySectionClip(page, target.heading), locator: null};
    }
    const locator = page.getByRole('main');
    await locator.first().waitFor({state: 'visible', timeout: 10000});
    if ((await locator.count()) !== 1) {
      throw new Error('Expected exactly one Scraps main region');
    }
    return {clip: null, locator};
  }
  return {clip: null, locator: null};
}

async function validateImages(page, target) {
  const locator = target.locator?.locator('img') ?? page.locator('img');
  const states = await locator.evaluateAll(async (images, clip) => {
    const selected = clip
      ? images.filter(image => {
          const box = image.getBoundingClientRect();
          return (
            box.right >= clip.x &&
            box.left <= clip.x + clip.width &&
            box.bottom >= clip.y &&
            box.top <= clip.y + clip.height
          );
        })
      : images;
    await Promise.all(
      selected.map(
        image =>
          image.complete ||
          new Promise(resolve => {
            image.addEventListener('load', resolve, {once: true});
            image.addEventListener('error', resolve, {once: true});
            setTimeout(resolve, 5000);
          })
      )
    );
    return selected.map(image => ({
      alt: image.alt,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      src: image.currentSrc || image.src,
    }));
  }, target.clip);
  const broken = states.filter(state => !state.complete || state.naturalWidth === 0);
  if (broken.length) {
    throw new Error(
      `Broken images in capture target: ${broken.map(image => image.alt || image.src).join(', ')}`
    );
  }
}

// Output ------------------------------------------------------------------------

async function takeScreenshot(page, target, outputPath) {
  if (target.clip) {
    await page.screenshot({path: outputPath, clip: target.clip});
  } else if (target.locator) {
    await target.locator.screenshot({path: outputPath});
  } else {
    await page.screenshot({path: outputPath, fullPage: false});
  }
}

async function compose(page, beforePath, afterPath, outputPath, theme) {
  const before = fs.readFileSync(beforePath).toString('base64');
  const after = fs.readFileSync(afterPath).toString('base64');
  const background = theme === 'dark' ? '#18171c' : '#ffffff';
  const foreground = theme === 'dark' ? '#f2f0f5' : '#2b2933';
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: ${background}; color: ${foreground}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      #comparison { display: flex; gap: 24px; padding: 24px; width: max-content; }
      .panel { width: max-content; }
      .label { font-size: 20px; font-weight: 600; margin: 0 0 12px 2px; }
      img { display: block; max-width: none; border-radius: 6px; }
    </style>
    <div id="comparison">
      <div class="panel"><div class="label">Before</div><img src="data:image/png;base64,${before}"></div>
      <div class="panel"><div class="label">After</div><img src="data:image/png;base64,${after}"></div>
    </div>
  `);
  await page.locator('#comparison img').evaluateAll(images => {
    for (const image of images) {
      image.style.width = `${image.naturalWidth / 2}px`;
    }
  });
  await page.locator('#comparison').screenshot({path: outputPath});
}

// Capture pipeline --------------------------------------------------------------

async function capture(planPath, cdpUrl) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  validatePlan(plan);
  const {chromium} = requireFromRepo('playwright');
  const endpoint = new URL(cdpUrl);
  if (!['127.0.0.1', 'localhost'].includes(endpoint.hostname)) {
    throw new Error('CDP must use localhost');
  }

  const targetsUrl = new URL('/json/list', endpoint);
  const targetsResponse = await fetch(targetsUrl);
  if (!targetsResponse.ok) {
    throw new Error(`Could not inspect Chrome CDP targets at ${targetsUrl}`);
  }
  const targets = await targetsResponse.json();
  if (!targets.some(target => target.type === 'page')) {
    const newTargetUrl = new URL('/json/new', endpoint);
    newTargetUrl.search = 'about%3Ablank';
    const newTargetResponse = await fetch(newTargetUrl, {method: 'PUT'});
    if (!newTargetResponse.ok) {
      throw new Error(
        'Dedicated Chrome has no page and a blank target could not be created'
      );
    }
  }

  const browser = await chromium.connectOverCDP(cdpUrl);
  try {
    const context = browser.contexts()[0];
    const page = context?.pages()[0];
    if (!context || !page) {
      throw new Error('Dedicated Chrome has no open page; relaunch it and retry');
    }
    const session = await context.newCDPSession(page);
    await session.send('Security.setIgnoreCertificateErrors', {ignore: true});

    const outputDirectory = path.resolve(
      plan.outputDir ?? '.artifacts/ui-capture',
      safeName(plan.name)
    );
    fs.mkdirSync(outputDirectory, {recursive: true});
    const themes = plan.themes ?? ['light'];
    const viewports = plan.viewports ?? [{name: 'default', width: 1440, height: 1000}];
    const artifacts = [];

    for (const viewport of viewports) {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 2,
        mobile: false,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
      });
      for (const theme of themes) {
        const paths = {};
        for (const version of ['before', 'after']) {
          const expectedUrl = validateUrl(plan[`${version}Url`], plan.target.kind);
          // Sentry's system theme is derived during application bootstrap. Set the
          // browser preference before navigation so theme-sensitive work starts in
          // the intended mode instead of racing an after-mount theme switch.
          await page.emulateMedia({colorScheme: theme});
          await page.goto(expectedUrl.href, {waitUntil: 'domcontentloaded'});
          await page.waitForTimeout(plan.settleMs ?? 1200);
          const assertLocation = () =>
            assertCaptureLocation(page, plan.target.kind, version);
          assertLocation();
          await setTheme(page, theme);
          assertLocation();
          await runActions(page, plan.actions, assertLocation);
          const target = await resolveTarget(page, plan.target);
          await page.waitForTimeout(plan.afterActionMs ?? 500);
          await page.evaluate(() => document.fonts.ready);
          await validateImages(page, target);
          if (plan.target.kind === 'story') {
            await page.waitForLoadState('networkidle', {timeout: 3000}).catch(() => {});
          }
          await page.waitForTimeout(plan.afterImagesMs ?? 1500);
          const screenshotPath = path.join(
            outputDirectory,
            `${version}-${safeName(viewport.name)}-${theme}-2x.png`
          );
          assertLocation();
          await takeScreenshot(page, target, screenshotPath);
          paths[version] = screenshotPath;
        }

        const comparisonPath = path.join(
          outputDirectory,
          `before-after-${safeName(viewport.name)}-${theme}-2x.png`
        );
        await session.send('Emulation.setDeviceMetricsOverride', {
          width: 2000,
          height: 1400,
          deviceScaleFactor: 2,
          mobile: false,
          screenWidth: 2000,
          screenHeight: 1400,
        });
        await compose(page, paths.before, paths.after, comparisonPath, theme);
        artifacts.push({
          viewport: viewport.name,
          theme,
          ...paths,
          comparison: comparisonPath,
        });
      }
    }

    const manifest = {name: plan.name, target: plan.target, artifacts};
    const manifestPath = path.join(outputDirectory, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    process.stdout.write(
      `${JSON.stringify({...manifest, manifest: manifestPath}, null, 2)}\n`
    );
  } finally {
    await browser.close();
  }
}

// Entrypoint --------------------------------------------------------------------

const {values: options} = parseArgs({
  options: {
    plan: {type: 'string'},
    'cdp-url': {type: 'string', default: 'http://127.0.0.1:9222'},
  },
});
if (!options.plan) {
  throw new Error('Usage: capture.mjs --plan <path> [--cdp-url <localhost URL>]');
}
await capture(options.plan, options['cdp-url']);
