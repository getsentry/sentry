#!/usr/bin/env node

/* eslint-disable import/no-nodejs-modules -- This skill helper is a Node.js CLI. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {parseArgs} from 'node:util';

const requireFromRepo = createRequire(path.join(process.cwd(), 'package.json'));
const FEATURE_FLAGS_KEY = 'feature-flag-overrides';

// The agent chooses screenshot scope from the diff; this helper validates and captures.

// Plan validation and customer-data guardrails ---------------------------------

function assertObject(value, description) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
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
  assert(
    ['product', 'story'].includes(plan.target.kind),
    `Unsupported target kind: ${plan.target.kind}`
  );
  assert(typeof plan.name === 'string' && safeName(plan.name), 'Plan name is required');
  validateUrl(plan.beforeUrl, plan.target.kind);
  validateUrl(plan.afterUrl, plan.target.kind);
  assert(
    plan.themes === undefined ||
      (Array.isArray(plan.themes) &&
        plan.themes.length > 0 &&
        plan.themes.every(theme => ['light', 'dark'].includes(theme))),
    'Plan themes must contain light and/or dark values'
  );
  assert(
    plan.viewports === undefined ||
      (Array.isArray(plan.viewports) && plan.viewports.length > 0),
    'Plan viewports must be a non-empty array'
  );
  for (const viewport of plan.viewports ?? []) {
    assertObject(viewport, 'Viewport');
    assert(
      typeof viewport.name === 'string' &&
        safeName(viewport.name) &&
        Number.isInteger(viewport.width) &&
        Number.isInteger(viewport.height) &&
        viewport.width > 0 &&
        viewport.height > 0,
      'Each viewport requires a name and positive integer dimensions'
    );
    assert(
      viewport.containerWidth === undefined ||
        (typeof viewport.containerWidth === 'number' && viewport.containerWidth > 0),
      'Viewport containerWidth must be a positive number'
    );
  }
  assert(
    plan.featureFlags === undefined ||
      (Array.isArray(plan.featureFlags) &&
        plan.featureFlags.every(flag => typeof flag === 'string' && flag)),
    'Plan featureFlags must contain non-empty strings'
  );
}

function safeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Browser state -----------------------------------------------------------------

async function enableFeatureFlags(page, urls, featureFlags, previousValues) {
  if (!featureFlags?.length) {
    return;
  }
  const origins = new Set(urls.map(value => new URL(value).origin));
  for (const origin of origins) {
    await page.goto(`${origin}/`, {waitUntil: 'domcontentloaded'});
    assert(new URL(page.url()).origin === origin, `Feature flag setup left ${origin}`);
    const previousValue = await page.evaluate(
      ({flags, storageKey}) => {
        const previous = localStorage.getItem(storageKey);
        let overrides = {};
        try {
          const stored = JSON.parse(previous ?? '{}');
          if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
            overrides = stored;
          }
        } catch {
          // Replace invalid capture state, then restore it exactly.
        }
        for (const flag of flags) {
          overrides[flag] = true;
        }
        localStorage.setItem(storageKey, JSON.stringify(overrides));
        return previous;
      },
      {flags: featureFlags, storageKey: FEATURE_FLAGS_KEY}
    );
    previousValues.push({origin, previousValue});
  }
}

async function restoreFeatureFlags(page, previousValues) {
  for (const {origin, previousValue} of previousValues) {
    await page.goto(`${origin}/`, {waitUntil: 'domcontentloaded'});
    await page.evaluate(
      ({storageKey, value}) => {
        if (value === null) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, value);
        }
      },
      {storageKey: FEATURE_FLAGS_KEY, value: previousValue}
    );
  }
}

async function setTheme(page, theme) {
  const switcher = page.getByRole('button', {
    name: /Switch to (Light|Dark) Mode/,
  });
  await switcher
    .first()
    .waitFor({state: 'visible', timeout: 5000})
    .catch(() => {});
  if ((await switcher.count()) !== 1 || !(await switcher.isVisible())) {
    return;
  }
  const switchesToLight = (await switcher.getAttribute('aria-label'))?.includes('Light');
  if ((theme === 'light') === switchesToLight) {
    await switcher.click();
  }
}

function accessibleLocator(page, descriptor) {
  assertObject(descriptor, 'Accessible locator');
  if ('selector' in descriptor) {
    throw new Error('CSS selectors are not accepted; use an accessible role or label');
  }
  if (typeof descriptor.label === 'string' && descriptor.label) {
    return page.getByLabel(descriptor.label, {exact: true});
  }
  if (typeof descriptor.role === 'string' && descriptor.role) {
    return page.getByRole(descriptor.role, {
      name: descriptor.name,
      exact: true,
    });
  }
  throw new Error('Accessible locators require a label or role');
}

async function runActions(page, actions, assertLocation) {
  for (const action of actions ?? []) {
    assertObject(action, 'Action');
    if (action.kind === 'press') {
      if (typeof action.key !== 'string' || !action.key) {
        throw new Error('Press actions require a key');
      }
      await page.keyboard.press(action.key);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      assertLocation();
      continue;
    }
    if (!['click', 'fill'].includes(action.kind)) {
      throw new Error(`Unsupported action kind: ${action.kind}`);
    }
    if (action.kind === 'fill' && typeof action.value !== 'string') {
      throw new Error('Fill actions require a string value');
    }
    if (!action.label && (typeof action.name !== 'string' || !action.name)) {
      throw new Error(`${action.kind} actions using a role also require a name`);
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
  const actualWidth = await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      box.width -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight) -
      parseFloat(style.borderLeftWidth) -
      parseFloat(style.borderRightWidth)
    );
  });
  if (Math.abs(actualWidth - expectedWidth) > 1) {
    throw new Error(
      `Expected container width ${expectedWidth}px, but rendered ${actualWidth}px`
    );
  }
  return actualWidth;
}

async function rejectKnownInvalidState(page) {
  const hasClientError = await page
    .getByText('Oops! Something went wrong', {exact: true})
    .evaluateAll(elements => elements.some(element => element.checkVisibility()));
  if (hasClientError) {
    throw new Error('Sentry rendered its client error page');
  }
}

async function resolveTarget(page, target) {
  if (target.kind === 'product') {
    return null;
  }
  const heading = target.heading
    ? page.getByRole('heading', {name: target.heading, exact: true})
    : null;
  const locator = heading
    ? heading.locator('xpath=ancestor::section[1]')
    : page.getByRole('main');
  await (heading ?? locator).first().waitFor({state: 'visible', timeout: 30000});
  if ((await locator.count()) !== 1) {
    throw new Error(
      target.heading
        ? `Expected one story section headed ${target.heading}`
        : 'Expected one Scraps main region'
    );
  }
  await locator.scrollIntoViewIfNeeded();
  return locator;
}

async function validateImages(page, target) {
  const images = target?.locator('img') ?? page.locator('img');
  const broken = await images.evaluateAll(async (allImages, viewportOnly) => {
    const selected = viewportOnly
      ? allImages.filter(image => {
          const box = image.getBoundingClientRect();
          return (
            box.right >= 0 &&
            box.left <= window.innerWidth &&
            box.bottom >= 0 &&
            box.top <= window.innerHeight
          );
        })
      : allImages;
    await Promise.race([
      Promise.allSettled(selected.map(image => image.decode())),
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);
    return selected
      .filter(image => !image.complete || image.naturalWidth === 0)
      .map(image => image.alt || image.currentSrc || image.src);
  }, target === null);
  if (broken.length) {
    throw new Error(`Broken images in capture target: ${broken.join(', ')}`);
  }
}

// Capture pipeline --------------------------------------------------------------

async function capture(planPath, profileDirectory) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  validatePlan(plan);
  const {chromium} = requireFromRepo('playwright');
  const context = await chromium.launchPersistentContext(profileDirectory, {
    channel: 'chrome',
    headless: true,
    ignoreHTTPSErrors: true,
    viewport: null,
  });
  let page;
  const featureFlagState = [];
  try {
    page = context.pages()[0] ?? (await context.newPage());
    await page.clock.setFixedTime(new Date());
    const session = await context.newCDPSession(page);
    await session.send('Security.setIgnoreCertificateErrors', {ignore: true});
    await enableFeatureFlags(
      page,
      [plan.beforeUrl, plan.afterUrl],
      plan.featureFlags,
      featureFlagState
    );

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
          const target = await resolveTarget(page, plan.target);
          await page.evaluate(() => document.fonts.ready);
          await validateImages(page, target);
          await page.waitForTimeout(2500);
          const screenshotPath = path.join(
            outputDirectory,
            `${version}-${safeName(viewport.name)}-${theme}-2x.png`
          );
          assertLocation();
          if (target) {
            await target.screenshot({path: screenshotPath});
          } else {
            await page.screenshot({path: screenshotPath, fullPage: false});
          }
          paths[version] = screenshotPath;
          paths[`${version}ContainerWidth`] = containerWidth;
        }

        artifacts.push({
          viewport: viewport.name,
          theme,
          ...paths,
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
        await restoreFeatureFlags(page, featureFlagState);
      }
    } finally {
      await page?.close().catch(() => {});
      await context.close();
    }
  }
}

// Entrypoint --------------------------------------------------------------------

const {values: options} = parseArgs({
  options: {
    plan: {type: 'string'},
    'profile-directory': {
      type: 'string',
      default: path.join(os.homedir(), '.sentry-ui-capture-chrome'),
    },
  },
});
if (!options.plan) {
  throw new Error('Usage: capture.mjs --plan <path> [--profile-directory <path>]');
}
await capture(options.plan, options['profile-directory']);
