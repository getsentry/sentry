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

const ESM_NODE_MODULES = [
  'screenfull',
  'cbor2',
  'nuqs',
  'color',
  'marked',
  '@sentry\\+sqlish',
  // MSW and its entire ESM dependency tree
  'msw',
  '@mswjs\\+interceptors',
  '@open-draft\\+deferred-promise',
  '@open-draft\\+logger',
  '@open-draft\\+until',
  'rettime',
  'outvariant',
  'strict-event-emitter',
  'headers-polyfill',
  'until-async',
];

const config: Config.InitialOptions = {
  testTimeout: 60_000,
  cacheDirectory: '.cache/jest-page-snapshots',
  testEnvironment: '<rootDir>/tests/js/sentry-test/jest-environment-page-snapshots.js',
  testMatch: ['<rootDir>/static/**/*.page-snapshots.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
  modulePathIgnorePatterns: ['<rootDir>/\\.claude/'],
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

  setupFiles: [
    '<rootDir>/static/app/utils/silenceReactUnsafeWarnings.ts',
    'jest-canvas-mock',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/js/sentry-test/pageSnapshotSetup.ts'],

  moduleNameMapper: {
    '\\.(css|less|png|gif|jpg|avif|woff|mp4)$':
      '<rootDir>/tests/js/sentry-test/mocks/importStyleMock.js',
    '^sentry/stories/storyManifest\\.generated$':
      '<rootDir>/tests/js/sentry-test/mocks/storyManifestMock.ts',
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
    '^@sentry/sqlish/react$': '<rootDir>/node_modules/@sentry/sqlish/dist/react.js',
    '^@sentry/sqlish$': '<rootDir>/node_modules/@sentry/sqlish/dist/index.js',
    '@sentry/toolbar': '<rootDir>/tests/js/sentry-test/mocks/sentryToolbarMock.js',
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
