#!/usr/bin/env node

/* eslint-disable import/no-nodejs-modules -- This skill helper is a Node.js CLI. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import process from 'node:process';
import {parseArgs} from 'node:util';

const requireFromRepo = createRequire(path.join(process.cwd(), 'package.json'));
const FEATURE_FLAGS_KEY = 'feature-flag-overrides';
const FEATURE_FLAGS_BACKUP_KEY = '__sentry_ui_capture_feature_flags__';

// This helper deliberately does not decide what deserves a screenshot. The agent
// reads the diff and builds a plan; this script only performs repeatable safety
// validation, browser capture, and before/after composition.

// Plan validation and customer-data guardrails ---------------------------------

function assertObject(value, description) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object`);
  }
}

function validateLocatorDescriptor(descriptor, description) {
  assertObject(descriptor, description);
  if ('selector' in descriptor) {
    throw new Error(`${description} must use an accessible role or label`);
  }
  const usesLabel = typeof descriptor.label === 'string' && descriptor.label;
  const usesRole = typeof descriptor.role === 'string' && descriptor.role;
  if (!usesLabel && !usesRole) {
    throw new Error(`${description} requires a label or role`);
  }
  if (descriptor.exact !== undefined && typeof descriptor.exact !== 'boolean') {
    throw new Error(`${description} exact must be a boolean`);
  }
}

function validateUrl(value, targetKind) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid capture URL: ${value}`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`Capture URL must use HTTPS: ${value}`);
  }
  if (url.username || url.password) {
    throw new Error('Capture URLs must not contain credentials');
  }
  if (url.hostname !== 'demo.dev.getsentry.net') {
    throw new Error(`Captures must use the demo organization hostname: ${value}`);
  }
  if (targetKind === 'story' && !url.pathname.startsWith('/scraps/')) {
    throw new Error(`Story captures must use the demo Scraps route: ${value}`);
  }
  return url;
}

function assertCaptureLocation(page, expectedUrl, targetKind, stage) {
  const current = new URL(page.url());
  if (current.pathname.startsWith('/auth/login/')) {
    throw new Error(`${stage} redirected to login; refresh the dedicated Chrome session`);
  }
  if (current.origin !== expectedUrl.origin) {
    throw new Error(`${stage} left the planned local origin: ${current.href}`);
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
  if (
    plan.target.heading !== undefined &&
    (plan.target.kind !== 'story' ||
      typeof plan.target.heading !== 'string' ||
      !plan.target.heading)
  ) {
    throw new Error('A target heading must be a non-empty string for a story');
  }
  if (typeof plan.name !== 'string' || !safeName(plan.name)) {
    throw new Error('Plan name is required');
  }
  validateUrl(plan.beforeUrl, plan.target.kind);
  validateUrl(plan.afterUrl, plan.target.kind);
  if (
    plan.themes !== undefined &&
    (!Array.isArray(plan.themes) ||
      plan.themes.length === 0 ||
      plan.themes.some(theme => !['light', 'dark'].includes(theme)) ||
      new Set(plan.themes).size !== plan.themes.length)
  ) {
    throw new Error('Plan themes must contain unique light and/or dark values');
  }
  if (
    plan.viewports !== undefined &&
    (!Array.isArray(plan.viewports) || plan.viewports.length === 0)
  ) {
    throw new Error('Plan viewports must be a non-empty array');
  }
  const viewportNames = new Set();
  for (const viewport of plan.viewports ?? []) {
    if (
      typeof viewport.name !== 'string' ||
      !safeName(viewport.name) ||
      !Number.isInteger(viewport.width) ||
      !Number.isInteger(viewport.height) ||
      viewport.width <= 0 ||
      viewport.height <= 0
    ) {
      throw new Error('Each viewport requires a name and positive integer dimensions');
    }
    if (
      viewport.containerWidth !== undefined &&
      (typeof viewport.containerWidth !== 'number' || viewport.containerWidth <= 0)
    ) {
      throw new Error('Viewport containerWidth must be a positive number');
    }
    const name = safeName(viewport.name);
    if (viewportNames.has(name)) {
      throw new Error(`Viewport names must be unique after normalization: ${name}`);
    }
    viewportNames.add(name);
  }
  if (plan.actions !== undefined && !Array.isArray(plan.actions)) {
    throw new Error('Plan actions must be an array');
  }
  for (const action of plan.actions ?? []) {
    assertObject(action, 'Action');
    if (!['click', 'fill', 'press', 'wait'].includes(action.kind)) {
      throw new Error(`Unsupported action kind: ${action.kind}`);
    }
    if ('selector' in action) {
      throw new Error('CSS selectors are not accepted; use accessible roles or labels');
    }
    if (action.exact !== undefined && typeof action.exact !== 'boolean') {
      throw new Error('Action exact must be a boolean');
    }
    if (action.kind === 'wait') {
      if (!Number.isInteger(action.ms) || action.ms < 0) {
        throw new Error('Wait actions require a non-negative integer ms');
      }
    } else if (action.kind === 'press') {
      if (typeof action.key !== 'string' || !action.key) {
        throw new Error('Press actions require a key');
      }
    } else {
      validateLocatorDescriptor(action, `${action.kind} action`);
      if (!action.label && (typeof action.name !== 'string' || !action.name)) {
        throw new Error(`${action.kind} actions using a role also require a name`);
      }
      if (action.kind === 'fill' && typeof action.value !== 'string') {
        throw new Error('Fill actions require a string value');
      }
    }
  }
  if (
    plan.featureFlags !== undefined &&
    (!Array.isArray(plan.featureFlags) ||
      new Set(plan.featureFlags).size !== plan.featureFlags.length ||
      plan.featureFlags.some(flag => typeof flag !== 'string' || !flag))
  ) {
    throw new Error('Plan featureFlags must contain unique non-empty strings');
  }
  if (plan.container !== undefined) {
    validateLocatorDescriptor(plan.container, 'Plan container');
  }
}

function safeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Browser state -----------------------------------------------------------------

async function enableFeatureFlags(page, featureFlags) {
  if (!featureFlags?.length) {
    return;
  }
  await page.addInitScript(
    ({backupKey, featureFlags: flags, storageKey}) => {
      if (sessionStorage.getItem(backupKey) === null) {
        sessionStorage.setItem(
          backupKey,
          JSON.stringify(localStorage.getItem(storageKey))
        );
      }
      let overrides = {};
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
          overrides = stored;
        }
      } catch {
        // Replace an invalid override value for this capture, then restore it exactly.
      }
      for (const flag of flags) {
        overrides[flag] = true;
      }
      localStorage.setItem(storageKey, JSON.stringify(overrides));
    },
    {
      backupKey: FEATURE_FLAGS_BACKUP_KEY,
      featureFlags,
      storageKey: FEATURE_FLAGS_KEY,
    }
  );
}

async function restoreFeatureFlags(page, urls, featureFlags) {
  if (!featureFlags?.length) {
    return;
  }
  const origins = new Set(urls.map(value => new URL(value).origin));
  for (const origin of origins) {
    await page.goto(`${origin}/`, {waitUntil: 'domcontentloaded'});
    await page.evaluate(
      ({backupKey, storageKey}) => {
        const backup = sessionStorage.getItem(backupKey);
        if (backup === null) {
          return;
        }
        const previousValue = JSON.parse(backup);
        if (previousValue === null) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, previousValue);
        }
        sessionStorage.removeItem(backupKey);
      },
      {backupKey: FEATURE_FLAGS_BACKUP_KEY, storageKey: FEATURE_FLAGS_KEY}
    );
  }
}

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

function accessibleLocator(page, descriptor) {
  return descriptor.label
    ? page.getByLabel(descriptor.label, {exact: descriptor.exact ?? true})
    : page.getByRole(descriptor.role, {
        name: descriptor.name,
        exact: descriptor.exact ?? true,
      });
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
    const locator = accessibleLocator(page, action);
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

async function verifyContainerWidth(page, container, expectedWidth) {
  if (expectedWidth === undefined) {
    return undefined;
  }
  const locator = accessibleLocator(page, container ?? {role: 'main'});
  if ((await locator.count()) !== 1 || !(await locator.isVisible())) {
    throw new Error('Container width target did not resolve to one visible element');
  }
  const actualWidth = await locator.evaluate(
    element => element.getBoundingClientRect().width
  );
  if (Math.abs(actualWidth - expectedWidth) > 1) {
    throw new Error(
      `Expected container width ${expectedWidth}px, but rendered ${actualWidth}px`
    );
  }
  return actualWidth;
}

async function rejectKnownInvalidState(page) {
  const clientError = page.getByText('Oops! Something went wrong', {
    exact: true,
  });
  for (let index = 0; index < (await clientError.count()); index++) {
    if (await clientError.nth(index).isVisible()) {
      throw new Error('Sentry rendered its client error page');
    }
  }
}

// Story captures use the section around an accessible heading. Product captures
// intentionally keep the viewport so reviewers can see modal/drawer surroundings.
async function storySectionClip(page, headingName) {
  const heading = page.getByRole('heading', {name: headingName, exact: true});
  await heading.first().waitFor({state: 'visible', timeout: 30000});
  if ((await heading.count()) !== 1) {
    throw new Error(`Expected exactly one story heading named ${headingName}`);
  }
  await heading.scrollIntoViewIfNeeded();
  await page.evaluate(
    element =>
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 96),
    await heading.elementHandle()
  );
  return heading.evaluate(element => {
    const root = element.closest('section');
    if (!root) {
      throw new Error('Story heading has no section ancestor');
    }
    const children = [...root.children];
    const start = children.findIndex(child => child.contains(element));
    if (start === -1) {
      throw new Error('Story heading is not contained by a direct section child');
    }
    const selected = [];
    for (const child of children.slice(start)) {
      const containsHeading =
        child.matches('h1,h2,h3,h4,h5,h6') || child.querySelector('h1,h2,h3,h4,h5,h6');
      if (selected.length > 0 && containsHeading) {
        break;
      }
      if (child.classList.contains('expressive-code')) {
        break;
      }
      selected.push(child);
    }
    const boxes = selected.map(child => child.getBoundingClientRect());
    const x = Math.max(0, Math.min(...boxes.map(box => box.left)) - 16);
    const y = Math.max(0, Math.min(...boxes.map(box => box.top)) - 16);
    const right = Math.min(
      window.innerWidth,
      Math.max(...boxes.map(box => box.right)) + 16
    );
    const bottom = Math.max(...boxes.map(box => box.bottom)) + 16;
    return {x, y, width: right - x, height: bottom - y};
  });
}

async function resolveTarget(page, target) {
  if (target.kind === 'story') {
    if (target.heading) {
      return {
        clip: await storySectionClip(page, target.heading),
        locator: null,
      };
    }
    const locator = page.getByRole('main');
    await locator.first().waitFor({state: 'visible', timeout: 30000});
    if ((await locator.count()) !== 1) {
      throw new Error('Expected exactly one Scraps main region');
    }
    return {clip: null, locator};
  }
  return {clip: null, locator: null};
}

async function validateImages(page, target) {
  const locator = target.locator?.locator('img') ?? page.locator('img');
  const region =
    target.clip ??
    (target.locator
      ? null
      : await page.evaluate(() => ({
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        })));
  const states = await locator.evaluateAll(async (images, captureRegion) => {
    const selected = captureRegion
      ? images.filter(image => {
          const box = image.getBoundingClientRect();
          return (
            box.right >= captureRegion.x &&
            box.left <= captureRegion.x + captureRegion.width &&
            box.bottom >= captureRegion.y &&
            box.top <= captureRegion.y + captureRegion.height
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
  }, region);
  const broken = states.filter(state => !state.complete || state.naturalWidth === 0);
  if (broken.length) {
    throw new Error(
      `Broken images in capture target: ${broken
        .map(image => image.alt || image.src)
        .join(', ')}`
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
  if (
    endpoint.protocol !== 'http:' ||
    endpoint.username ||
    endpoint.password ||
    !['127.0.0.1', 'localhost'].includes(endpoint.hostname)
  ) {
    throw new Error('CDP must use localhost');
  }

  const browser = await chromium.connectOverCDP(cdpUrl);
  let page;
  try {
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error('Dedicated Chrome has no persistent browser context');
    }
    page = await context.newPage();
    await page.clock.setFixedTime(new Date());
    await enableFeatureFlags(page, plan.featureFlags);
    const session = await context.newCDPSession(page);
    await session.send('Security.setIgnoreCertificateErrors', {ignore: true});

    const outputDirectory = path.resolve('.artifacts/ui-capture', safeName(plan.name));
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
          await page.waitForTimeout(1200);
          const assertLocation = () =>
            assertCaptureLocation(page, expectedUrl, plan.target.kind, version);
          assertLocation();
          await setTheme(page, theme);
          assertLocation();
          await runActions(page, plan.actions, assertLocation);
          await rejectKnownInvalidState(page);
          const containerWidth = await verifyContainerWidth(
            page,
            plan.container,
            viewport.containerWidth
          );
          let target = await resolveTarget(page, plan.target);
          await page.waitForTimeout(500);
          await page.evaluate(() => document.fonts.ready);
          await validateImages(page, target);
          if (plan.target.kind === 'story') {
            await page.waitForLoadState('networkidle', {timeout: 3000}).catch(() => {});
          }
          await page.waitForTimeout(1500);
          if (target.clip) {
            target = await resolveTarget(page, plan.target);
          }
          const screenshotPath = path.join(
            outputDirectory,
            `${version}-${safeName(viewport.name)}-${theme}-2x.png`
          );
          assertLocation();
          await takeScreenshot(page, target, screenshotPath);
          paths[version] = screenshotPath;
          paths[`${version}ContainerWidth`] = containerWidth;
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
    try {
      if (page) {
        await restoreFeatureFlags(
          page,
          [plan.beforeUrl, plan.afterUrl],
          plan.featureFlags
        );
      }
    } finally {
      try {
        await page?.close();
      } finally {
        await browser.close();
      }
    }
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
