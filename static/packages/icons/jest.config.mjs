import {createJestConfig} from '@sentry-internal/test-utils/jest';

const config = createJestConfig({
  rootDir: import.meta.dirname,
  testMatch: ['<rootDir>/src/**/*.spec.tsx'],
  watchman: false,
});

export default config;
