/**
 * Augments @tanstack/query-core's Register interface to constrain QueryKey to
 * Sentry's API-typed query key shapes. This prevents arbitrary arrays from
 * being used as query keys — only branded ApiUrl values (from getApiUrl()) are
 * accepted.
 *
 * Types are defined inline to avoid circular imports through the augmentation
 * chain (this file → queryKey types → getApiUrl → @tanstack/react-query →
 * @tanstack/query-core).
 *
 * See: ApiQueryKey and InfiniteApiQueryKey in sentry/utils/queryClient.tsx
 */
declare module '@tanstack/query-core' {
  /**
   * Branded URL type — only produced by getApiUrl() in sentry/utils/api/getApiUrl.ts
   * Inlined here to avoid importing through the circular chain.
   */
  type ApiUrl = string & {__apiUrl: true};

  type SentryQueryKeyOptions = {
    data?: Record<string, any>;
    headers?: Record<string, string>;
    host?: string;
    method?: string;
    query?: Record<string, any>;
  };

  interface Register {
    queryKey:
      | readonly [url: ApiUrl]
      | readonly [url: ApiUrl, options: SentryQueryKeyOptions]
      | readonly ['infinite', url: ApiUrl]
      | readonly ['infinite', url: ApiUrl, options: SentryQueryKeyOptions];
  }
}

export {};
