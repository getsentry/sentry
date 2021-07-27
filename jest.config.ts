/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import path from 'path';

import type {Config} from '@jest/types';

import babelConfig from './babel.config';

const {DOCKER_CI, JEST_TESTS, CI_NODE_TOTAL, CI_NODE_INDEX} = process.env;

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

// When using our Docker CI image, we volume mount tests to /workspace
const ROOT_DIR = DOCKER_CI ? '/workspace' : '<rootDir>';

const config: Config.InitialOptions = {
  verbose: false,
  collectCoverageFrom: [
    `${ROOT_DIR}/tests/js/spec/**/*.{js,jsx,tsx}`,
    `${ROOT_DIR}/static/app/**/*.{js,jsx,ts,tsx}`,
  ],
  coverageReporters: ['html', 'cobertura'],
  coverageDirectory: `${ROOT_DIR}/.artifacts/coverage`,
  snapshotSerializers: ['enzyme-to-json/serializer'],
  moduleNameMapper: {
    '^sentry-test/(.*)': `${ROOT_DIR}/tests/js/sentry-test/$1`,
    '^sentry-locale/(.*)': `${ROOT_DIR}/src/sentry/locale/$1`,
    '\\.(css|less|png|jpg|mp4)$': `${ROOT_DIR}/tests/js/sentry-test/importStyleMock.js`,
    '\\.(svg)$': `${ROOT_DIR}/tests/js/sentry-test/svgMock.js`,
    'integration-docs-platforms': `${ROOT_DIR}/tests/fixtures/integration-docs/_platforms.json`,
  },
  modulePaths: [`${ROOT_DIR}/static`],
  setupFiles: [
    `${ROOT_DIR}/static/app/utils/silence-react-unsafe-warnings.ts`,
    `${ROOT_DIR}/tests/js/throw-on-react-error.js`,
    `${ROOT_DIR}/tests/js/setup.js`,
    'jest-canvas-mock',
  ],
  setupFilesAfterEnv: [
    `${ROOT_DIR}/tests/js/setupFramework.ts`,
    '@testing-library/jest-dom/extend-expect',
  ],
  testMatch: testMatch || [`${ROOT_DIR}/tests/js/**/*(*.)@(spec|test).(js|ts)?(x)`],
  testPathIgnorePatterns: [`${ROOT_DIR}/tests/sentry/lang/javascript/`],

  unmockedModulePathPatterns: [
    `<rootDir>/node_modules/react`,
    `<rootDir>/node_modules/reflux`,
  ],
  transform: {
    '^.+\\.jsx?$': ['babel-jest', babelConfig as any],
    '^.+\\.tsx?$': ['babel-jest', babelConfig as any],
    '^.+\\.pegjs?$': `${ROOT_DIR}/tests/js/jest-pegjs-transform.js`,
  },
  moduleFileExtensions: ['js', 'ts', 'jsx', 'tsx'],
  globals: {},

  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: `${ROOT_DIR}/.artifacts`,
        outputName: 'jest.junit.xml',
      },
    ],
  ],

  testRunner: 'jest-circus/runner',

  testEnvironment: `${ROOT_DIR}/tests/js/instrumentedEnv`,
  testEnvironmentOptions: {
    output: path.resolve(
      DOCKER_CI ? '/workspace/' : __dirname,
      '.artifacts',
      'visual-snapshots',
      'jest'
    ),
    SENTRY_DSN: 'https://3fe1dce93e3a4267979ebad67f3de327@sentry.io/4857230',
  },
};

export default config;
