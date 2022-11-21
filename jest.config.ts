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
  GITHUB_RUN_ID,
  GITHUB_RUN_ATTEMPT,
} = process.env;

const BALANCE_RESULTS_PATH = path.resolve(
  __dirname,
  'tests',
  'js',
  'test-balancer',
  'jest-balance.json'
);

const optionalTags: {
  balancer?: boolean;
  balancer_strategy?: string;
} = {
  balancer: false,
};

if (!!JEST_TEST_BALANCER && !CI) {
  throw new Error(
    '[Operation only allowed in CI]: Jest test balancer should never be ran manually as you risk skewing the numbers - please trigger the automated github workflow at https://github.com/getsentry/sentry/actions/workflows/jest-balance.yml'
  );
}

/**
 * In CI we may need to shard our jest tests so that we can parellize the test runs
 *
 * `JEST_TESTS` is a list of all tests that will run, captured by `jest --listTests`
 * Then we split up the tests based on the total number of CI instances that will
 * be running the tests.
 */
let testMatch: string[] | undefined;

function getTestsForGroup(
  nodeIndex: number,
  nodeTotal: number,
  allTests: ReadonlyArray<string>,
  testStats: Record<string, number>
): string[] {
  const speculatedSuiteDuration = Object.values(testStats).reduce((a, b) => a + b, 0);
  const targetDuration = speculatedSuiteDuration / nodeTotal;

  if (speculatedSuiteDuration <= 0) {
    throw new Error('Speculated suite duration is <= 0');
  }

  // We are going to take all of our tests and split them into groups.
  // If we have a test without a known duration, we will default it to 2 second
  // This is to ensure that we still assign some weight to the tests and still attempt to somewhat balance them.
  // The 1.5s default is selected as a p50 value of all of our JS tests in CI (as of 2022-10-26) taken from our sentry performance monitoring.
  const tests = new Map<string, number>();
  const SUITE_P50_DURATION_MS = 1500;

  // First, iterate over all of the tests we have stats for.
  for (const test in testStats) {
    if (testStats[test] <= 0) {
      throw new Error(`Test duration is <= 0 for ${test}`);
    }
    tests.set(test, testStats[test]);
  }
  // Then, iterate over all of the remaining tests and assign them a default duration.
  for (const test of allTests) {
    if (tests.has(test)) {
      continue;
    }
    tests.set(test, SUITE_P50_DURATION_MS);
  }

  // Sanity check to ensure that we have all of our tests accounted for, we need to fail
  // if this is not the case as we risk not executing some tests and passing the build.
  if (tests.size < allTests.length) {
    throw new Error(
      `All tests should be accounted for, missing ${allTests.length - tests.size}`
    );
  }

  const groups: string[][] = [];

  // We sort files by path so that we try and improve the transformer cache hit rate.
  // Colocated domain specific files are likely to require other domain specific files.
  const testsSortedByPath = Array.from(tests.entries()).sort((a, b) => {
    // WidgetBuilder tests are a special case as they can sometimes take a long time to run (3-5 minutes)
    // As such, we want to ensure that they are ran in the same group as other widget builder tests.
    // We do this by sorting them by the path of the widget builder test which ensures they are started by the first job
    // in the CI group and that all of the tests actually run in the same group.
    if (a[0].includes('widgetBuilder')) {
      return -1;
    }
    if (b[0].includes('widgetBuilder')) {
      return 1;
    }
    return a[0].localeCompare(b[0]);
  });

  for (let group = 0; group < nodeTotal; group++) {
    groups[group] = [];
    let duration = 0;

    // While we are under our target duration and there are tests in the group
    while (duration < targetDuration && testsSortedByPath.length > 0) {
      // We peek the next item to check that it is not some super long running
      // test that may exceed our target duration. For example, if target runtime for each group is
      // 10 seconds, we have currently accounted for 9 seconds, and the next test is 5 seconds, we
      // want to move that test to the next group so as to avoid a 40% imbalance.
      const peek = testsSortedByPath[testsSortedByPath.length - 1];
      if (duration + peek[1] > targetDuration && peek[1] > 30_000) {
        break;
      }
      const nextTest = testsSortedByPath.pop();
      if (!nextTest) {
        throw new TypeError('Received falsy test' + JSON.stringify(nextTest));
      }
      groups[group].push(nextTest[0]);
      duration += nextTest[1];
    }
  }

  // Whatever may be left over will get round robin'd into the groups.
  let i = 0;
  while (testsSortedByPath.length) {
    const nextTest = testsSortedByPath.pop();
    if (!nextTest) {
      throw new TypeError('Received falsy test' + JSON.stringify(nextTest));
    }
    groups[i % 4].push(nextTest[0]);
    i++;
  }

  // Make sure we exhausted all tests before proceeding.
  if (testsSortedByPath.length > 0) {
    throw new Error('All tests should be accounted for');
  }

  // We need to ensure that everything from jest --listTests is accounted for.
  for (const test of allTests) {
    if (!tests.has(test)) {
      throw new Error(`Test ${test} is not accounted for`);
    }
  }

  if (!groups[nodeIndex]) {
    throw new Error(`No tests found for node ${nodeIndex}`);
  }
  return groups[nodeIndex].map(test => `<rootDir>/${test}`);
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
  const envTestList: string[] = JSON.parse(JEST_TESTS).map(file =>
    file.replace(__dirname, '')
  );
  const nodeTotal = Number(CI_NODE_TOTAL);
  const nodeIndex = Number(CI_NODE_INDEX);

  if (balance) {
    optionalTags.balancer = true;
    optionalTags.balancer_strategy = 'by_path';
    testMatch = getTestsForGroup(nodeIndex, nodeTotal, envTestList, balance);
  } else {
    const tests = envTestList.sort((a, b) => b.localeCompare(a));

    const length = tests.length;
    const size = Math.floor(length / nodeTotal);
    const remainder = length % nodeTotal;
    const offset = Math.min(nodeIndex, remainder) + nodeIndex * size;
    const chunk = size + (nodeIndex < remainder ? 1 : 0);

    testMatch = tests.slice(offset, offset + chunk).map(test => '<rootDir>' + test);
  }
}

