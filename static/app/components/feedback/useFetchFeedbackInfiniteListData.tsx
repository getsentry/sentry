import {useCallback, useMemo} from 'react';
import {Index, IndexRange} from 'react-virtualized';

import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import {FeedbackIssueList} from 'sentry/utils/feedback/types';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';

export const EMPTY_INFINITE_LIST_DATA: ReturnType<
  typeof useFetchFeedbackInfiniteListData
> = {
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

function uniqueIssues(issues: FeedbackIssueList) {
  const uniqueIds = new Set(issues.map(issue => issue.id));
  return issues.filter(issue => {
    if (uniqueIds.has(issue.id)) {
      uniqueIds.delete(issue.id);
      return true;
    }
    return false;
  });
}

export default function useFetchFeedbackInfiniteListData() {
  const {getListQueryKey} = useFeedbackQueryKeys();
  const queryKey = getListQueryKey();
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetching, // If the network is active
    isFetchingNextPage,
    isFetchingPreviousPage,
    isLoading, // If anything is loaded yet
  } = useInfiniteApiQuery<FeedbackIssueList>({
    queryKey,
  });

  const issues = useMemo(
    () => uniqueIssues(data?.pages.flatMap(([pageData]) => pageData) ?? []),
    [data]
  );

  const getRow = useCallback(
    ({index}: Index): FeedbackIssueList[number] | undefined => issues?.[index],
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
    isLoading, // If anything is loaded yet
    // Below are fields that are shims for react-virtualized
    getRow,
    isRowLoaded,
    issues,
    loadMoreRows,
    hits: Math.max(...hits),
  };
}
