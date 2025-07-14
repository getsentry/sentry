import {useCallback, useEffect, useMemo} from 'react';

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
  useLogsSearch,
  useLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  usePrefetchTraceItemDetailsOnHover,
  useTraceItemDetails,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  AlwaysPresentLogFields,
  MAX_LOG_INGEST_DELAY,
  QUERY_PAGE_LIMIT,
  QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH,
} from 'sentry/views/explore/logs/constants';
import {
  type EventsLogsResult,
  type LogsAggregatesResult,
  OurLogKnownFieldKey,
} from 'sentry/views/explore/logs/types';
import {
  isRowVisibleInVirtualStream,
  useVirtualStreaming,
} from 'sentry/views/explore/logs/useVirtualStreaming';
import {getTimeBasedSortBy} from 'sentry/views/explore/logs/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';

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
  const groupBy = useLogsGroupBy();

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const fields = Array.from(
    new Set([...AlwaysPresentLogFields, ..._fields, ...(groupBy ? [groupBy] : [])])
  );
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

export function useLogsQueryKeyWithInfinite({
  referrer,
  autoRefresh,
}: {
  autoRefresh: boolean;
  referrer: string;
}) {
  const {queryKey, other} = useLogsQueryKey({
    limit: autoRefresh ? QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH : QUERY_PAGE_LIMIT,
    referrer,
  });
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
function getPageParam(
  pageDirection: 'previous' | 'next',
  sortBys: Sort[],
  autoRefresh: boolean
) {
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

    const logId = isGetPreviousPage
      ? firstRow[OurLogKnownFieldKey.ID]
      : lastRow[OurLogKnownFieldKey.ID];
    const isDescending = sortBy.kind === 'desc';
    const timestampPrecise = isGetPreviousPage ? firstTimestamp : lastTimestamp;
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
      autoRefresh,
    };

    return pageParamResult;
  };
}

/**
 * Creates an initial page param for autoRefresh mode that enforces the MAX_LOG_INGEST_DELAY condition.
 * This ensures the first page query filters for logs older than Date.now() - MAX_LOG_INGEST_DELAY
 * which means the next logs page fetched will have results instead of having to wait for the MAX_LOG_INGEST_DELAY to pass.
 */
function getInitialPageParam(autoRefresh: boolean, sortBys: Sort[]): LogPageParam {
  if (!autoRefresh) {
    return null;
  }

  const sortBy = getTimeBasedSortBy(sortBys);
  if (!sortBy) {
    // Only sort by timestamp precise is supported for infinite queries.
    return null;
  }

  const pageParamResult: LogPageParam = {
    // Use an empty logId since we don't have a specific log to exclude yet
    logId: '',
    timestampPrecise: getMaxIngestDelayTimestamp(),
    sortByDirection: sortBy.kind,
    indexFromInitialPage: 0,
    // No need to override query sort direction for initial page
    querySortDirection: undefined,
    autoRefresh,
  };

  return pageParamResult;
}

function getMaxIngestDelayTimestamp() {
  return BigInt(Date.now() - MAX_LOG_INGEST_DELAY) * 1_000_000n;
}

function getIngestDelayFilter() {
  const maxIngestDelayTimestamp = getMaxIngestDelayTimestamp();
  return ` ${OurLogKnownFieldKey.TIMESTAMP_PRECISE}:<=${maxIngestDelayTimestamp}`;
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

  const filter = `${OurLogKnownFieldKey.TIMESTAMP_PRECISE}:${comparison}${pageParam.timestampPrecise}`;

  const ingestDelayFilter = pageParam.autoRefresh ? getIngestDelayFilter() : '';
  // Only add the logId exclusion filter if we have a valid logId from the previous page.
  const logIdFilter = pageParam.logId
    ? ` !${OurLogKnownFieldKey.ID}:${pageParam.logId}`
    : '';

  return {
    ...query,
    query: [filter + logIdFilter + ingestDelayFilter, query?.query]
      .filter(Boolean)
      .join(' AND '),
    sort: pageParam.querySortDirection
      ? encodeSort(pageParam.querySortDirection)
      : query?.sort,
  };
}

interface PageParam {
  // Whether the page param is for auto refresh mode.
  autoRefresh: boolean;
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
  const autoRefresh = useLogsAutoRefresh();
  const {queryKey: queryKeyWithInfinite, other} = useLogsQueryKeyWithInfinite({
    referrer: _referrer,
    autoRefresh,
  });
  const queryClient = useQueryClient();
  const sortBys = useLogsSortBys();

  const getPreviousPageParam = useCallback(
    (data: ApiResult<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getPageParam('previous', sortBys, autoRefresh)(data, _, pageParam),
    [sortBys, autoRefresh]
  );
  const getNextPageParam = useCallback(
    (data: ApiResult<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getPageParam('next', sortBys, autoRefresh)(data, _, pageParam),
    [sortBys, autoRefresh]
  );

  const initialPageParam = useMemo(
    () => getInitialPageParam(autoRefresh, sortBys),
    [autoRefresh, sortBys]
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
    initialPageParam,
    enabled: !disabled,
    staleTime: getStaleTimeForEventView(other.eventView),
    maxPages: 15,
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

  const {virtualStreamedTimestamp} = useVirtualStreaming(data);

  const _data = useMemo(() => {
    const usedRowIds = new Set();
    const filteredData =
      data?.pages.flatMap(([pageData]) =>
        pageData.data.filter(row => {
          if (usedRowIds.has(row[OurLogKnownFieldKey.ID])) {
            return false;
          }

          if (!isRowVisibleInVirtualStream(row, virtualStreamedTimestamp)) {
            return false;
          }

          usedRowIds.add(row[OurLogKnownFieldKey.ID]);
          return true;
        })
      ) ?? [];

    return filteredData;
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
    isFetching,
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

export type UseLogsQueryResult = ReturnType<typeof useLogsQuery>;
export type UseInfiniteLogsQueryResult = ReturnType<typeof useInfiniteLogsQuery>;
