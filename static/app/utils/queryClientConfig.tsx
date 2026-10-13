import type {QueryClientConfig} from '@tanstack/react-query';

import {RequestError} from 'sentry/utils/requestError/requestError';

const nonRetryCodes = new Set<number | undefined>([400, 401, 402, 403, 404]);

/**
 * Whether refetching after `err` could plausibly succeed. A client error -- a
 * malformed query, a resource the viewer can't see -- fails identically on
 * every attempt, so surfaces that offer a manual Retry should hide it for
 * these rather than leaving the reader to press a button that can't help.
 */
export function isRetryableRequestError(err: unknown): boolean {
  return !(err instanceof RequestError && nonRetryCodes.has(err.status));
}

// Overrides to the default react-query options.
// See https://tanstack.com/query/v5/docs/framework/react/guides/important-defaults
export const DEFAULT_QUERY_CLIENT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: (failureCount, err) => {
        // Disable retries for client errors that won't succeed on retry
        if (!isRetryableRequestError(err)) {
          return false;
        }

        return failureCount < 3;
      },
    },
  },
};
