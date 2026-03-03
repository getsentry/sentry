import type {TransformOptions} from '@babel/core';
import type {Config} from '@jest/types';

const babelConfig: TransformOptions = {
  presets: [
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
        importSource: '@emotion/react',
      },
    ],
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage',
        corejs: '3.41',
        targets: {
          node: 'current',
        },
      },
    ],
    ['@babel/preset-typescript', {allowDeclareFields: true, onlyRemoveTypeImports: true}],
  ],
  plugins: [
    [
      '@emotion/babel-plugin',
      {
        sourceMap: false,
      },
    ],
  ],
};

/**
 * ESM packages that need to be transformed by babel-jest.
 */
const ESM_NODE_MODULES = ['screenfull', 'cbor2', 'nuqs', 'color'];

const config: Config.InitialOptions = {
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
    '^.+\\.jsx?$': ['babel-jest', babelConfig as any],
    '^.+\\.tsx?$': ['babel-jest', babelConfig as any],
    '^.+\\.mjs?$': ['babel-jest', babelConfig as any],
  },
  transformIgnorePatterns: [
    ESM_NODE_MODULES.length
      ? `/node_modules/.pnpm/(?!${ESM_NODE_MODULES.join('|')})`
      : '/node_modules/',
  ],

  moduleFileExtensions: ['js', 'ts', 'jsx', 'tsx'],
};

export default config;
