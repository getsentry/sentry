import {createRequire} from 'node:module';
import path from 'node:path';

import type {Configuration, RuleSetRule} from '@rspack/core';

const require = createRequire(import.meta.url);

export function getReactRouterConfig(env: NodeJS.ProcessEnv = process.env) {
  const useV8 =
    (env.NODE_ENV === 'production' ||
      Boolean(env.NOW_GITHUB_DEPLOYMENT) ||
      (env.NODE_ENV === 'development' && !env.CI)) &&
    env.NODE_ENV !== 'test' &&
    !env.TEST_SUITE;
  const root = path.resolve(import.meta.dirname, '..');
  const compatibilityDirectory = path.join(root, 'static/app/utils/reactRouterV6');
  const alias: NonNullable<Configuration['resolve']>['alias'] = useV8
    ? {
        'react-router$': require.resolve('react-router-v8'),
        'react-router/dom$': require.resolve('react-router-v8/dom'),
        'react-router-dom$': require.resolve('react-router-v8'),
        'nuqs/adapters/react-router/v6$':
          require.resolve('nuqs/adapters/react-router/v8'),
      }
    : {};

  const rules: RuleSetRule[] = useV8
    ? []
    : [
        {
          include: [path.join(root, 'static'), path.join(root, 'tests/js')],
          exclude: [compatibilityDirectory, /node_modules/],
          resolve: {
            alias: {
              'react-router$': path.join(compatibilityDirectory, 'index.ts'),
              'react-router/dom$': path.join(compatibilityDirectory, 'dom.ts'),
            },
          },
        },
      ];

  return {useV8, alias, rules};
}
