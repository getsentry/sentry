import type {Config} from '@jest/types';

import defaultConfig from './jest.config';

const config: Config.InitialOptions = {
  ...defaultConfig,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/static/**/*.snapshots.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],

  setupFiles: ['<rootDir>/tests/js/sentry-test/snapshots/snapshot-setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/js/sentry-test/snapshots/snapshot-framework.ts'],
};

export default config;
