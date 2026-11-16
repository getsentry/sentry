import {runOnFirstShard} from '../../../scripts/jestSingleShard.js';

// These packages publish ESM only; compile them for the CommonJS test runtime.
const ESM_NODE_MODULES = [
  '@tanstack\\+(?:react-)?hotkeys@',
  'query-string@',
  'filter-obj@',
  'split-on-first@',
];

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
  transformIgnorePatterns: [`/node_modules/.pnpm/(?!${ESM_NODE_MODULES.join('|')})`],
  clearMocks: true,
};

export default runOnFirstShard(config);
