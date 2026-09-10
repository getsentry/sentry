/* eslint-disable import/no-nodejs-modules */
import {existsSync, mkdirSync} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import {createElement, type ReactElement} from 'react';
import * as ReactDOM from 'react-dom/client';
import {RouterProvider, useRouteError, type RouteObject} from 'react-router-dom';
import createCache from '@emotion/cache';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {createMemoryHistory, createRouter, type InitialEntry} from '@remix-run/router';
import {QueryClientProvider} from '@tanstack/react-query';
import {act} from '@testing-library/react'; // eslint-disable-line no-restricted-imports

import {GlobalDrawer} from '@sentry/scraps/drawer';

import {CommandPaletteProvider} from 'sentry/components/commandPalette/ui/cmdk';
import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {ProvideAriaRouter} from 'sentry/utils/provideAriaRouter';
// eslint-disable-next-line no-restricted-imports -- page snapshots need direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {GlobalAlertProvider} from 'sentry/views/app/globalAlerts';
import {LLMContextProvider} from 'sentry/views/seerExplorer/contexts/llmContext';

import {initializeOrg} from '../initializeOrg';
import {SentryNuqsTestingAdapter} from '../nuqsTestingAdapter';
import {makeTestQueryClient} from '../queryClient';
import {ScrapsTestingProviders} from '../scrapsTestingProviders';

import type {
  SnapshotImageMetadata,
  SnapshotTestMetadata,
} from './snapshot-image-metadata';

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

export interface PageSnapshotConfig {
  theme: 'light' | 'dark';
  features?: string[];
  organization?: Partial<Organization>;
  route?: string;
  routes?: string[];
  startUrl?: string;
}

interface PageSnapshotViewport {
  label: string;
  width: number;
  height?: number;
}

export interface TakePageSnapshotOptions {
  config: PageSnapshotConfig;
  name: string;
  renderFn: () => ReactElement;
  viewport: PageSnapshotViewport;
  metadata?: SnapshotTestMetadata;
}

export async function takePageSnapshot({
  name,
  renderFn,
  config,
  viewport,
  metadata = {},
}: TakePageSnapshotOptions): Promise<void> {
  // speedy: false forces Emotion to write CSS as text nodes in <style> tags
  // instead of using CSSStyleSheet.insertRule (CSSOM). This makes the CSS
  // serializable via outerHTML for the Playwright screenshot.
  const cache = createCache({key: 'snap', speedy: false});

  const theme = config.theme === 'dark' ? darkTheme : lightTheme;

  const orgFeatures = config.features ?? [];
  const {organization} = initializeOrg({
    organization: {
      ...config.organization,
      features: [...(config.organization?.features ?? []), ...orgFeatures],
    },
  });

  const queryClient = makeTestQueryClient();
  const initialEntry: InitialEntry = config.startUrl ?? '/organizations/org-slug/issues/';

  function ErrorBoundary(): React.ReactNode {
    throw useRouteError();
  }

  const routePaths = config.routes ?? (config.route ? [config.route] : ['*']);
  const childRoutes: RouteObject[] = routePaths.map(routePath => ({
    path: routePath,
    element: createElement(PageWrapper, null, renderFn()),
    errorElement: createElement(ErrorBoundary),
  }));
  childRoutes.push({
    path: '*',
    element: createElement('div', null, 'No route matched'),
    errorElement: createElement(ErrorBoundary),
  });

  function PageWrapper({children}: {children: React.ReactNode}) {
    return (
      <CacheProvider value={cache}>
        <QueryClientProvider client={queryClient}>
          <SentryNuqsTestingAdapter defaultOptions={{shallow: false}}>
            <ScrapsTestingProviders>
              <CommandPaletteProvider>
                <ThemeProvider theme={theme}>
                  <ProvideAriaRouter>
                    <LLMContextProvider>
                      <OrganizationContext value={organization}>
                        <GlobalAlertProvider>
                          <GlobalDrawer>{children}</GlobalDrawer>
                        </GlobalAlertProvider>
                      </OrganizationContext>
                    </LLMContextProvider>
                  </ProvideAriaRouter>
                </ThemeProvider>
              </CommandPaletteProvider>
            </ScrapsTestingProviders>
          </SentryNuqsTestingAdapter>
        </QueryClientProvider>
      </CacheProvider>
    );
  }

  const history = createMemoryHistory({initialEntries: [initialEntry]});
  const router = createRouter({
    future: {v7_prependBasename: true, v7_relativeSplatPath: true},
    history,
    routes: childRoutes,
  }).initialize();

  const container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);

  let root: ReactDOM.Root | null = null;
  await act(async () => {
    root = ReactDOM.createRoot(container);
    root.render(
      createElement(RouterProvider, {router, future: {v7_startTransition: true}})
    );
  });

  // Wait for async data to settle. Pages fire cascading fetches
  // (e.g. issues → stats). Require 3 consecutive stable ticks after a
  // minimum of 10 ticks to catch secondary requests and their re-renders.
  let prevHTML = '';
  let stableCount = 0;
  for (let i = 0; i < 40; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    const currentHTML = container.innerHTML;
    if (currentHTML === prevHTML) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    if (stableCount >= 3 && i >= 10) {
      break;
    }
    prevHTML = currentHTML;
  }

  const rootHTML = container.innerHTML;

  // Extract Emotion CSS from jsdom's <style> tags. With speedy: false,
  // Emotion writes CSS as text nodes inside <style data-emotion="..."> tags.
  const emotionStyles: string[] = [];
  // eslint-disable-next-line testing-library/no-node-access
  document.querySelectorAll('style[data-emotion]').forEach(tag => {
    emotionStyles.push(tag.outerHTML);
  });

  const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${getFontFaceCSS()}</style>
  ${emotionStyles.join('\n')}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; animation: none !important; transition: none !important; }
    body { font-family: 'Rubik', sans-serif; background: ${config.theme === 'dark' ? '#1B1025' : '#fff'}; color: ${config.theme === 'dark' ? '#EBE6EF' : '#3E2723'}; }
    #root { display: block; }
  </style>
