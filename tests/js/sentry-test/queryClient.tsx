import {notifyManager} from '@tanstack/react-query';
import merge from 'lodash/merge';

import {DEFAULT_QUERY_CLIENT_CONFIG, QueryClient} from 'sentry/utils/queryClient';

// Reset the scheduler to the default (setTimeout) for tests.
// In production, we use queueMicrotask (see appQueryClient.tsx) for faster updates,
// but this causes act() warnings in tests that don't await async query updates.
notifyManager.setScheduler(cb => setTimeout(cb, 0));

export const makeTestQueryClient = () =>
  new QueryClient(
    merge({}, DEFAULT_QUERY_CLIENT_CONFIG, {
      defaultOptions: {
        queries: {
          // Disable retries for tests to allow them to fail fast
          retry: false,
        },
        mutations: {
          // Disable retries for tests to allow them to fail fast
          retry: false,
        },
      },
      // Don't want console output in tests
      logger: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
    })
  );
