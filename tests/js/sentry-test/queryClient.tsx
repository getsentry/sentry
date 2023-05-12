import merge from 'lodash/merge';

import {DEFAULT_QUERY_CLIENT_CONFIG, QueryClient} from 'sentry/utils/queryClient';

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
