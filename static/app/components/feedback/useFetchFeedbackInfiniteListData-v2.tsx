import {useCallback, useMemo} from 'react';
import {Index, IndexRange} from 'react-virtualized';

import {ApiResult} from 'sentry/api';
import {
  FeedbackItemResponse,
  HydratedFeedbackItem,
} from 'sentry/utils/feedback/item/types';
import {EMPTY_QUERY_VIEW, QueryView} from 'sentry/utils/feedback/list/types';
import {QueryFunctionContext, useInfiniteQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export const EMPTY_INFINITE_LIST_DATA: ReturnType<
  typeof useFetchFeedbackInfiniteListData
> = {
  getRow: () => undefined,
  isError: false,
  isLoading: false,
  isRowLoaded: () => false,
  loadMoreRows: () => Promise.resolve(),
  queryView: EMPTY_QUERY_VIEW,
  rowCount: 0,
  updateFeedback: () => undefined,
};

type QueryKey = [string, QueryView];

function useFetchInfinitFeedbackItems({queryKey}: {queryKey: QueryKey}) {
  const api = useApi();
  const organization = useOrganization();

  const fetchFeedbacks = useCallback(
    (
      context: QueryFunctionContext<QueryKey, any>
    ): Promise<ApiResult<FeedbackItemResponse[]>> => {
      // console.log('fetchFeedbacks', {
      //   meta: context.meta,
      //   pageParam: context.pageParam,
      //   queryKey: context.queryKey,
      //   signal: context.signal,
      // });

      const [_key, queryView] = context.queryKey;
      // const timestampCondition = fromId ? `timestamp:${dir}${fromTimestamp}` : undefined;
      const timestampCondition = '';
      const perPage = 10;
      return api.requestPromise(`/organizations/${organization.slug}/feedback/`, {
        includeAllArgs: true,
        query: {
          ...queryView,
          cursor: `0:0:0`,
          per_page: perPage,
          query: [queryView.query, timestampCondition].filter(Boolean).join(' '),
        },
      });
    },
    [api, organization]
  );

  return useInfiniteQuery(queryKey, fetchFeedbacks, {
    getNextPageParam: (lastPage, pages) => {
      // console.log('getNextPageParam', {lastPage, pages});
      // const [data, , resp] = lastPage;

      return {perPage: 10};
    },
    select: d => {
      const pages = d.pages.flatMap(page => page[0]); // also sort by timestamp and de-dupe?
      console.log('select', {pages, pageParams: d.pageParams});
      return {
        pages,
        pageParams: d.pageParams,
      };
    },
  });
}

export default function useFetchFeedbackInfiniteListData({
  queryView,
}: {
  queryView: QueryView;
}) {
  const {
    data,
    // error,
    fetchNextPage,
    // hasNextPage,
    // isFetching,
    // isFetchingNextPage,
    // status,
  } = useFetchInfinitFeedbackItems({queryKey: ['feedbacks', queryView]});

  const getRow = useCallback(
    ({index}: Index) => {
      // console.log('getRow', {index});
      return data?.pages[index];
    },
    [data?.pages]
  );

  const isRowLoaded = useCallback(
    ({index}: Index) => {
      // console.log('isRowLoaded', {index});
      return Boolean(data?.pages[index]);
    },
    [data?.pages]
  );

  const loadMoreRows = useCallback(
    ({startIndex, stopIndex}: IndexRange) => {
      console.log('loadMoreRows', {startIndex, stopIndex});
      fetchNextPage({cancelRefetch: false, pageParam: {startIndex, stopIndex}});
    },
    [fetchNextPage]
  );

  const updateFeedback = useCallback(({feedbackId: _}: {feedbackId: string}) => {
    // TODO
  }, []);

  const rowCount = useMemo(() => {
    return 0;
  }, []);

  return {
    getRow,
    isError: false,
    isLoading: false,
    isRowLoaded,
    loadMoreRows,
    queryView,
    rowCount,
    updateFeedback,
  };
}
