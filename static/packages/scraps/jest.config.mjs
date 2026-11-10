import {runOnFirstShard} from '../../../scripts/jestSingleShard.js';

const config = {
  testEnvironment: '<rootDir>/test/env/environment.mjs',
  setupFiles: ['<rootDir>/test/env/setupContentEditable.ts'],
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
  // Compile ESM dependencies for the CommonJS test runtime.
  transformIgnorePatterns: [
    '/node_modules/.pnpm/(?!@tanstack\\+(?:react-)?hotkeys@|lexical@|@lexical\\+|@preact\\+signals-core|marked@)',
  ],
  clearMocks: true,
};

export default runOnFirstShard(config);
