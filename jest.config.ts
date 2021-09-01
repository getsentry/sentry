/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import path from 'path';
import process from 'process';

import type {Config} from '@jest/types';

import babelConfig from './babel.config';

const {CI, JEST_TESTS, CI_NODE_TOTAL, CI_NODE_INDEX, GITHUB_PR_SHA, GITHUB_PR_REF} =
  process.env;

/**
 * In CI we may need to shard our jest tests so that we can parellize the test runs
 *
 * `JEST_TESTS` is a list of all tests that will run, captured by `jest --listTests`
 * Then we split up the tests based on the total number of CI instances that will
 * be running the tests.
 */
let testMatch: string[] | undefined;

if (
  JEST_TESTS &&
  typeof CI_NODE_TOTAL !== 'undefined' &&
  typeof CI_NODE_INDEX !== 'undefined'
) {
  // Taken from https://github.com/facebook/jest/issues/6270#issue-326653779
  const envTestList = JSON.parse(JEST_TESTS) as string[];
  const tests = envTestList.sort((a, b) => b.localeCompare(a));

  const nodeTotal = Number(CI_NODE_TOTAL);
  const nodeIndex = Number(CI_NODE_INDEX);

  const length = tests.length;
  const size = Math.floor(length / nodeTotal);
  const remainder = length % nodeTotal;
  const offset = Math.min(nodeIndex, remainder) + nodeIndex * size;
  const chunk = size + (nodeIndex < remainder ? 1 : 0);

  testMatch = tests.slice(offset, offset + chunk);
}

const config: Config.InitialOptions = {
  verbose: false,
  collectCoverageFrom: [
    'tests/js/spec/**/*.{js,jsx,tsx}',
    'static/app/**/*.{js,jsx,ts,tsx}',
  ],
  coverageReporters: ['html', 'cobertura'],
  coverageDirectory: '.artifacts/coverage',
  moduleNameMapper: {
    '^sentry-test/(.*)': '<rootDir>/tests/js/sentry-test/$1',
    '^sentry-locale/(.*)': '<rootDir>/src/sentry/locale/$1',
    '\\.(css|less|png|jpg|mp4)$': '<rootDir>/tests/js/sentry-test/importStyleMock.js',
    '\\.(svg)$': '<rootDir>/tests/js/sentry-test/svgMock.js',
    'integration-docs-platforms':
      '<rootDir>/tests/fixtures/integration-docs/_platforms.json',
  },
  modulePaths: ['<rootDir>/static'],
  setupFiles: [
    '<rootDir>/static/app/utils/silence-react-unsafe-warnings.ts',
    '<rootDir>/tests/js/throw-on-react-error.js',
    'jest-canvas-mock',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/js/setup.js',
    '<rootDir>/tests/js/setupFramework.ts',
    '@testing-library/jest-dom/extend-expect',
  ],
  testMatch: testMatch || ['<rootDir>/tests/js/**/*(*.)@(spec|test).(js|ts)?(x)'],
  testPathIgnorePatterns: ['<rootDir>/tests/sentry/lang/javascript/'],

  unmockedModulePathPatterns: [
    '<rootDir>/node_modules/react',
    '<rootDir>/node_modules/reflux',
  ],
  transform: {
    '^.+\\.jsx?$': ['babel-jest', babelConfig as any],
    '^.+\\.tsx?$': ['babel-jest', babelConfig as any],
    '^.+\\.pegjs?$': '<rootDir>/tests/js/jest-pegjs-transform.js',
  },
  moduleFileExtensions: ['js', 'ts', 'jsx', 'tsx'],
  globals: {},

  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '.artifacts',
        outputName: 'jest.junit.xml',
      },
    ],
  ],

  testRunner: 'jest-circus/runner',

  testEnvironment: '<rootDir>/tests/js/instrumentedEnv',
  testEnvironmentOptions: {
    sentryConfig: {
      init: {
        dsn: 'https://3fe1dce93e3a4267979ebad67f3de327@sentry.io/4857230',
        environment: !!CI ? 'ci' : 'local',
        tracesSampleRate: 1.0,
      },
      transactionOptions: {
        tags: {
          branch: GITHUB_PR_REF,
          commit: GITHUB_PR_SHA,
        },
      },
    },
    output: path.resolve(__dirname, '.artifacts', 'visual-snapshots', 'jest'),
  },
};

export default config;
