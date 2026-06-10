import {keepPreviousData} from '@tanstack/react-query';

import type {
  BaseCMDKQueryOptions,
  CMDKQueryOptions,
} from 'sentry/components/commandPalette/types';

/**
 * Wraps a query options object and injects the cmdk meta marker required for
 * the command palette loading indicator to track this query via useIsFetching.
 * All resource functions passed to CMDKAction must use this helper.
 */
export function cmdkQueryOptions<TData = unknown>(
  options: BaseCMDKQueryOptions<TData>
): CMDKQueryOptions<TData> {
  return {placeholderData: keepPreviousData, ...options, meta: {cmdk: true}};
}
