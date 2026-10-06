import type {UseQueryResult} from '@tanstack/react-query';

export type WidgetQueryResult<TData> = Pick<
  UseQueryResult<TData>,
  'data' | 'error' | 'isFetching' | 'isPlaceholderData'
>;

/**
 * `combine` for dashboard widget `useQueries` calls.
 *
 * React Query only reruns `combine` when a query result changes, and structurally
 * shares its output with the previous one. `data` therefore keeps its reference
 * until a response actually changes, so hooks can derive a stable `rawData` from it.
 */
export function combineWidgetQueryResults<TData>(results: Array<UseQueryResult<TData>>): {
  data: Array<TData | undefined>;
  results: Array<WidgetQueryResult<TData>>;
} {
  return {
    results: results.map(({data, error, isFetching, isPlaceholderData}) => ({
      data,
      error,
      isFetching,
      isPlaceholderData,
    })),
    data: results.map(result => result.data),
  };
}
