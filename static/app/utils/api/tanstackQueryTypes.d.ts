/**
 * Augments @tanstack/query-core's Register interface to constrain QueryKey to
 * Sentry's API-typed query key shapes. This prevents arbitrary arrays from
 * being used as query keys — only branded ApiUrl values (from getApiUrl()) are
 * accepted.
 *
 * See: ApiQueryKey and InfiniteApiQueryKey in sentry/utils/queryClient.tsx
 */

import type {ApiUrl} from 'sentry/utils/api/getApiUrl';
import type {
  ApiQueryKey,
  InfiniteApiQueryKey,
  SentryQueryKeyOptions,
} from 'sentry/utils/queryClient';

declare module '@tanstack/query-core' {
  interface Register {
    queryKey: readonly unknown[] | ApiQueryKey | InfiniteApiQueryKey;
  }
}

export {};
