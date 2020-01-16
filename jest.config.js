/*eslint-env node*/
module.exports = {
  verbose: false,
  collectCoverageFrom: [
    'tests/js/spec/**/*.{js,jsx}',
    'src/sentry/static/sentry/app/**/*.{js,jsx,ts,tsx}',
  ],
  coverageReporters: ['html', 'lcov', 'cobertura'],
  coverageDirectory: '.artifacts/coverage/',
  snapshotSerializers: ['enzyme-to-json/serializer'],
  moduleNameMapper: {
    '^sentry-test/(.*)': '<rootDir>/tests/js/sentry-test/$1',
    '\\.(css|less|png)$': '<rootDir>/tests/js/sentry-test/importStyleMock.js',
    '\\.(svg)$': '<rootDir>/tests/js/sentry-test/svgMock.js',
    'integration-docs-platforms':
      '<rootDir>/tests/fixtures/integration-docs/_platforms.json',
  },
  modulePaths: ['<rootDir>/src/sentry/static/sentry'],
  setupFiles: [
    '<rootDir>/tests/js/throw-on-react-error.js',
    '<rootDir>/tests/js/setup.js',
    'jest-canvas-mock',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/js/setupFramework.js'],
  testMatch: ['<rootDir>/tests/js/**/?(*.)(spec|test).js?(x)'],
  testPathIgnorePatterns: ['<rootDir>/tests/sentry/lang/javascript/'],
  unmockedModulePathPatterns: [
    '<rootDir>/node_modules/react',
    '<rootDir>/node_modules/reflux',
  ],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': 'babel-jest',
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
};
