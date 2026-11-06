import {QueryClient} from '@tanstack/react-query';

import {DEFAULT_QUERY_CLIENT_CONFIG} from 'sentry/utils/queryClientConfig';

export const makeTestQueryClient = () =>
  new QueryClient({
    ...DEFAULT_QUERY_CLIENT_CONFIG,
    defaultOptions: {
      ...DEFAULT_QUERY_CLIENT_CONFIG.defaultOptions,
      queries: {
        ...DEFAULT_QUERY_CLIENT_CONFIG.defaultOptions?.queries,
        // Disable retries for tests to allow them to fail fast
        retry: false,
      },
      mutations: {
        ...DEFAULT_QUERY_CLIENT_CONFIG.defaultOptions?.mutations,
        // Disable retries for tests to allow them to fail fast
        retry: false,
      },
    },
  });
