const config = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['js', 'ts', 'pegjs'],
  transform: {
    '^.+\\.[jt]s$': [
      '@swc/jest',
      {jsc: {target: 'es2022', parser: {syntax: 'typescript'}}},
    ],
    // The app compiles the grammar with the same transform.
    '^.+\\.pegjs$': '<rootDir>/../../../tests/js/jest-pegjs-transform.js',
  },
  clearMocks: true,
  watchman: false,
};

export default config;
