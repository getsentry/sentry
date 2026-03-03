// eslint-disable-next-line import/no-nodejs-modules
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
// eslint-disable-next-line import/no-nodejs-modules
import path from 'node:path';

import {createElement, type ReactElement} from 'react';
import {renderToString} from 'react-dom/server';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import {chromium} from 'playwright';

import type {SnapshotImageMetadata} from 'sentry-test/snapshots/snapshot-image-metadata';

// eslint-disable-next-line no-restricted-imports -- SSR rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

export interface SnapshotOptions {
  theme?: 'light' | 'dark';
}

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

function renderToHTML(element: ReactElement, themeName: 'light' | 'dark'): string {
  const cache = createCache({key: 'snap'});
  const {extractCriticalToChunks, constructStyleTagsFromChunks} =
    createEmotionServer(cache);

  const theme = themeName === 'dark' ? darkTheme : lightTheme;

  const wrapped = createElement(
    CacheProvider,
    {value: cache},
    // @ts-expect-error -- ThemeProvider types require children in props, but createElement accepts children as the third arg
    createElement(ThemeProvider, {theme}, element)
  );

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
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
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
  return path.resolve(PROJECT_ROOT, '.artifacts/visual-snapshots');
}

let _browserPromise: ReturnType<typeof chromium.connect> | null = null;

function getBrowser(): ReturnType<typeof chromium.connect> {
  if (!_browserPromise) {
    const wsEndpoint = process.env.__SNAPSHOT_BROWSER_WS__;
    if (!wsEndpoint) {
      throw new Error(
        'Playwright browser WebSocket endpoint not found. ' +
          'Ensure snapshot-globalSetup.ts is configured in jest.config.snapshots.ts'
      );
    }
    _browserPromise = chromium.connect(wsEndpoint);
  }
  return _browserPromise;
}

export async function takeSnapshot(
  name: string,
  renderFn: () => ReactElement,
  options: SnapshotOptions,
  testFilePath: string
): Promise<void> {
  const themeName = options.theme ?? 'light';
  const element = renderFn();
  const fullHTML = renderToHTML(element, themeName);

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
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '-');
    const coreFilename = `${sanitizedName}-${themeName}`;
    const imageFilename = `${coreFilename}.png`;

    const outputDir = path.join(getOutputDir(), dirOfTestFile);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, {recursive: true});
    }

    // PNG width/height are stored as 4-byte big-endian integers at offsets 16 and 20
    const width = screenshot.readUInt32BE(16);
    const height = screenshot.readUInt32BE(20);
    const metadata: SnapshotImageMetadata = {
      display_name: name,
      image_file_name: imageFilename,
      width,
      height,
      // Dump additional options as metadata
      ...options,
    };
    writeFileSync(path.join(outputDir, imageFilename), screenshot);
    writeFileSync(
      path.join(outputDir, `${coreFilename}.json`),
      JSON.stringify(metadata, null, 2)
    );
  } finally {
    await context.close();
  }
}
