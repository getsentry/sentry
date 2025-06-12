import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {type ApiResult} from 'sentry/api';
import {encodeSort, type EventsMetaType} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {
  type ApiQueryKey,
  fetchDataQuery,
  type InfiniteData,
  type QueryKeyEndpointOptions,
  useApiQuery,
  useInfiniteQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  useLogsAggregate,
  useLogsAggregateCursor,
  useLogsAggregateSortBys,
  useLogsAutoRefresh,
  useLogsBaseSearch,
  useLogsCursor,
  useLogsFields,
  useLogsGroupBy,
  useLogsIsFrozen,
  useLogsLimitToTraceId,
  useLogsProjectIds,
  useLogsRefreshInterval,
  useLogsSearch,
  useLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  usePrefetchTraceItemDetailsOnHover,
  useTraceItemDetails,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  AlwaysPresentLogFields,
  LOG_INGEST_DELAY,
  VIRTUAL_STREAMED_INTERVAL_MS,
} from 'sentry/views/explore/logs/constants';
import {
  type EventsLogsResult,
  type LogsAggregatesResult,
  OurLogKnownFieldKey,
} from 'sentry/views/explore/logs/types';
import {getTimeBasedSortBy} from 'sentry/views/explore/logs/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';

const UNIQUE_ROW_ID = OurLogKnownFieldKey.ID;

export function useExploreLogsTableRow(props: {
  logId: string | number;
  projectId: string;
  traceId: string;
  enabled?: boolean;
}) {
  const {isReady: pageFiltersReady} = usePageFilters();
  return useTraceItemDetails({
    traceItemId: String(props.logId),
    projectId: props.projectId,
    traceId: props.traceId,
    traceItemType: TraceItemDataset.LOGS,
    referrer: 'api.explore.log-item-details',
    enabled: props.enabled && pageFiltersReady,
  });
}

export function usePrefetchLogTableRowOnHover({
  logId,
  projectId,
  traceId,
  hoverPrefetchDisabled,
  sharedHoverTimeoutRef,
}: {
  logId: string | number;
  projectId: string;
  sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  traceId: string;
  hoverPrefetchDisabled?: boolean;
}) {
  return usePrefetchTraceItemDetailsOnHover({
    traceItemId: String(logId),
    projectId,
    traceId,
    traceItemType: TraceItemDataset.LOGS,
    hoverPrefetchDisabled,
    sharedHoverTimeoutRef,
    referrer: 'api.explore.log-item-details',
  });
}

function useLogsAggregatesQueryKey({
  limit,
  referrer,
}: {
  referrer: string;
  limit?: number;
}) {
  const organization = useOrganization();
  const _search = useLogsSearch();
  const baseSearch = useLogsBaseSearch();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const location = useLocation();
  const projectIds = useLogsProjectIds();
  const groupBy = useLogsGroupBy();
  const aggregate = useLogsAggregate();
  const aggregateSortBys = useLogsAggregateSortBys();
  const aggregateCursor = useLogsAggregateCursor();
  const fields: string[] = [];
  if (groupBy) {
    fields.push(groupBy);
  }
  fields.push(aggregate);

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const pageFilters = selection;
  const dataset = DiscoverDatasets.OURLOGS;

  const eventView = getEventView(
    search,
    fields,
    aggregateSortBys,
    pageFilters,
    dataset,
    projectIds
  );
  const params = {
    query: {
      ...eventView.getEventsAPIPayload(location),
      per_page: limit ? limit : undefined,
      cursor: aggregateCursor,
      referrer,
    },
    pageFiltersReady,
    eventView,
  };

  const queryKey: ApiQueryKey = [`/organizations/${organization.slug}/events/`, params];

  return {
    queryKey,
    other: {
      eventView,
      pageFiltersReady,
    },
  };
}

/**
 * Requires LogsParamsContext to be provided.
 */
