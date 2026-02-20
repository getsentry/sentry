/* eslint-disable boundaries/element-types */
import path from 'node:path';

import react from '@vitejs/plugin-react-swc';
import {defineConfig} from 'vitest/config';

import jestCompatPlugin from './tests/js/vite-jest-compat-plugin';
import pegjsPlugin from './tests/js/vite-pegjs-plugin';

const ROOT = import.meta.dirname;

const IS_GITHUB_ACTION_ENV = !!process.env.GITHUB_ACTIONS;
// Must be set before Vitest workers initialize so plain `vitest run ...` uses
// the same timezone as Jest.
process.env.TZ = 'America/New_York';

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      plugins: [['@swc/plugin-emotion', {sourceMap: false, autoLabel: 'never'}]],
      devTarget: 'esnext',
    }),
    pegjsPlugin(),
    jestCompatPlugin(),
  ],
  resolve: {
    // Reduce extension probing work for extensionless imports.
    // Keep common JS/TS extensions used in this repo and node deps.
    extensions: ['.tsx', '.ts', '.js', '.json'],
    alias: [
      // Mirror moduleNameMapper from jest.config.ts
      {find: /^sentry\/(.*)/, replacement: path.resolve(ROOT, 'static/app/$1')},
      {
        find: /^@sentry\/scraps\/(.*)/,
        replacement: path.resolve(ROOT, 'static/app/components/core/$1'),
      },
      {find: /^getsentry\/(.*)/, replacement: path.resolve(ROOT, 'static/gsApp/$1')},
      {find: /^admin\/(.*)/, replacement: path.resolve(ROOT, 'static/gsAdmin/$1')},
      {
        find: /^sentry-fixture\/(.*)/,
        replacement: path.resolve(ROOT, 'tests/js/fixtures/$1'),
      },
      {
        find: /^sentry-test\/(.*)/,
        replacement: path.resolve(ROOT, 'tests/js/sentry-test/$1'),
      },
      {
        find: /^getsentry-test\/(.*)/,
        replacement: path.resolve(ROOT, 'tests/js/getsentry-test/$1'),
      },
      {
        find: /^sentry-locale\/(.*)/,
        replacement: path.resolve(ROOT, 'src/sentry/locale/$1'),
      },

      // Asset / style mocks (replaces moduleNameMapper patterns from Jest)
      // Also match CSS imports from node_modules (e.g. react-date-range/dist/styles.css)
      // These must come BEFORE image/logo path aliases so that e.g. sentry-logos/*.svg
      // is intercepted here rather than resolving to a real file that jsdom can't load.
      // NOTE: the `find` regex must use `.*` to consume the full import specifier —
      // Vite applies aliases via String.replace(find, replacement), so a suffix-only
      // regex would only replace the extension and leave the module prefix intact.
      {
        find: /^.*\.(css|less|png|gif|jpg|woff|mp4)$/,
        replacement: path.resolve(ROOT, 'tests/js/sentry-test/mocks/importStyleMock.js'),
      },
      {
        find: /^.*\.svg(\?(url|import))?$/,
        replacement: path.resolve(ROOT, 'tests/js/sentry-test/mocks/svgMock.js'),
      },

      // Image/logo aliases (matches rspack.config.ts)
      {
        find: /^sentry-images\/(.*)/,
        replacement: path.resolve(ROOT, 'static/images/$1'),
      },
      {
        find: /^getsentry-images\/(.*)/,
        replacement: path.resolve(ROOT, 'static/images/$1'),
      },
      {
        find: /^sentry-logos\/(.*)/,
        replacement: path.resolve(ROOT, 'src/sentry/static/sentry/images/logos/$1'),
      },

      // Disable echarts in test (same as Jest config)
      {
        find: /^echarts\/(.*)/,
        replacement: path.resolve(ROOT, 'tests/js/sentry-test/mocks/echartsMock.js'),
      },
      {
        find: /^zrender\/(.*)/,
        replacement: path.resolve(ROOT, 'tests/js/sentry-test/mocks/echartsMock.js'),
      },

      // Disable @sentry/toolbar in tests
      {
        find: '@sentry/toolbar',
        replacement: path.resolve(
          ROOT,
          'tests/js/sentry-test/mocks/sentryToolbarMock.js'
        ),
      },

      // Mock react-date-range with a lightweight test double (same as Jest __mocks__)
      {
        find: 'react-date-range',
        replacement: path.resolve(ROOT, 'static/app/__mocks__/react-date-range.tsx'),
      },
    ],
  },
  test: {
    maxWorkers: IS_GITHUB_ACTION_ENV ? '75%' : undefined,
    isolate: false,
    // Limit Vitest's crawl to the frontend app tree.
    dir: 'static',
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    clearMocks: true,
    setupFiles: [
      'tests/js/vitest-cjs-shim.ts',
      'tests/js/vitest-reset-modules.ts',
      'tests/js/vitest-setup-timezone.ts',
      'static/app/utils/silence-react-unsafe-warnings.ts',
      'vitest-canvas-mock',
      'tests/js/vitest-setup.ts',
      'tests/js/vitest-setupFramework.ts',
    ],
    include: ['./**/*.spec.{ts,tsx}'],
    css: false,
    experimental: {
      fsModuleCache: !IS_GITHUB_ACTION_ENV,
    },
  },
});
