const config = {
  testEnvironment: '<rootDir>/test/environment.mjs',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.tsx'],
  moduleNameMapper: {
    '^@sentry/scraps$': '<rootDir>/src/index.ts',
    '^@sentry/scraps/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.[jt]sx?$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: {syntax: 'typescript', tsx: true},
          transform: {
            react: {runtime: 'automatic', importSource: '@emotion/react'},
          },
        },
      },
    ],
  },
  clearMocks: true,
};

export default config;
