/*eslint-env node*/
module.exports = {
  verbose: false,
  collectCoverageFrom: [
    'tests/js/spec/**/*.{js,jsx}',
    'src/sentry/static/sentry/app/**/*.{js,jsx}',
  ],
  coverageReporters: ['html', 'lcov', 'cobertura'],
  coverageDirectory: '.artifacts/coverage/',
  snapshotSerializers: ['enzyme-to-json/serializer'],
  moduleNameMapper: {
    '^app-test/(.*)': '<rootDir>/tests/js/$1',
    '^app-test-helpers(.*)': '<rootDir>/tests/js/helpers$1',
    '\\.(css|less|png)$': '<rootDir>/tests/js/helpers/importStyleMock.js',
    '\\.(svg)$': '<rootDir>/tests/js/helpers/svgMock.js',
    jquery: '<rootDir>/src/sentry/static/sentry/__mocks__/jquery.jsx',
    'integration-docs-platforms':
      '<rootDir>/tests/fixtures/integration-docs/_platforms.json',
  },
  modulePaths: ['<rootDir>/src/sentry/static/sentry'],
  setupFiles: [
    '<rootDir>/tests/js/throw-on-react-error.js',
    '<rootDir>/tests/js/setup.js',
  ],
  setupTestFrameworkScriptFile: '<rootDir>/tests/js/setupFramework.js',
  testMatch: ['<rootDir>/tests/js/**/?(*.)(spec|test).js?(x)'],
  testPathIgnorePatterns: ['<rootDir>/tests/sentry/lang/javascript/'],
  unmockedModulePathPatterns: [
    '<rootDir>/node_modules/react',
    '<rootDir>/node_modules/reflux',
  ],
};
