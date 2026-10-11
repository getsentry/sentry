import {createJestConfig} from '@sentry-internal/test-utils/jest';

const config = createJestConfig(
  {
    rootDir: import.meta.dirname,
    setupFilesAfterEnv: ['<rootDir>/test/env/setup.ts'],
    testMatch: ['<rootDir>/src/**/*.spec.tsx'],
    moduleNameMapper: {
      '^@sentry/scraps$': '<rootDir>/src/index.ts',
      '^@sentry/scraps/(.*)$': '<rootDir>/src/$1',
    },
  },
  {jsxImportSource: '@emotion/react'}
);

export default config;
