import {fileURLToPath} from 'node:url';

import type {Config} from '@jest/types';

/**
 * Package-owned tooling uses absolute paths so consumers do not need to declare
 * the transformer or rely on hoisted dependencies. Consumers own test discovery,
 * providers, module mappings, and any additional setup.
 */
export function createJestConfig(
  config: Config.InitialOptions & {rootDir: string},
  {jsxImportSource = 'react'}: {jsxImportSource?: string} = {}
): Config.InitialOptions {
  const {setupFilesAfterEnv = [], ...overrides} = config;
  return {
    testEnvironment: fileURLToPath(new URL('../environment.mjs', import.meta.url)),
    setupFilesAfterEnv: [
      fileURLToPath(new URL('jestDom.ts', import.meta.url)),
      ...setupFilesAfterEnv,
    ],
    transform: {
      '^.+\\.[mc]?[jt]sx?$': [
        fileURLToPath(import.meta.resolve('@swc/jest')),
        {
          jsc: {
            target: 'es2022',
            parser: {syntax: 'typescript', tsx: true},
            transform: {react: {runtime: 'automatic', importSource: jsxImportSource}},
          },
        },
      ],
    },
    clearMocks: true,
    ...overrides,
  };
}
