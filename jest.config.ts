/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import path from 'path';
import process from 'process';

import type {Config} from '@jest/types';

import babelConfig from './babel.config';

const {
  CI,
  JEST_TESTS,
  JEST_TEST_BALANCER,
  CI_NODE_TOTAL,
  CI_NODE_INDEX,
  GITHUB_PR_SHA,
  GITHUB_PR_REF,
} = process.env;

/**
 * In CI we may need to shard our jest tests so that we can parellize the test runs
 *
 * `JEST_TESTS` is a list of all tests that will run, captured by `jest --listTests`
 * Then we split up the tests based on the total number of CI instances that will
 * be running the tests.
 */
let testMatch: string[] | undefined;

const BALANCE_RESULTS_PATH = path.resolve(
  __dirname,
  'tests',
  'js',
  'test-balancer',
  'jest-balance.json'
);

/**
 * Given a Map of <testName, testRunTime> and a number of total groups, split the
 * tests into n groups whose total test run times should be roughly equal
 *
 * The source results should be sorted with the slowest tests first. We insert
 * the test into the smallest group on each interation. This isn't perfect, but
 * should be good enough.
 *
 * Returns a map of <testName, groupIndex>
 */
function balancer(
  allTests: string[],
  source: Record<string, number>,
  numberGroups: number
) {
  const results = new Map<string, number>();
  const totalRunTimes = Array(numberGroups).fill(0);

  /**
   * Find the index of the smallest group (totalRunTimes)
   */
  function findSmallestGroup() {
    let index = 0;
    let smallestRunTime = null;
    for (let i = 0; i < totalRunTimes.length; i++) {
      const runTime = totalRunTimes[i];

      if (!smallestRunTime || runTime <= smallestRunTime) {
        smallestRunTime = totalRunTimes[i];
        index = i;
      }

      if (runTime === 0) {
        break;
      }
    }

    return index;
  }

  /**
   * We may not have a duration for all tests (e.g. a test that was just added)
   * as the `source` needs to be generated
   */
  for (const test of allTests) {
    const index = findSmallestGroup();
    results.set(test, index);

    if (source[test] !== undefined) {
      totalRunTimes[index] = totalRunTimes[index] + source[test];
    }
  }

  return results;
}

if (
  JEST_TESTS &&
  typeof CI_NODE_TOTAL !== 'undefined' &&
  typeof CI_NODE_INDEX !== 'undefined'
) {
  let balance: null | Record<string, number> = null;

  try {
    balance = require(BALANCE_RESULTS_PATH);
  } catch (err) {
    // Just ignore if balance results doesn't exist
  }

  // Taken from https://github.com/facebook/jest/issues/6270#issue-326653779
  const envTestList = JSON.parse(JEST_TESTS).map(file =>
    file.replace(__dirname, '')
  ) as string[];
  const tests = envTestList.sort((a, b) => b.localeCompare(a));

  const nodeTotal = Number(CI_NODE_TOTAL);
  const nodeIndex = Number(CI_NODE_INDEX);

  if (balance) {
    const results = balancer(envTestList, balance, nodeTotal);

    testMatch = [
      // First, we only want the tests that we have test durations for and belong
      // to the current node's index
      ...Object.entries(Object.fromEntries(results))
        .filter(([, index]) => index === nodeIndex)
        .map(([test]) => `${path.join(__dirname, test)}`),
    ];
  } else {
    const length = tests.length;
    const size = Math.floor(length / nodeTotal);
    const remainder = length % nodeTotal;
    const offset = Math.min(nodeIndex, remainder) + nodeIndex * size;
    const chunk = size + (nodeIndex < remainder ? 1 : 0);

    testMatch = tests.slice(offset, offset + chunk);
  }
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
    '^sentry/(.*)': '<rootDir>/static/app/$1',
    '^sentry-test/(.*)': '<rootDir>/tests/js/sentry-test/$1',
    '^sentry-locale/(.*)': '<rootDir>/src/sentry/locale/$1',
    '\\.(css|less|png|jpg|mp4)$': '<rootDir>/tests/js/sentry-test/importStyleMock.js',
    '\\.(svg)$': '<rootDir>/tests/js/sentry-test/svgMock.js',
    'integration-docs-platforms':
      '<rootDir>/tests/fixtures/integration-docs/_platforms.json',
  },
  setupFiles: [
    '<rootDir>/static/app/utils/silence-react-unsafe-warnings.ts',
    '<rootDir>/tests/js/throw-on-react-error.js',
    'jest-canvas-mock',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/js/setup.ts',
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
  transformIgnorePatterns: ['/node_modules/(?!echarts|zrender)'],
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
    [
      '<rootDir>/tests/js/test-balancer',
      {
        enabled: !!JEST_TEST_BALANCER,
        resultsPath: BALANCE_RESULTS_PATH,
      },
    ],
  ],

  testRunner: 'jest-circus/runner',

  testEnvironment: '<rootDir>/tests/js/instrumentedEnv',
  testEnvironmentOptions: {
    sentryConfig: {
      init: {
        // jest project under Sentry organization (dev productivity team)
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
