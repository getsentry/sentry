import {useCallback, useEffect, useMemo, useState} from 'react';
import {logger} from '@sentry/react';

import {type ApiResult} from 'sentry/api';
import {defined} from 'sentry/utils';
import {encodeSort, type EventsMetaType} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {
  fetchDataQuery,
  useApiQuery,
  useInfiniteQuery,
  useQueryClient,
  type ApiQueryKey,
  type InfiniteData,
  type QueryKeyEndpointOptions,
} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  AlwaysPresentLogFields,
  MAX_LOG_INGEST_DELAY,
  MINIMUM_INFINITE_SCROLL_FETCH_COOLDOWN_MS,
  QUERY_PAGE_LIMIT,
  QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH,
} from 'sentry/views/explore/logs/constants';
import {
  useLogsFrozenProjectIds,
  useLogsFrozenReplayInfo,
  useLogsFrozenSearch,
  useLogsFrozenTraceIds,
} from 'sentry/views/explore/logs/logsFrozenContext';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
  type LogsAggregatesResult,
} from 'sentry/views/explore/logs/types';
import {
  isRowVisibleInVirtualStream,
  useVirtualStreaming,
} from 'sentry/views/explore/logs/useVirtualStreaming';
import {getTimeBasedSortBy} from 'sentry/views/explore/logs/utils';
import {
  useQueryParamsAggregateCursor,
  useQueryParamsAggregateSortBys,
  useQueryParamsCursor,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsSortBys,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
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

function useLogsAggregatesQueryKey({
  limit,
  referrer,
}: {
  referrer: string;
  limit?: number;
}) {
  const organization = useOrganization();
  const _search = useQueryParamsSearch();
  const baseSearch = useLogsFrozenSearch();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const location = useLocation();
  const projectIds = useLogsFrozenProjectIds();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const aggregateCursor = useQueryParamsAggregateCursor();
  const fields: string[] = [];
  fields.push(...groupBys.filter(Boolean));
  fields.push(...visualizes.map(visualize => visualize.yAxis));

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const pageFilters = selection;
  const dataset = DiscoverDatasets.OURLOGS;

  const eventView = getEventView(
    search,
    fields,
    aggregateSortBys.slice(),
    pageFilters,
    dataset,
    projectIds ?? pageFilters.projects
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
    eventView: other.eventView,
  };
}

function useLogsQueryKey({
  limit,
  referrer,
  highFidelity,
}: {
  referrer: string;
  highFidelity?: boolean;
  limit?: number;
}) {
  const organization = useOrganization();
  const _search = useQueryParamsSearch();
  const baseSearch = useLogsFrozenSearch();
  const cursor = useQueryParamsCursor();
  const _fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const frozenTraceIds = useLogsFrozenTraceIds();
  const frozenReplayInfo = useLogsFrozenReplayInfo();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const location = useLocation();
  const projectIds = useLogsFrozenProjectIds();
  const groupBys = useQueryParamsGroupBys();

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const fields = Array.from(
    new Set([...AlwaysPresentLogFields, ..._fields, ...groupBys.filter(Boolean)])
  );
  const sorts = sortBys ?? [];
  const pageFilters = selection;
  const dataset = DiscoverDatasets.OURLOGS;

  const eventView = getEventView(
    search,
    fields,
    sorts.slice(),
    pageFilters,
    dataset,
    projectIds ?? pageFilters.projects
  );

  const eventViewPayload = eventView.getEventsAPIPayload(location);

  if (frozenReplayInfo.replayId) {
    delete eventViewPayload.statsPeriod;
    eventViewPayload.start = frozenReplayInfo.replayStartedAt?.toISOString();
    eventViewPayload.end = frozenReplayInfo.replayEndedAt?.toISOString();
  }

  const orderby = eventViewPayload.sort;

  const params = {
    query: {
      ...eventViewPayload,
      ...(frozenTraceIds ? {traceId: frozenTraceIds} : {}),
      ...(frozenReplayInfo.replayId ? {replayId: frozenReplayInfo.replayId} : {}),
      cursor,
      orderby,
      per_page: limit ? limit : undefined,
      referrer,
      sampling: highFidelity ? 'HIGHEST_ACCURACY_FLEX_TIME' : undefined,
    },
    pageFiltersReady,
    eventView,
  };

  const endpointSuffix =
    frozenTraceIds || frozenReplayInfo.replayId ? 'trace-logs' : 'events';

  const queryKey: ApiQueryKey = [
    `/organizations/${organization.slug}/${endpointSuffix}/`,
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
  highFidelity,
}: {
  autoRefresh: boolean;
  referrer: string;
  highFidelity?: boolean;
}) {
  const {queryKey, other} = useLogsQueryKey({
    limit: autoRefresh ? QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH : QUERY_PAGE_LIMIT,
    referrer,
    highFidelity,
  });
  return {
    queryKey: [...queryKey, 'infinite'] as QueryKey,
    other,
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
  autoRefresh: boolean,
  highFidelity?: boolean
) {
  const isGetPreviousPage = pageDirection === 'previous';
  return (
    result: ApiResult<EventsLogsResult>,
    _: unknown,
    pageParam: LogPageParam
  ): LogPageParam => {
    const [pageData, _statusText, response] = result;
    const sortBy = getTimeBasedSortBy(sortBys);

    if (!sortBy) {
      // Only sort by timestamp precise is supported for infinite queries.
      return null;
    }

    const isDescending = sortBy.kind === 'desc';
    // Previous pages have to have the sort order reversed in order to start at the limit from the initial page.
    const querySortDirection: Sort | undefined = isGetPreviousPage
      ? {
          field: OurLogKnownFieldKey.TIMESTAMP,
          kind: isDescending ? 'asc' : 'desc',
        }
      : undefined;

    if (highFidelity || isFlexTimePageParam(pageParam)) {
      const pageLinkHeader = response?.getResponseHeader('Link') ?? null;
      const links = parseLinkHeader(pageLinkHeader);
      const link = isGetPreviousPage ? links.previous : links.next;

      if (!link?.results) {
        return undefined;
      }

      return {
        querySortDirection,
        sortByDirection: sortBy.kind,
        autoRefresh,
        cursor: link.cursor ?? undefined,
      } as FlexTimePageParam;
    }

    const firstRow = pageData.data?.[0];
    const lastRow = pageData.data?.[pageData.data.length - 1];
    if (!firstRow || !lastRow) {
      // No data to paginate, this should not happen as empty pages are removed from the query client.
      // If this does happen, it will stop the infinite query from fetching more pages as "hasNextPage" will be false.
      return pageParam;
    }

    let firstTimestamp: bigint;
    let lastTimestamp: bigint;
    try {
      firstTimestamp = BigInt(firstRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
      lastTimestamp = BigInt(lastRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE]);
    } catch {
      logger.warn(`No timestamp precise found for log row, using timestamp instead`, {
        logId: firstRow[OurLogKnownFieldKey.ID],
        timestamp: firstRow[OurLogKnownFieldKey.TIMESTAMP],
        timestampPrecise: firstRow[OurLogKnownFieldKey.TIMESTAMP_PRECISE],
      });
      firstTimestamp =
        BigInt(new Date(firstRow[OurLogKnownFieldKey.TIMESTAMP]).getTime()) * 1_000_000n;
      lastTimestamp =
        BigInt(new Date(lastRow[OurLogKnownFieldKey.TIMESTAMP]).getTime()) * 1_000_000n;
    }

    const logId = isGetPreviousPage
      ? firstRow[OurLogKnownFieldKey.ID]
      : lastRow[OurLogKnownFieldKey.ID];
    const timestampPrecise = isGetPreviousPage ? firstTimestamp : lastTimestamp;

    const indexFromInitialPage = isGetPreviousPage
      ? (pageParam?.indexFromInitialPage ?? 0) - 1
      : (pageParam?.indexFromInitialPage ?? 0) + 1;

    const pageParamResult: InfiniteScrollPageParam = {
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
function getInitialPageParam(
  autoRefresh: boolean,
  sortBys: readonly Sort[]
): LogPageParam {
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
    timestampPrecise: null,
    sortByDirection: sortBy.kind,
    indexFromInitialPage: 0,
    // No need to override query sort direction for initial page
    querySortDirection: undefined,
    autoRefresh,
  };

  return pageParamResult;
}

export function getMaxIngestDelayTimestamp() {
  return BigInt(Date.now() - MAX_LOG_INGEST_DELAY) * 1_000_000n;
}

export function getIngestDelayFilterValue(timestamp: bigint) {
  return `<=${timestamp}`;
}

function getIngestDelayFilter() {
  return ` ${OurLogKnownFieldKey.TIMESTAMP_PRECISE}:${getIngestDelayFilterValue(getMaxIngestDelayTimestamp())}`;
}

function getParamBasedQuery(
  query: QueryKeyEndpointOptions['query'],
  pageParam: LogPageParam
) {
  if (!pageParam) {
    return query;
  }

  if (isFlexTimePageParam(pageParam)) {
    return {
      ...query,
      cursor: pageParam.cursor,
    };
  }

  const comparison =
    (pageParam.querySortDirection ?? pageParam.sortByDirection === 'asc') ? '>=' : '<=';

  const filter = pageParam.timestampPrecise
    ? `${OurLogKnownFieldKey.TIMESTAMP_PRECISE}:${comparison}${pageParam.timestampPrecise}`
    : '';

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

interface BaseLogsPageParams {
  // Whether the page param is for auto refresh mode.
  autoRefresh: boolean;
  // The original sort direction of the query.
  sortByDirection: Sort['kind'];
  // When scrolling is happening towards current time, or during auto refresh, we flip the sort direction passed to the query to get X more rows in the future starting from the last seen row.
  querySortDirection?: Sort;
}

interface FlexTimePageParam extends BaseLogsPageParams {
  cursor?: string;
}

interface InfiniteScrollPageParam extends BaseLogsPageParams {
  // The index of the page from the initial page. Useful for debugging and testing.
  indexFromInitialPage: number;
  // The id of the log row matching timestampPrecise. We use this to exclude the row from the query to avoid duplicates right on the nanosecond boundary.
  logId: string;
  timestampPrecise: bigint | null;
}

export type LogPageParam = FlexTimePageParam | InfiniteScrollPageParam | null | undefined;

function isFlexTimePageParam(pageParam: LogPageParam): pageParam is FlexTimePageParam {
  return defined(pageParam) && 'cursor' in pageParam;
}

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions, 'infinite'];

export function useInfiniteLogsQuery({
  disabled,
  highFidelity,
  referrer,
}: {
  disabled?: boolean;
  highFidelity?: boolean;
  referrer?: string;
} = {}) {
  const _referrer = referrer ?? 'api.explore.logs-table';
  const autoRefresh = useLogsAutoRefreshEnabled();
  const {queryKey: queryKeyWithInfinite, other} = useLogsQueryKeyWithInfinite({
    referrer: _referrer,
    autoRefresh,
    highFidelity,
  });
  const queryClient = useQueryClient();

  const sortBys = useQueryParamsSortBys();

  const getPreviousPageParam = useCallback(
    (data: ApiResult<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getPageParam(
        'previous',
        sortBys.slice(),
        autoRefresh,
        highFidelity
      )(data, _, pageParam),
    [sortBys, autoRefresh, highFidelity]
  );
  const getNextPageParam = useCallback(
    (data: ApiResult<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getPageParam(
        'next',
        sortBys.slice(),
        autoRefresh,
        highFidelity
      )(data, _, pageParam),
    [sortBys, autoRefresh, highFidelity]
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
    staleTime: autoRefresh ? Infinity : getStaleTimeForEventView(other.eventView),
    maxPages: 30, // This number * the refresh interval must be more seconds than 2 * the smallest time interval in the chart for streaming to work.
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

  const {virtualStreamedTimestamp} = useVirtualStreaming({data, highFidelity});

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
            ...pageData.meta,
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
        ? !isFetching && !isError && fetchNextPage()
        : Promise.resolve(),
    [hasNextPage, fetchNextPage, isFetching, isError, nextPageHasData]
  );

  const lastPageLength = data?.pages?.[data.pages.length - 1]?.[0]?.data?.length ?? 0;
  const limit = autoRefresh ? QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH : QUERY_PAGE_LIMIT;
  const shouldAutoFetchNextPage =
    highFidelity &&
    hasNextPage &&
    nextPageHasData &&
    (lastPageLength === 0 || _data.length < limit);
  const [waitingToAutoFetch, setWaitingToAutoFetch] = useState(false);

  useEffect(() => {
    if (!shouldAutoFetchNextPage) {
      return () => {};
    }

    setWaitingToAutoFetch(true);

    const timeoutID = setTimeout(() => {
      setWaitingToAutoFetch(false);
      _fetchNextPage();
    }, MINIMUM_INFINITE_SCROLL_FETCH_COOLDOWN_MS);

    return () => clearTimeout(timeoutID);
  }, [shouldAutoFetchNextPage, _fetchNextPage]);

  return {
    error,
    isError,
    isFetching,
    isPending:
      // query is still pending
      queryResult.isPending ||
      // query finished but we're waiting to auto fetch the next page
      (waitingToAutoFetch && _data.length === 0) ||
      // started auto fetching the next page
      (shouldAutoFetchNextPage && _data.length === 0 && isFetchingNextPage),
    data: _data,
    meta: _meta,
    isRefetching: queryResult.isRefetching,
    isEmpty:
      !queryResult.isPending &&
      !queryResult.isRefetching &&
      !isError &&
      _data.length === 0 &&
      !shouldAutoFetchNextPage,
    fetchNextPage: _fetchNextPage,
    fetchPreviousPage: _fetchPreviousPage,
    refetch,
    hasNextPage,
    queryKey: queryKeyWithInfinite,
    hasPreviousPage,
    isFetchingNextPage:
      !shouldAutoFetchNextPage && _data.length > 0 && isFetchingNextPage,
    isFetchingPreviousPage,
    lastPageLength,
  };
}

export type UseInfiniteLogsQueryResult = ReturnType<typeof useInfiniteLogsQuery>;

export function useLogsQueryHighFidelity() {
  const organization = useOrganization();
  const sortBys = useQueryParamsSortBys();
  const highFidelity = organization.features.includes('ourlogs-high-fidelity');

  // we can only turn on high accuracy flex time sampling when
  // the order by is exactly timestamp descending,
  return (
    highFidelity &&
    sortBys.length === 1 &&
    sortBys[0]?.field === 'timestamp' &&
    sortBys[0]?.kind === 'desc'
  );
}
