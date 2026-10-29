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
      '../../../build-utils/yak-jest-transform.cjs',
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
  transformIgnorePatterns: ['node_modules/(?!(@yak/|\\.pnpm/@yak\\+))'],
};

export default runOnFirstShard(config);
