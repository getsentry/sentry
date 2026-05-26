import type {Config} from '@jest/types';
import type {Options as SwcOptions} from '@swc/core';

const swcConfig: SwcOptions = {
  isModule: true,
  module: {
    type: 'commonjs',
  },
  sourceMaps: 'inline',
  jsc: {
    target: 'esnext',
    parser: {
      syntax: 'typescript',
      tsx: true,
      dynamicImport: true,
    },
    transform: {
      react: {
        runtime: 'automatic',
        importSource: '@emotion/react',
      },
    },
    experimental: {
      plugins: [
        ['@swc-contrib/mut-cjs-exports', {}],
        [
          '@swc/plugin-emotion',
          {
            sourceMap: false,
            autoLabel: 'never',
          },
        ],
      ],
    },
  },
};

/**
 * ESM packages that need to be transformed.
 */
const ESM_NODE_MODULES = ['screenfull', 'cbor2', 'nuqs', 'color'];

const config: Config.InitialOptions = {
  cacheDirectory: '.cache/jest-snapshots',
  // testEnvironment and testMatch are the core differences between this and the main config
  testEnvironment: 'node',
  testMatch: ['<rootDir>/static/**/*.snapshots.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],

  setupFiles: ['<rootDir>/tests/js/sentry-test/snapshots/snapshot-setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/js/sentry-test/snapshots/snapshot-framework.ts'],

  moduleNameMapper: {
    '\\.(css|less|png|gif|jpg|woff|mp4)$':
      '<rootDir>/tests/js/sentry-test/mocks/importStyleMock.js',
    '^sentry/(.*)': '<rootDir>/static/app/$1',
    '^@sentry/scraps/(.*)': '<rootDir>/static/app/components/core/$1',
    '^getsentry/(.*)': '<rootDir>/static/gsApp/$1',
    '^admin/(.*)': '<rootDir>/static/gsAdmin/$1',
    '^sentry-fixture/(.*)': '<rootDir>/tests/js/fixtures/$1',
    '^sentry-test/(.*)': '<rootDir>/tests/js/sentry-test/$1',
    '^getsentry-test/(.*)': '<rootDir>/tests/js/getsentry-test/$1',
    '^sentry-locale/(.*)': '<rootDir>/src/sentry/locale/$1',
    '\\.(svg)$': '<rootDir>/tests/js/sentry-test/mocks/svgMock.js',
    '^echarts/(.*)': '<rootDir>/tests/js/sentry-test/mocks/echartsMock.js',
    '^zrender/(.*)': '<rootDir>/tests/js/sentry-test/mocks/echartsMock.js',
  },

  transform: {
    '^.+\\.[mc]?[jt]sx?$': ['@swc/jest', swcConfig],
  },
  transformIgnorePatterns: [
    ESM_NODE_MODULES.length
      ? `/node_modules/.pnpm/(?!${ESM_NODE_MODULES.join('|')})`
      : '/node_modules/',
  ],

  moduleFileExtensions: ['js', 'ts', 'jsx', 'tsx'],
};

export default config;
