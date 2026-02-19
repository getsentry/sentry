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
  import type {ApiUrl} from 'sentry/utils/api/getApiUrl';
  import type {
    ApiQueryKey,
    InfiniteApiQueryKey,
    SentryQueryKeyOptions,
  } from 'sentry/utils/queryClient';

  interface Register {
    queryKey: readonly unknown[] | ApiQueryKey | InfiniteApiQueryKey;
  }
}

export {};
