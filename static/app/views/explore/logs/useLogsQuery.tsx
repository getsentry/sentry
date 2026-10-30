import {useCallback, useEffect, useMemo, useState} from 'react';
import type {QueryClient} from '@tanstack/react-query';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';

import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {parseQueryKey, type QueryKeyEndpointOptions} from 'sentry/utils/api/apiQueryKey';
import {defined} from 'sentry/utils/defined';
import {type EventsMetaType} from 'sentry/utils/discover/eventView';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  LOCAL_LOG_ROWS_FOR_EXPANDED_INFINITE_PAGES,
  MAX_LOGS_INFINITE_QUERY_PAGES,
  MAX_LOGS_INFINITE_QUERY_PAGES_EXPANDED,
  QUERY_PAGE_LIMIT,
  QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH,
} from 'sentry/views/explore/logs/constants';
import {
  getInitialLogPageParam,
  getLogPageParam,
  getParamBasedQuery,
  isAnchoredPageParam,
  type LogPageParam,
} from 'sentry/views/explore/logs/logsInfinitePageParams';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {useAutoFetchWindow} from 'sentry/views/explore/logs/useAutoFetchWindow';
import {useLogAnchor} from 'sentry/views/explore/logs/useLogAnchor';
import {
  useLogsApiOptionsWithInfinite,
  type LogsInfiniteQueryKey,
} from 'sentry/views/explore/logs/useLogsApiOptions';
import {
  isRowVisibleInVirtualStream,
  useVirtualStreaming,
} from 'sentry/views/explore/logs/useVirtualStreaming';
import {getTimeBasedSortBy} from 'sentry/views/explore/logs/utils';
import {useQueryParamsSortBys} from 'sentry/views/explore/queryParams/context';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';

/**
 * `maxPages` is evaluated before `useInfiniteQuery` returns `data`, so we base it on the
 * query cache (same snapshot React Query will use for this key).
 */
function maxPagesForLogsInfiniteQuery(
  client: QueryClient,
  queryKey: LogsInfiniteQueryKey
): number {
  const cached = client.getQueryData(queryKey);
  const rows =
    cached?.pages?.reduce((n, page) => n + (page.json?.data?.length ?? 0), 0) ?? 0;
  return rows < LOCAL_LOG_ROWS_FOR_EXPANDED_INFINITE_PAGES
    ? MAX_LOGS_INFINITE_QUERY_PAGES_EXPANDED
    : MAX_LOGS_INFINITE_QUERY_PAGES;
}

