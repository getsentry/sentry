import {useCallback, useMemo} from 'react';
import type {Index, IndexRange} from 'react-virtualized';

import {type ApiQueryKey, useInfiniteApiQuery} from 'sentry/utils/queryClient';

export const EMPTY_INFINITE_LIST_DATA: ReturnType<typeof useFetchInfiniteListData> = {
  error: null,
  hasNextPage: false,
  isError: false,
  isFetching: false, // If the network is active
  isFetchingNextPage: false,
  isFetchingPreviousPage: false,
  isLoading: false, // If anything is loaded yet
  // Below are fields that are shims for react-virtualized
  getRow: () => undefined,
  isRowLoaded: () => false,
  issues: [],
  loadMoreRows: () => Promise.resolve(),
  hits: 0,
};

function uniqueItems<Data extends Record<string, unknown>>(
  items: Data[],
  uniqueField: string
) {
  const uniqueIds = new Set(items.map(item => item[uniqueField]));
  return items.filter(item => {
    if (uniqueIds.has(item[uniqueField])) {
      uniqueIds.delete(item[uniqueField]);
      return true;
    }
    return false;
  });
}

interface Props {
  queryKey: NonNullable<ApiQueryKey | undefined>;
  uniqueField: string;
  enabled?: boolean;
}

export default function useFetchInfiniteListData<Data extends Record<string, unknown>>({
  queryKey,
  uniqueField,
  enabled,
}: Props) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetching, // If the network is active
    isFetchingNextPage,
    isFetchingPreviousPage,
    isPending, // If anything is loaded yet
  } = useInfiniteApiQuery<Data[]>({
    queryKey,
    enabled,
  });

  const issues = useMemo(
    () => uniqueItems(data?.pages.flatMap(([pageData]) => pageData) ?? [], uniqueField),
    [data, uniqueField]
  );

  const getRow = useCallback(
    ({index}: Index): Data | undefined => issues?.[index],
    [issues]
  );

  const isRowLoaded = useCallback(({index}: Index) => Boolean(issues[index]), [issues]);

  const loadMoreRows = useCallback(
    ({startIndex: _1, stopIndex: _2}: IndexRange): Promise<any> =>
      hasNextPage ? fetchNextPage() : Promise.resolve(),
    [hasNextPage, fetchNextPage]
  );

  const hits = useMemo(
    () =>
      data?.pages.map(([, , resp]) => Number(resp?.getResponseHeader('X-Hits'))) ?? [],
    [data]
  );

  return {
    error,
    hasNextPage,
    isError,
    isFetching, // If the network is active
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading: isPending, // If anything is loaded yet
    // Below are fields that are shims for react-virtualized
    getRow,
    isRowLoaded,
    issues,
    loadMoreRows,
    hits: Math.max(...hits),
  };
}
