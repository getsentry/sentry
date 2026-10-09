import type {ComponentProps} from 'react';
import {UNSAFE_createRouter} from 'react-router';
import {RouterProvider} from 'react-router/dom';

import type {UNSAFE_createRouter as createRouterV6} from 'sentry/utils/reactRouterV6';
import type {RouterProvider as RouterProviderV6} from 'sentry/utils/reactRouterV6/types';

export function createTestRouter(options: Parameters<typeof UNSAFE_createRouter>[0]) {
  if (process.env.SENTRY_REACT_ROUTER_VERSION !== '8') {
    Object.assign(options, {
      future: {v7_prependBasename: true, v7_relativeSplatPath: true},
    } satisfies Pick<Parameters<typeof createRouterV6>[0], 'future'>);
  }
  return UNSAFE_createRouter(options).initialize();
}

export function TestRouterProvider({
  router,
  useTransitions = false,
}: Pick<ComponentProps<typeof RouterProvider>, 'router' | 'useTransitions'>) {
  const props =
    process.env.SENTRY_REACT_ROUTER_VERSION === '8'
      ? {
          // V8's explicit true enables optimistic updates; unset preserves startTransition alone.
          useTransitions: useTransitions ? undefined : false,
        }
      : ({future: {v7_startTransition: true}} satisfies Pick<
          ComponentProps<typeof RouterProviderV6>,
          'future'
        >);
  return <RouterProvider {...props} router={router} />;
}
