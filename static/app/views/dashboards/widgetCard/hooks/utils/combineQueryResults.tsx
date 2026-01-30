import type {UseQueryResult} from '@tanstack/react-query';

import type {ApiResult} from 'sentry/api';

/**
 * Combines multiple useQueries results into a single memoized object.
 * Used with the `combine` option in useQueries to provide stable references
 * that only change when underlying query data changes.
 */
export function combineQueryResults<T>(
  results: Array<UseQueryResult<ApiResult<T>, Error>>
) {
  return {
    isFetching: results.some(q => q?.isFetching),
    allHaveData: results.every(q => q?.data?.[0]),
    errorMessage: results.find(q => q?.error)?.error?.message,
    queryData: results.map(q => q.data),
  };
}