export function useInfiniteLogsQuery({
  disabled,
  highFidelity,
  staleTime: staleTimeOverride,
}: {
  disabled?: boolean;
  highFidelity?: boolean;
  staleTime?: number;
} = {}) {
  const _referrer = 'api.explore.logs-table';
  const autoRefresh = useLogsAutoRefreshEnabled();

  const {infiniteApiOptions: anchoredApiOptions} = useLogsApiOptionsWithInfinite({
    referrer: _referrer,
    autoRefresh: false,
    highAccuracy: true,
  });
  const {anchor, anchorToLog, clearAnchor} = useLogAnchor({
    autoRefresh,
    queryKey: anchoredApiOptions.queryKey,
  });

  highFidelity = anchor ? false : highFidelity;

  const {infiniteApiOptions: baseApiOptions, other} = useLogsApiOptionsWithInfinite({
    referrer: _referrer,
    autoRefresh,
    highFidelity,
  });
  const infiniteApiOptions = anchor ? anchoredApiOptions : baseApiOptions;
  const queryKeyWithInfinite = infiniteApiOptions.queryKey;
  const queryClient = useQueryClient();

  const sortBys = useQueryParamsSortBys();

  const getPreviousPageParam = useCallback(
    (data: ApiResponse<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getLogPageParam(
        'previous',
        sortBys.slice(),
        autoRefresh,
        highFidelity
      )(data, _, pageParam),
    [sortBys, autoRefresh, highFidelity]
  );
  const getNextPageParam = useCallback(
    (data: ApiResponse<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getLogPageParam(
        'next',
        sortBys.slice(),
        autoRefresh,
        highFidelity
      )(data, _, pageParam),
    [sortBys, autoRefresh, highFidelity]
  );

  const initialPageParam = useMemo(
    () => getInitialLogPageParam(autoRefresh, sortBys, anchor),
    [anchor, autoRefresh, sortBys]
  );

  const queryResult = useInfiniteQuery({
    queryKey: queryKeyWithInfinite,
    queryFn: async ({pageParam, queryKey, client, signal, meta}) => {
      const {url, options: baseOptions} = parseQueryKey(queryKey);

      // Build a v2 (non-infinite) query key for apiFetch — we drive pagination via
      // the query body, not via Link cursors, so we don't need apiFetchInfinite.
      const fetchContext = {
        client,
        signal,
        meta,
      };

      async function fetchPage(param: LogPageParam) {
        let response = await apiFetch<EventsLogsResult>({
          ...fetchContext,
          queryKey: [
            url,
            {
              ...baseOptions,
              query: getParamBasedQuery(baseOptions?.query, param),
            },
            {infinite: false},
          ],
        });

        if (
          !response.json?.data?.length && // no matches found
          response.json?.meta?.dataScanned === 'partial' && // partial scan performed
          !baseOptions?.data?.highFidelity // not high fidelity mode
        ) {
          const retryOptions: QueryKeyEndpointOptions = {
            ...baseOptions,
            query: {...baseOptions?.query, sampling: SAMPLING_MODE.HIGH_ACCURACY},
          };
          response = await apiFetch<EventsLogsResult>({
            ...fetchContext,
            queryKey: [
              url,
              {
                ...retryOptions,
                query: getParamBasedQuery(retryOptions.query, param),
              },
              {infinite: false},
            ],
          });
        }

        if (param?.querySortDirection && Array.isArray(response.json?.data)) {
          // We reverse the data if the query sort direction has been changed from the table sort direction.
          return {
            ...response,
            json: {...response.json, data: response.json.data.toReversed()},
          };
        }
        return response;
      }

      if (!isAnchoredPageParam(pageParam)) {
        return fetchPage(pageParam);
      }

      const [before, after] = await Promise.all([
        fetchPage({
          ...pageParam,
          querySortDirection: {
            field: OurLogKnownFieldKey.TIMESTAMP,
            kind: pageParam.sortByDirection === 'desc' ? 'asc' : 'desc',
          },
        }),
        fetchPage(pageParam),
      ]);

      return {
        ...after,
        json: {...after.json, data: [...before.json.data, ...after.json.data]},
      };
    },
    getPreviousPageParam,
    getNextPageParam,
    initialPageParam,
    enabled: !disabled,
    staleTime:
      staleTimeOverride ??
      (autoRefresh ? Infinity : getStaleTimeForEventView(other.eventView)),
    maxPages: maxPagesForLogsInfiniteQuery(queryClient, queryKeyWithInfinite),
    refetchIntervalInBackground: true, // Don't refetch when tab is not visible
  });

  const {
    data,
    error,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isError,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
    refetch,
  } = queryResult;

  useEffect(() => {
    // Remove empty pages from the query data. In the case of auto refresh it's possible that the most recent page in time is empty.
    queryClient.setQueryData(queryKeyWithInfinite, oldData => {
      if (!oldData) {
        return oldData;
      }

      if (highFidelity) {
        // When high fidelity is enabled, the strategy for cleaning out the cached data is a little different.
        // Each page contains the cursor to the next page so we can't just remove empty pages. Instead, we
        // remove all empty pages excluding the first and last page. Those are always kept around.
        // And allow react-query to pop off pages from the ends as needed once we reach max pages.
        const keepPages = oldData.pages.map((page, index) => {
          // always keep the first and last page
          if (index === 0 || index === oldData.pages.length - 1) {
            return true;
          }
          const pageLength = page.json?.data?.length ?? 0;
          return pageLength !== 0;
        });

        const pages = oldData.pages.filter((_, index) => keepPages[index]);
        const pageParams = oldData.pageParams.filter((_, index) => keepPages[index]);

        return {
          pages,
          pageParams,
        };
      }

      const pageIndexWithMostRecentTimestamp =
        getTimeBasedSortBy(sortBys)?.kind === 'asc' ? 0 : oldData.pages.length - 1;

      if (
        (oldData.pages?.[pageIndexWithMostRecentTimestamp]?.json?.data?.length ?? 0) > 0
      ) {
        return oldData;
      }

      return {
        pages: oldData.pages.filter(
          (_, index) => index !== pageIndexWithMostRecentTimestamp
        ),
        pageParams: oldData.pageParams.filter(
          (_, index) => index !== pageIndexWithMostRecentTimestamp
        ),
      };
    });
  }, [highFidelity, queryClient, queryKeyWithInfinite, sortBys]);

  const {virtualStreamedTimestamp} = useVirtualStreaming({data, highFidelity});

  // Due to the way we prune empty pages, we cannot simply compute the sum of bytes scanned
  // for all pages as most empty pages would have been evicted already.
  //
  // Instead, we watch the last page loaded, and keep a running sum that is reset when
  // the last page is falsey which corresponds to a query change.
  const [totalBytesScanned, setTotalBytesScanned] = useState(0);
  const lastPage = data?.pages?.[data?.pages?.length - 1];
  useEffect(() => {
    if (!lastPage) {
      setTotalBytesScanned(0);
      return;
    }

    const bytesScanned = lastPage.json.meta?.bytesScanned;
    if (!defined(bytesScanned)) {
      return;
    }

    setTotalBytesScanned(previousBytesScanned => previousBytesScanned + bytesScanned);
  }, [lastPage]);

  const {rows: _data, routingHintsByRow} = useMemo(() => {
    const usedRowIds = new Set();
    const hints = new Map<OurLogsResponseItem, string | undefined>();
    const rows =
      data?.pages.flatMap(page =>
        page.json.data.filter(row => {
          if (usedRowIds.has(row[OurLogKnownFieldKey.ID])) {
            return false;
          }

          if (!isRowVisibleInVirtualStream(row, virtualStreamedTimestamp)) {
            return false;
          }

          usedRowIds.add(row[OurLogKnownFieldKey.ID]);
          hints.set(row, page.json.meta?.routingHint);
          return true;
        })
      ) ?? [];
    return {rows, routingHintsByRow: hints};
  }, [data, virtualStreamedTimestamp]);

  const pageCount = data?.pages?.length;
  const _meta = useMemo<EventsMetaType>(() => {
    return (
      data?.pages.reduce(
        (acc, page) => {
          return {
            ...page.json.meta,
            fields: {...acc.fields, ...page.json.meta?.fields},
            units: {...acc.units, ...page.json.meta?.units},
          };
        },
        {fields: {}, units: {}}
      ) ?? {fields: {}, units: {}}
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount]);

  const _fetchPreviousPage = useCallback(() => {
    if (autoRefresh || hasPreviousPage) {
      return !isFetchingPreviousPage && !isError && fetchPreviousPage();
    }
    return Promise.resolve();
  }, [hasPreviousPage, fetchPreviousPage, isFetchingPreviousPage, isError, autoRefresh]);

  const nextPageLink = parseLinkHeader(
    data?.pages?.[data.pages.length - 1]?.headers.Link ?? null
  )?.next;
  const nextPageHasData = nextPageLink?.results ?? false;
  const nextPageCursor = nextPageLink?.cursor;

  const _fetchNextPage = useCallback(
    () =>
      hasNextPage && nextPageHasData
        ? !isFetching && !isError && fetchNextPage()
        : Promise.resolve(),
    [hasNextPage, fetchNextPage, isFetching, isError, nextPageHasData]
  );

  const dataScannedList = data?.pages?.map(page => page.json.meta?.dataScanned);
  const dataScanned = defined(dataScannedList)
    ? dataScannedList.includes('partial')
      ? ('partial' as const)
      : ('full' as const)
    : undefined;
  const lastPageLength = data?.pages?.[data.pages.length - 1]?.json?.data?.length ?? 0;
  const limit = autoRefresh ? QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH : QUERY_PAGE_LIMIT;

  const canAutoFetchNextPage =
    !!highFidelity &&
    hasNextPage &&
    nextPageHasData &&
    (lastPageLength === 0 || _data.length < limit);

  const {shouldAutoFetchNextPage, resumeAutoFetch} = useAutoFetchWindow({
    queryKey: queryKeyWithInfinite,
    canAutoFetchNextPage,
    isFetchingNextPage,
    nextPageCursor,
    fetchNextPage: _fetchNextPage,
  });

  return {
    error,
    isError,
    isFetching,
    isPending:
      // query is still pending
      queryResult.isPending ||
      // started auto fetching the next page
      (_data.length === 0 && (isFetchingNextPage || shouldAutoFetchNextPage)),
    data: _data,
    routingHintsByRow,
    meta: _meta,
    isRefetching: queryResult.isRefetching,
    isEmpty:
      !queryResult.isPending &&
      !queryResult.isRefetching &&
      !isFetchingNextPage &&
      !isError &&
      _data.length === 0 &&
      !shouldAutoFetchNextPage,
    fetchNextPage: _fetchNextPage,
    fetchPreviousPage: _fetchPreviousPage,
    refetch,
    hasNextPage,
    queryKey: queryKeyWithInfinite,
    hasPreviousPage,
    isFetchingNextPage: _data.length > 0 && isFetchingNextPage,
    isFetchingPreviousPage,
    lastPageLength,
    canResumeAutoFetch: canAutoFetchNextPage,
    resumeAutoFetch,
    dataScanned,
    bytesScanned: totalBytesScanned,
    anchor,
    anchorToLog,
    clearAnchor,
  };
}

export type UseInfiniteLogsQueryResult = ReturnType<typeof useInfiniteLogsQuery>;
