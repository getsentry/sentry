import {useCallback, useMemo} from 'react';
import {Index, IndexRange} from 'react-virtualized';

import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import hydrateFeedbackRecord from 'sentry/components/feedback/hydrateFeedbackRecord';
import {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import {RawFeedbackListResponse} from 'sentry/utils/feedback/list/types';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Params {
  queryView: {
    collapse: string[];
    expand: string[];
    limit: number;
    queryReferrer: string;
    shortIdLookup: number;
    end?: string;
    environment?: string[];
    field?: string[];
    mailbox?: ReturnType<typeof decodeMailbox>;
    project?: string[];
    query?: string;
    start?: string;
    statsPeriod?: string;
    utc?: string;
  };
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

export default function useFetchFeedbackInfiniteListData({queryView}: Params) {
  const organization = useOrganization();

  const query = useMemo(
    () => ({
      ...queryView,
      query: `issue.category:feedback status:${queryView.mailbox} ${queryView.query}`,
    }),
    [queryView]
  );

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
  } = useInfiniteApiQuery<RawFeedbackListResponse>({
    queryKey: [`/organizations/${organization.slug}/issues/`, {query}],
  });

  const issues = useMemo(
    () => data?.pages.flatMap(([pageData]) => pageData).map(hydrateFeedbackRecord) ?? [],
    [data]
  );

  const getRow = useCallback(
    ({index}: Index): HydratedFeedbackItem | undefined => issues?.[index],
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
    (_feedbackId: string, _feedback: undefined | HydratedFeedbackItem) => {},
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
