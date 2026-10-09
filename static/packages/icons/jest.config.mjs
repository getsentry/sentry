const config = {
  testEnvironment: '<rootDir>/test/environment.mjs',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.tsx'],
  transform: {
    '^.+\\.[jt]sx?$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: {syntax: 'typescript', tsx: true},
          transform: {react: {runtime: 'automatic'}},
        },
      },
    ],
  },
  clearMocks: true,
  watchman: false,
};

export default config;