export function useLogsAggregatesQuery({
  disabled,
  limit,
  referrer,
}: {
  disabled?: boolean;
  limit?: number;
  referrer?: string;
}) {
  const _referrer = referrer ?? 'api.explore.logs-table-aggregates';
  const {queryKey, other} = useLogsAggregatesQueryKey({limit, referrer: _referrer});

  const queryResult = useApiQuery<LogsAggregatesResult>(queryKey, {
    enabled: !disabled,
    staleTime: getStaleTimeForEventView(other.eventView),
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    ...queryResult,
    pageLinks: queryResult?.getResponseHeader?.('Link') ?? undefined,
  };
}

function useLogsQueryKey({limit, referrer}: {referrer: string; limit?: number}) {
  const organization = useOrganization();
  const _search = useLogsSearch();
  const baseSearch = useLogsBaseSearch();
  const cursor = useLogsCursor();
  const _fields = useLogsFields();
  const sortBys = useLogsSortBys();
  const isFrozen = useLogsIsFrozen();
  const limitToTraceId = useLogsLimitToTraceId();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const location = useLocation();
  const projectIds = useLogsProjectIds();

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const fields = Array.from(new Set([...AlwaysPresentLogFields, ..._fields]));
  const sorts = sortBys ?? [];
  const pageFilters = selection;
  const dataset = DiscoverDatasets.OURLOGS;

  const eventView = getEventView(search, fields, sorts, pageFilters, dataset, projectIds);
  const params = {
    query: {
      ...eventView.getEventsAPIPayload(location),
      ...(limitToTraceId ? {traceId: limitToTraceId} : {}),
      cursor,
      per_page: limit ? limit : undefined,
      referrer,
    },
    pageFiltersReady,
    eventView,
  };

  const queryKey: ApiQueryKey = [
    `/organizations/${organization.slug}/${limitToTraceId && isFrozen ? 'trace-logs' : 'events'}/`,
    params,
  ];

  return {
    queryKey,
    other: {
      eventView,
      pageFiltersReady,
    },
  };
}

export function useLogsQueryKeyWithInfinite({referrer}: {referrer: string}) {
  const {queryKey, other} = useLogsQueryKey({limit: 1000, referrer});
  return {
    queryKey: [...queryKey, 'infinite'] as QueryKey,
    other,
  };
}

/**
 * Requires LogsParamsContext to be provided.
 */
export function useLogsQuery({
  disabled,
  limit,
  referrer,
}: {
  disabled?: boolean;
  limit?: number;
  referrer?: string;
}) {
  const _referrer = referrer ?? 'api.explore.logs-table';
  const {queryKey, other} = useLogsQueryKey({limit, referrer: _referrer});

  const queryResult = useApiQuery<EventsLogsResult>(queryKey, {
    enabled: !disabled,
    staleTime: getStaleTimeForEventView(other.eventView),
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    isPending: queryResult.isPending,
    isError: queryResult.isError,
    isLoading: queryResult.isLoading,
    queryResult,
    data: queryResult?.data?.data,
    infiniteData: queryResult?.data?.data,
    error: queryResult.error,
    meta: queryResult?.data?.meta,
    pageLinks: queryResult?.getResponseHeader?.('Link') ?? undefined,
  };
}

/**
 * The page param represents a page of log data, we always use the timestamp precise field as timestamp is too inaccurate for high resolution logs.
 * Pages are represented by a window of time using the precise timestamp of either it's most recent or oldest row, depending on sort direction and which page we're fetching.
 * We will overlap pages on the nanosecond boundary (using => and <=) because events can happen on the same timestamp.
 */
function getPageParam(pageDirection: 'previous' | 'next', sortBys: Sort[]) {
  const isGetPreviousPage = pageDirection === 'previous';
  return (
    [pageData]: ApiResult<EventsLogsResult>,
    _: unknown,
    pageParam: LogPageParam
  ): LogPageParam => {
    const sortBy = getTimeBasedSortBy(sortBys);
    if (!sortBy) {
      // Only sort by timestamp precise is supported for infinite queries.
      return null;
    }
    const firstRow = pageData.data?.[0];
    const lastRow = pageData.data?.[pageData.data.length - 1];
    if (!firstRow || !lastRow) {
      // No data to paginate, this should not happen as empty pages are removed from the query client.
      // If this does happen, it will stop the infinite query from fetching more pages as "hasNextPage" will be false.
      return pageParam;
    }

    const firstTimestamp = BigInt(firstRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
    const lastTimestamp = BigInt(lastRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);

    const timestampPrecise = isGetPreviousPage ? firstTimestamp : lastTimestamp;
    const logId = isGetPreviousPage
      ? firstRow[OurLogKnownFieldKey.ID]
      : lastRow[OurLogKnownFieldKey.ID];
    const isDescending = sortBy.kind === 'desc';
    let querySortDirection: Sort | undefined = undefined;
    const reverseSortDirection = isDescending ? 'asc' : 'desc';

    if (isGetPreviousPage) {
      // Previous pages have to have the sort order reversed in order to start at the limit from the initial page.
      querySortDirection = {
        field: OurLogKnownFieldKey.TIMESTAMP,
        kind: reverseSortDirection,
      };
    }

    const indexFromInitialPage = isGetPreviousPage
      ? (pageParam?.indexFromInitialPage ?? 0) - 1
      : (pageParam?.indexFromInitialPage ?? 0) + 1;

    const pageParamResult: LogPageParam = {
      logId,
      timestampPrecise,
      querySortDirection,
      sortByDirection: sortBy.kind,
      indexFromInitialPage,
    };

    return pageParamResult;
  };
}

function getLogIngestDelay() {
  return `${OurLogKnownFieldKey.TIMESTAMP_PRECISE}:<=${(Date.now() - LOG_INGEST_DELAY) * 1_000_000}`;
}

function getParamBasedQuery(
  query: QueryKeyEndpointOptions['query'],
  pageParam: LogPageParam
) {
  if (!pageParam) {
    return query;
  }
  const comparison =
    (pageParam.querySortDirection ?? pageParam.sortByDirection === 'asc') ? '>=' : '<=';
  const filter = `${OurLogKnownFieldKey.TIMESTAMP_PRECISE}:${comparison}${pageParam.timestampPrecise} !${OurLogKnownFieldKey.ID}:${pageParam.logId} ${getLogIngestDelay()}`;

  return {
    ...query,
    query: [filter, query?.query].filter(Boolean).join(' AND '),
    sort: pageParam.querySortDirection
      ? encodeSort(pageParam.querySortDirection)
      : query?.sort,
  };
}

interface PageParam {
  // The index of the page from the initial page. Useful for debugging and testing.
  indexFromInitialPage: number;
  // The id of the log row matching timestampPrecise. We use this to exclude the row from the query to avoid duplicates right on the nanosecond boundary.
  logId: string;
  // The original sort direction of the query.
  sortByDirection: Sort['kind'];
  timestampPrecise: bigint;
  // When scrolling is happening towards current time, or during auto refresh, we flip the sort direction passed to the query to get X more rows in the future starting from the last seen row.
  querySortDirection?: Sort;
}

export type LogPageParam = PageParam | null | undefined;

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions, 'infinite'];

export function useInfiniteLogsQuery({
  disabled,
  referrer,
}: {
  disabled?: boolean;
  referrer?: string;
} = {}) {
  const _referrer = referrer ?? 'api.explore.logs-table';
  const {queryKey: queryKeyWithInfinite, other} = useLogsQueryKeyWithInfinite({
    referrer: _referrer,
  });
  const queryClient = useQueryClient();
  const sortBys = useLogsSortBys();
  const autoRefresh = useLogsAutoRefresh();

  const getPreviousPageParam = useCallback(
    (data: ApiResult<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getPageParam('previous', sortBys)(data, _, pageParam),
    [sortBys]
  );
  const getNextPageParam = useCallback(
    (data: ApiResult<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getPageParam('next', sortBys)(data, _, pageParam),
    [sortBys]
  );
  const queryResult = useInfiniteQuery<
    ApiResult<EventsLogsResult>,
    Error,
    InfiniteData<ApiResult<EventsLogsResult>>,
    QueryKey,
    LogPageParam
  >({
    queryKey: queryKeyWithInfinite,
    queryFn: async ({
      pageParam,
      queryKey: [url, endpointOptions],
      client,
      signal,
      meta,
    }): Promise<ApiResult<EventsLogsResult>> => {
      const result = await fetchDataQuery({
        queryKey: [
          url,
          {
            ...endpointOptions,
            query: getParamBasedQuery(endpointOptions?.query, pageParam),
          },
        ],
        client,
        signal,
        meta,
      });

      const resultData = (result[0] as {data?: EventsLogsResult['data']})?.data;
      if (pageParam?.querySortDirection && Array.isArray(resultData)) {
        // We reverse the data if the query sort direction has been changed from the table sort direction.
        result[0] = {
          ...(result[0] as {data?: EventsLogsResult['data']}),
          data: [...resultData].reverse(),
        };
      }
      return result as ApiResult<EventsLogsResult>;
    },
    getPreviousPageParam,
    getNextPageParam,
    initialPageParam: null,
    enabled: !disabled,
    staleTime: getStaleTimeForEventView(other.eventView),
    maxPages: 10,
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
    isPending,
  } = queryResult;

  useEffect(() => {
    // Remove empty pages from the query data. In the case of auto refresh it's possible that the most recent page in time is empty.
    queryClient.setQueryData(
      queryKeyWithInfinite,
      (oldData: InfiniteData<ApiResult<EventsLogsResult>> | undefined) => {
        if (!oldData) {
          return oldData;
        }
        const pageIndexWithMostRecentTimestamp =
          getTimeBasedSortBy(sortBys)?.kind === 'asc' ? 0 : oldData.pages.length - 1;

        if (
          (oldData.pages?.[pageIndexWithMostRecentTimestamp]?.[0]?.data?.length ?? 0) > 0
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
      }
    );
  }, [queryClient, queryKeyWithInfinite, sortBys]);

  const numberOfPages = data?.pages.length ?? 0;

  const {virtualStreamedTimestamp} = useVirtualStreaming(numberOfPages);

  const _data = useMemo(() => {
    const usedRowIds = new Set();
    return (
      data?.pages.flatMap(([pageData]) =>
        pageData.data.filter(row => {
          if (usedRowIds.has(row[UNIQUE_ROW_ID])) {
            return false;
          }
          if (virtualStreamedTimestamp) {
            const rowTimestamp =
              BigInt(row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]) / 1_000_000n;
            if (rowTimestamp > virtualStreamedTimestamp) {
              return false;
            }
          }
          usedRowIds.add(row[UNIQUE_ROW_ID]);
          return true;
        })
      ) ?? []
    );
  }, [data, virtualStreamedTimestamp]);

  const _meta = useMemo<EventsMetaType>(() => {
    return (
      data?.pages.reduce(
        (acc, [pageData]) => {
          return {
            fields: {...acc.fields, ...pageData.meta?.fields},
            units: {...acc.units, ...pageData.meta?.units},
          };
        },
        {fields: {}, units: {}}
      ) ?? {fields: {}, units: {}}
    );
  }, [data]);

  const _fetchPreviousPage = useCallback(() => {
    // When auto-refresh is enabled it's possible that the previous page is empty, but we'll try to fetch it anyway.
    if (autoRefresh || hasPreviousPage) {
      return !isFetchingPreviousPage && !isError && fetchPreviousPage();
    }
    return Promise.resolve();
  }, [hasPreviousPage, fetchPreviousPage, isFetchingPreviousPage, isError, autoRefresh]);

  const nextPageHasData =
    parseLinkHeader(
      data?.pages?.[data.pages.length - 1]?.[2]?.getResponseHeader('Link') ?? null
    )?.next?.results ?? false;

  const _fetchNextPage = useCallback(
    () =>
      hasNextPage && nextPageHasData
        ? !isFetchingNextPage && !isError && fetchNextPage()
        : Promise.resolve(),
    [hasNextPage, fetchNextPage, isFetchingNextPage, isError, nextPageHasData]
  );

  return {
    error,
    isError,
    isFetching, // If the network is active
    isPending,
    data: _data,
    meta: _meta,
    isEmpty: !isPending && !isError && _data.length === 0,
    fetchNextPage: _fetchNextPage,
    fetchPreviousPage: _fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    lastPageLength: data?.pages?.[data.pages.length - 1]?.[0]?.data?.length ?? 0,
  };
}

function useVirtualStreaming(numberOfPages: number) {
  const autoRefresh = useLogsAutoRefresh();
  const refreshInterval = useLogsRefreshInterval();
  const rafOn = useRef(false);
  const [virtualStreamedQueryTimestamp, setVirtualStreamedQueryTimestamp] = useState(
    Date.now()
  );

  useEffect(() => {
    let rafId = 0;
    rafOn.current = autoRefresh;
    if (autoRefresh) {
      const callback = () => {
        if (!rafOn.current) {
          return;
        }
        const targetVirtualTime = Date.now() - LOG_INGEST_DELAY;
        setVirtualStreamedQueryTimestamp(prev => {
          if (prev + VIRTUAL_STREAMED_INTERVAL_MS > targetVirtualTime) {
            return prev;
          }
          return prev + VIRTUAL_STREAMED_INTERVAL_MS;
        });
        rafId = requestAnimationFrame(callback);
      };

      rafId = requestAnimationFrame(callback);
    }

    return () => {
      rafOn.current = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [autoRefresh]);

  const virtualStreamedTimestamp = useMemo(() => {
    if (!autoRefresh || numberOfPages < 2) {
      return undefined;
    }
    return virtualStreamedQueryTimestamp - refreshInterval - 1000; // We subtract the refresh interval when it comes to the UI updated virtual time
  }, [autoRefresh, numberOfPages, refreshInterval, virtualStreamedQueryTimestamp]);

  if (!autoRefresh || numberOfPages < 2) {
    return {
      virtualStreamedQueryTimestamp: undefined,
      virtualStreamedTimestamp: undefined,
    };
  }

  return {virtualStreamedQueryTimestamp, virtualStreamedTimestamp};
}

export type UseLogsQueryResult = ReturnType<typeof useLogsQuery>;
export type UseInfiniteLogsQueryResult = ReturnType<typeof useInfiniteLogsQuery>;
