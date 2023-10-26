import {useCallback, useMemo} from 'react';
import {Index, IndexRange} from 'react-virtualized';

// import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import {FeedbackIssueList} from 'sentry/utils/feedback/types';
import {ApiQueryKey, useInfiniteApiQuery} from 'sentry/utils/queryClient';
// import useOrganization from 'sentry/utils/useOrganization';

interface Params {
  queryKey: ApiQueryKey;
}

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
  setFeedback: () => undefined,
};

export default function useFetchFeedbackInfiniteListData({queryKey}: Params) {
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
    () => data?.pages.flatMap(([pageData]) => pageData) ?? [],
    [data]
  );

  const getRow = useCallback(
    ({index}: Index): FeedbackIssueList[number] | undefined => issues?.[index],
    [issues]
  );

  const isRowLoaded = useCallback(({index}: Index) => Boolean(issues?.[index]), [issues]);

  const loadMoreRows = useCallback(
    ({startIndex: _1, stopIndex: _2}: IndexRange) =>
      // isFetchingloaderRef.current?.fetchNext(stopIndex - startIndex) ?? Promise.resolve(),
      hasNextPage && !isFetching ? fetchNextPage() : Promise.resolve(),
    [hasNextPage, isFetching, fetchNextPage]
  );

  const setFeedback = useCallback(
    (_feedbackId: string, _feedback: undefined | FeedbackIssueList) => {},
    // loaderRef.current?.setFeedback(feedbackId, feedback),
    []
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
    setFeedback,
  };
}
