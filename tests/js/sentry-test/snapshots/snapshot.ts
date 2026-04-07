/* eslint-disable import/no-nodejs-modules */
import {existsSync, mkdirSync} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import {createElement, type ReactElement} from 'react';
import {renderToString} from 'react-dom/server';
import createCache from '@emotion/cache';
import {CacheProvider} from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import {chromium, type Browser} from 'playwright';

import type {SnapshotImageMetadata} from 'sentry-test/snapshots/snapshot-image-metadata';

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const FONTS_DIR = path.resolve(PROJECT_ROOT, 'static/fonts');

function getFontFaceCSS(): string {
  return `
    @font-face {
      font-family: 'Rubik';
      font-style: normal;
      font-weight: 400;
      src: url('file://${FONTS_DIR}/rubik-regular.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Rubik';
      font-style: normal;
      font-weight: 500 600;
      src: url('file://${FONTS_DIR}/rubik-medium.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Roboto Mono';
      font-style: normal;
      font-weight: 425 600;
      src: url('file://${FONTS_DIR}/roboto-mono-variable.woff2') format('woff2');
    }
  `;
}

function renderToHTML(element: ReactElement): string {
  const cache = createCache({key: 'snap'});
  const {extractCriticalToChunks, constructStyleTagsFromChunks} =
    createEmotionServer(cache);

  const wrapped = createElement(CacheProvider, {value: cache}, element);
  const html = renderToString(wrapped);
  const chunks = extractCriticalToChunks(html);
  const styleTags = constructStyleTagsFromChunks(chunks);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${getFontFaceCSS()}</style>
  ${styleTags}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; animation: none !important; transition: none !important; }
    body { font-family: 'Rubik', sans-serif; background: transparent; }
    #root { display: inline-block; }
  </style>
</head>
<body>
  <div id="root">${html}</div>
</body>
</html>`;
}

function getOutputDir(): string {
  if (process.env.SNAPSHOT_OUTPUT_DIR) {
    return path.resolve(process.env.SNAPSHOT_OUTPUT_DIR);
  }
  return path.resolve(PROJECT_ROOT, '.artifacts/snapshots');
}

let _browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!_browserPromise) {
    _browserPromise = chromium
      .launch({
        args: ['--font-render-hinting=none', '--disable-skia-runtime-opts'],
      })
      .catch(err => {
        _browserPromise = null;
        throw err;
      });
  }
  return _browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (_browserPromise) {
    const browser = await _browserPromise;
    _browserPromise = null;
    await browser.close();
  }
}

interface TakeSnapshotOptions {
  displayName: string;
  fileSlug: string;
  group: string | null;
  metadata: Record<string, string>;
  renderFn: () => ReactElement;
  testFilePath: string;
}

export async function takeSnapshot({
  fileSlug,
  displayName,
  renderFn,
  testFilePath,
  group,
  metadata,
}: TakeSnapshotOptions): Promise<void> {
  const element = renderFn();
  const fullHTML = renderToHTML(element);

  const browser = await getBrowser();
  const context = await browser.newContext({
    deviceScaleFactor: 2,
  });

  try {
    const page = await context.newPage();
    await page.setContent(fullHTML, {waitUntil: 'load'});

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    const rootElement = page.locator('#root');
    const screenshot = await rootElement.screenshot({type: 'png', omitBackground: true});

    const relativePath = path.relative(PROJECT_ROOT, testFilePath);
    const dirOfTestFile = path.dirname(relativePath);
    const coreFilename = fileSlug.replace(/[^\w-]/g, '-');
    const imageFilename = `${coreFilename}.png`;

    const outputDir = path.join(getOutputDir(), dirOfTestFile);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, {recursive: true});
    }

    const meta: SnapshotImageMetadata = {
      display_name: displayName,
      group,
      ...metadata,
    };

    await Promise.all([
      fs.writeFile(path.join(outputDir, imageFilename), screenshot),
      fs.writeFile(
        path.join(outputDir, `${coreFilename}.json`),
        JSON.stringify(meta, null, 2)
      ),
    ]);
  } finally {
    await context.close();
  }
}
