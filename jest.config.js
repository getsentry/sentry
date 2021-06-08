/*eslint-env node*/
const path = require('path'); // eslint-disable-line

let testMatch;

const {JEST_TESTS, CI_NODE_TOTAL, CI_NODE_INDEX} = process.env;
/**
 * In CI we may need to shard our jest tests so that we can parellize the test runs
 *
 * `JEST_TESTS` is a list of all tests that will run, captured by `jest --listTests`
 * Then we split up the tests based on the total number of CI instances that will
 * be running the tests.
 */
if (
  JEST_TESTS &&
  typeof CI_NODE_TOTAL !== 'undefined' &&
  typeof CI_NODE_INDEX !== 'undefined'
) {
  // Taken from https://github.com/facebook/jest/issues/6270#issue-326653779
  const tests = JSON.parse(process.env.JEST_TESTS).sort((a, b) => {
    return b.localeCompare(a);
  });

  const length = tests.length;
  const size = Math.floor(length / CI_NODE_TOTAL);
  const remainder = length % CI_NODE_TOTAL;
  const offset = Math.min(CI_NODE_INDEX, remainder) + CI_NODE_INDEX * size;
  const chunk = size + (CI_NODE_INDEX < remainder ? 1 : 0);

  testMatch = tests.slice(offset, offset + chunk);
}

module.exports = {
  verbose: false,
  collectCoverageFrom: [
    'tests/js/spec/**/*.{js,jsx,tsx}',
    'static/app/**/*.{js,jsx,ts,tsx}',
  ],
  coverageProvider: 'v8',
  coverageReporters: ['html', 'cobertura'],
  coverageDirectory: '.artifacts/coverage',
  snapshotSerializers: ['enzyme-to-json/serializer'],
  moduleNameMapper: {
    '^sentry-test/(.*)': '<rootDir>/tests/js/sentry-test/$1',
    '\\.(css|less|png|jpg|mp4)$': '<rootDir>/tests/js/sentry-test/importStyleMock.js',
    '\\.(svg)$': '<rootDir>/tests/js/sentry-test/svgMock.js',
    'integration-docs-platforms':
      '<rootDir>/tests/fixtures/integration-docs/_platforms.json',
  },
  modulePaths: ['<rootDir>/static'],
  setupFiles: [
    '<rootDir>/static/app/utils/silence-react-unsafe-warnings.ts',
    '<rootDir>/tests/js/throw-on-react-error.js',
    '<rootDir>/tests/js/setup.js',
    'jest-canvas-mock',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/js/setupFramework.ts'],
  testMatch: testMatch || ['<rootDir>/tests/js/**/*(*.)@(spec|test).(js|ts)?(x)'],
  testPathIgnorePatterns: ['<rootDir>/tests/sentry/lang/javascript/'],

  unmockedModulePathPatterns: [
    '<rootDir>/node_modules/react',
    '<rootDir>/node_modules/reflux',
  ],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': 'babel-jest',
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
    output: path.resolve(__dirname, '.artifacts', 'visual-snapshots', 'jest'),
    SENTRY_DSN: 'https://3fe1dce93e3a4267979ebad67f3de327@sentry.io/4857230',
  },
};