/**
 * For performance we don't want to try and compile everything in the
 * node_modules, but some packages which use ES6 syntax only NEED to be
 * transformed.
 */
const ESM_NODE_MODULES = ['copy-text-to-clipboard'];

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
    'integration-docs-platforms': '<rootDir>/fixtures/integration-docs/_platforms.json',

    // Disable echarts in test, since they're very slow and take time to
    // transform
    '^echarts/(.*)': '<rootDir>/tests/js/sentry-test/echartsMock.js',
    '^zrender/(.*)': '<rootDir>/tests/js/sentry-test/echartsMock.js',
  },
  setupFiles: [
    '<rootDir>/static/app/utils/silence-react-unsafe-warnings.ts',
    'jest-canvas-mock',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/js/setup.ts',
    '<rootDir>/tests/js/setupFramework.ts',
    '@testing-library/jest-dom/extend-expect',
  ],
  testMatch: testMatch || ['<rootDir>/static/**/?(*.)+(spec|test).[jt]s?(x)'],
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
  transformIgnorePatterns: [`/node_modules/(?!${ESM_NODE_MODULES.join('|')})`],

  moduleFileExtensions: ['js', 'ts', 'jsx', 'tsx'],
  globals: {},

  testResultsProcessor: JEST_TEST_BALANCER
    ? '<rootDir>/tests/js/test-balancer/index.js'
    : undefined,
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

  testEnvironment: '<rootDir>/tests/js/instrumentedEnv',
  testEnvironmentOptions: {
    sentryConfig: {
      init: {
        // jest project under Sentry organization (dev productivity team)
        dsn: 'https://3fe1dce93e3a4267979ebad67f3de327@sentry.io/4857230',
        environment: CI ? 'ci' : 'local',
        tracesSampleRate: 1,
        profilesSampleRate: 0.1,
        transportOptions: {keepAlive: true},
      },
      transactionOptions: {
        tags: {
          ...optionalTags,
          branch: GITHUB_PR_REF,
          commit: GITHUB_PR_SHA,
          github_run_attempt: GITHUB_RUN_ATTEMPT,
          github_actions_run: `https://github.com/getsentry/sentry/actions/runs/${GITHUB_RUN_ID}`,
        },
      },
    },
    output: path.resolve(__dirname, '.artifacts', 'visual-snapshots', 'jest'),
  },
};

export default config;