</head>
<body>
  <div id="root">${rootHTML}</div>
</body>
</html>`;

  await act(async () => {
    root?.unmount();
  });
  container.remove();

  // Lazy-load Playwright to avoid top-level import issues in jsdom
  const {chromium} = await import('playwright');
  const browser = await getBrowserInstance(chromium);
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: {width: viewport.width, height: viewport.height ?? 900},
  });

  try {
    const page = await context.newPage();
    await page.setContent(fullHTML, {waitUntil: 'load'});
    await page.evaluate(() => document.fonts.ready);

    const rootElement = page.locator('#root');
    const screenshot = await rootElement.screenshot({type: 'png', omitBackground: false});

    const {testPath} = expect.getState();
    if (!testPath) {
      throw new Error('Could not determine test file path');
    }

    const relativePath = path.relative(PROJECT_ROOT, testPath);
    const dirOfTestFile = path.dirname(relativePath);
    const fileSlug = `${config.theme}-${name}-${viewport.label}`
      .replace(/[^\w.-]/g, '-')
      .toLowerCase();

    const outputDir = path.join(getOutputDir(), dirOfTestFile);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, {recursive: true});
    }

    const tags: Record<string, string> = {
      theme: config.theme,
      viewport: viewport.label,
      area: 'page',
      ...metadata.tags,
    };

    const meta: SnapshotImageMetadata = {
      display_name:
        metadata.display_name ?? `${name} (${config.theme}, ${viewport.label})`,
      group: metadata.group ?? name,
      tags,
      canvas_theme: config.theme,
      context: {test_file_path: relativePath},
    };

    await Promise.all([
      fs.writeFile(path.join(outputDir, `${fileSlug}.png`), screenshot),
      fs.writeFile(
        path.join(outputDir, `${fileSlug}.json`),
        JSON.stringify(meta, null, 2)
      ),
    ]);
  } finally {
    await context.close();
  }
}

function getOutputDir(): string {
  if (process.env.SNAPSHOT_OUTPUT_DIR) {
    return path.resolve(process.env.SNAPSHOT_OUTPUT_DIR);
  }
  return path.resolve(PROJECT_ROOT, '.artifacts/page-snapshots');
}

let _browser: any = null;
async function getBrowserInstance(chromium: any) {
  if (!_browser) {
    _browser = await chromium.launch({
      args: ['--font-render-hinting=none', '--disable-skia-runtime-opts'],
    });
  }
  return _browser;
}

export async function closePageBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
