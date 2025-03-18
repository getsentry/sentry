import react from '@vitejs/plugin-react';
import {cpus} from 'node:os';
import path from 'node:path';
import {defineConfig} from 'vitest/config';

import pegjsPlugin from './vite-pegjs-plugin';

const mockFileExtensionExp = /\.(css|less|png|jpg|woff|mp4)$/;

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // Disable emotion sourcemaps in tests
          // Since emotion spends lots of time parsing and inserting sourcemaps
          [
            '@emotion/babel-plugin',
            {
              sourceMap: false,
            },
          ],
        ],
      },
    }),
    pegjsPlugin(),
    {
      name: 'load-mocks',
      enforce: 'pre',
      // eslint-disable-next-line consistent-return
      load(id) {
        if (mockFileExtensionExp.test(id)) {
          return {code: 'export default {}'};
        }
      },
    },
  ],
  test: {
    // https://v0.vitest.dev/config/#globals
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/js/setupVitest.ts', './tests/js/setupFramework.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        // Use number of available CPUs
        minThreads: 1,
        // Use 75% of available cores, minimum 1
        maxThreads: Math.max(Math.floor(cpus().length * 0.75), 1),
      },
    },
    testTimeout: 5000,
    environmentOptions: {
      jsdom: {
        // jsdom options
      },
    },
    include: ['**/?(*.)+(spec).[jt]s?(x)'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    outputFile: {
      json: '.vitest-results.json', // Save full results to a file instead
    },
    clearMocks: true,
  },
  resolve: {
    alias: [
      {find: 'sentry', replacement: path.resolve(__dirname, 'static/app')},
      {find: 'getsentry', replacement: path.resolve(__dirname, 'static/gsApp')},
      {find: 'admin', replacement: path.resolve(__dirname, 'static/gsAdmin')},
      {find: 'sentry-images', replacement: path.resolve(__dirname, 'static/images')},
      {find: 'getsentry-images', replacement: path.resolve(__dirname, 'static/images')},
      {
        find: 'sentry-logos',
        replacement: path.resolve(__dirname, 'src/sentry/static/sentry/images/logos'),
      },
      {find: 'sentry-fixture', replacement: path.resolve(__dirname, 'tests/js/fixtures')},
      {find: 'sentry-test', replacement: path.resolve(__dirname, 'tests/js/sentry-test')},
      {
        find: 'getsentry-test',
        replacement: path.resolve(__dirname, 'tests/js/getsentry-test'),
      },
      {find: 'sentry-locale', replacement: path.resolve(__dirname, 'src/sentry/locale')},
      // Disable echarts in test since they're slow to transform
      {
        find: /^echarts\/.*/,
        replacement: path.resolve(__dirname, 'tests/js/sentry-test/echartsMock.js'),
      },
      {
        find: /^zrender\/.*/,
        replacement: path.resolve(__dirname, 'tests/js/sentry-test/echartsMock.js'),
      },
    ],
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.pegjs'],
  },
});
