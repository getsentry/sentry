import {runOnFirstShard} from '../../../scripts/jestSingleShard.js';

const config = {
  testEnvironment: '<rootDir>/test/env/environment.mjs',
  setupFilesAfterEnv: ['<rootDir>/test/env/setup.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.{ts,tsx}'],
  moduleNameMapper: {
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
  // TanStack Form v2 and Hotkeys publish ESM only; compile them for the CommonJS test runtime.
  transformIgnorePatterns: [
    '/node_modules/.pnpm/(?!@tanstack\\+(?:(?:react-)?hotkeys|react-form|form-core|react-store)@)',
  ],
  clearMocks: true,
};

export default runOnFirstShard(config);
