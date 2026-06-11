import process from 'node:process';

import type {Config} from '@jest/types';
import type {Options as SwcOptions} from '@swc/core';

const {CI, GITHUB_PR_SHA, GITHUB_PR_REF, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, SENTRY_DSN} =
  process.env;

const IS_MASTER_BRANCH = GITHUB_PR_REF === 'refs/heads/master';

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
  testTimeout: 30_000,
  cacheDirectory: '.cache/jest-snapshots',
  // testEnvironment and testMatch are the core differences between this and the main config
  testEnvironment: '@sentry/jest-environment/node',
  testMatch: ['<rootDir>/static/**/*.snapshots.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
  testEnvironmentOptions: {
    sentryConfig: {
      init: {
        dsn: Boolean(CI) && Boolean(GITHUB_PR_REF) && SENTRY_DSN ? SENTRY_DSN : false,
        environment: CI ? (IS_MASTER_BRANCH ? 'ci:master' : 'ci:pull_request') : 'local',
        tracesSampleRate: CI ? 0.75 : 0,
        profilesSampleRate: 0,
        transportOptions: {keepAlive: true},
      },
      transactionOptions: {
        tags: {
          branch: GITHUB_PR_REF,
          commit: GITHUB_PR_SHA,
          github_run_attempt: GITHUB_RUN_ATTEMPT,
          github_actions_run: `https://github.com/getsentry/sentry/actions/runs/${GITHUB_RUN_ID}`,
        },
      },
    },
  },

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
    '^.+\\.pegjs?$': '<rootDir>/tests/js/jest-pegjs-transform.js',
  },
  transformIgnorePatterns: [
    ESM_NODE_MODULES.length
      ? `/node_modules/.pnpm/(?!${ESM_NODE_MODULES.join('|')})`
      : '/node_modules/',
  ],

  moduleFileExtensions: ['js', 'ts', 'jsx', 'tsx', 'pegjs'],
};

export default config;
