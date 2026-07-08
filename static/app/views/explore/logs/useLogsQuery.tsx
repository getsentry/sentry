import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {logger} from '@sentry/react';
import type {QueryClient} from '@tanstack/react-query';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {parseQueryKey, type QueryKeyEndpointOptions} from 'sentry/utils/api/apiQueryKey';
import {defined} from 'sentry/utils/defined';
import {encodeSort, type EventsMetaType} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useLogsAutoRefresh,
  useLogsAutoRefreshEnabled,
} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  AlwaysPresentLogFields,
  LOCAL_LOG_ROWS_FOR_EXPANDED_INFINITE_PAGES,
  LOGS_HIGH_FIDELITY_INITIAL_AUTO_FETCH_WINDOW_MS,
  LOGS_HIGH_FIDELITY_RESUMED_AUTO_FETCH_WINDOW_MS,
  MAX_LOG_INGEST_DELAY,
  MAX_LOGS_INFINITE_QUERY_PAGES,
  MAX_LOGS_INFINITE_QUERY_PAGES_EXPANDED,
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
} from 'sentry/views/explore/logs/types';
import {useLogsQueryTruncate} from 'sentry/views/explore/logs/useLogsQueryTruncate';
import {
  isRowVisibleInVirtualStream,
  useVirtualStreaming,
} from 'sentry/views/explore/logs/useVirtualStreaming';
import {getTimeBasedSortBy} from 'sentry/views/explore/logs/utils';
import {
  useQueryParamsCursor,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';

export function useExploreLogsTableRow(props: {
  logId: string | number;
  projectId: string;
  traceId: string;
  enabled?: boolean;
  timestamp?: number | null;
}) {
  const {isReady: pageFiltersReady} = usePageFilters();
  return useTraceItemDetails({
    traceItemId: String(props.logId),
    projectId: props.projectId,
    traceId: props.traceId,
    traceItemType: TraceItemDataset.LOGS,
    referrer: 'api.explore.log-item-details',
    enabled: props.enabled && pageFiltersReady,
    timestamp: props.timestamp,
  });
}

function useLogsApiOptions({
  limit,
  referrer,
  highFidelity,
  highAccuracy,
}: {
  referrer: string;
  highAccuracy?: boolean;
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
  const [caseInsensitive] = useCaseInsensitivity();
  const truncate = useLogsQueryTruncate();

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

  const baseQuery = {
    ...eventViewPayload,
    ...(frozenTraceIds ? {traceId: frozenTraceIds} : {}),
    ...(frozenReplayInfo.replayId ? {replayId: frozenReplayInfo.replayId} : {}),
    cursor,
    orderby,
    per_page: limit ? limit : undefined,
    referrer,
    sampling: highFidelity
      ? SAMPLING_MODE.FLEX_TIME
      : highAccuracy
        ? SAMPLING_MODE.HIGH_ACCURACY
        : SAMPLING_MODE.NORMAL,
    caseInsensitive: caseInsensitive ? '1' : undefined,
    truncate,
  };

  const usesTraceLogsEndpoint = Boolean(frozenTraceIds || frozenReplayInfo.replayId);

  // The trace-logs endpoint treats an empty `query` as a real (non-null) additional
  // filter and would build a malformed `(...) and ` query. When there's no search to
  // apply (e.g. a combined replay + trace freeze relies on the endpoint's native OR of
  // the traceId/replayId params), omit the param entirely.
  const {query: searchQuery, ...baseQueryWithoutSearch} = baseQuery;
  const query =
    usesTraceLogsEndpoint && !searchQuery ? baseQueryWithoutSearch : baseQuery;

  const path = {organizationIdOrSlug: organization.slug};
  const data = {highFidelity};

  const infiniteApiOptions =
    frozenTraceIds || frozenReplayInfo.replayId
      ? apiOptions.asInfinite<EventsLogsResult>()(
          '/organizations/$organizationIdOrSlug/trace-logs/',
          {path, query, data, staleTime: 0}
        )
      : apiOptions.asInfinite<EventsLogsResult>()(
          '/organizations/$organizationIdOrSlug/events/',
          {path, query, data, staleTime: 0}
        );

  return {infiniteApiOptions, eventView, pageFiltersReady};
}

export function useLogsApiOptionsWithInfinite({
  referrer,
  autoRefresh,
  highAccuracy,
  highFidelity,
}: {
  autoRefresh: boolean;
  referrer: string;
  highAccuracy?: boolean;
  highFidelity?: boolean;
}) {
  const {infiniteApiOptions, eventView, pageFiltersReady} = useLogsApiOptions({
    limit: autoRefresh ? QUERY_PAGE_LIMIT_WITH_AUTO_REFRESH : QUERY_PAGE_LIMIT,
    referrer,
    highAccuracy,
    highFidelity,
  });
  return {
    infiniteApiOptions,
    other: {
      eventView,
      pageFiltersReady,
    },
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
    result: ApiResponse<EventsLogsResult>,
    _: unknown,
    pageParam: LogPageParam
  ): LogPageParam => {
    const pageData = result.json;
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
      const links = parseLinkHeader(result.headers.Link ?? null);
      const link = isGetPreviousPage ? links.previous : links.next;

      if (!link?.results) {
        return undefined;
      }

      return {
        querySortDirection,
        sortByDirection: sortBy.kind,
        autoRefresh,
        cursor: link.cursor ?? undefined,
      };
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
      logger.warn('No timestamp precise found for log row, using timestamp instead', {
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

// `timestamp_precise` round-trips through a JS number, so a nanosecond timestamp
// loses precision (its float ULP is ~256ns near the current epoch). 1µs comfortably
// exceeds that rounding error while staying far below typical log spacing, so a seek
// anchor padded by this includes the target without pulling in unrelated rows.
const SEEK_ANCHOR_TOLERANCE_NS = 1000n;

/**
 * Creates an initial page param for autoRefresh mode that enforces the MAX_LOG_INGEST_DELAY condition.
 * This ensures the first page query filters for logs older than Date.now() - MAX_LOG_INGEST_DELAY
 * which means the next logs page fetched will have results instead of having to wait for the MAX_LOG_INGEST_DELAY to pass.
 */
function getInitialPageParam(
  autoRefresh: boolean,
  sortBys: readonly Sort[],
  anchorTimestampPrecise?: bigint | null
): LogPageParam {
  const sortBy = getTimeBasedSortBy(sortBys);

  // When seeking to a specific log (e.g. "View in table" on a pinned row that
  // isn't in the loaded window), anchor the first page at its precise timestamp
  // so the row and its temporal neighbors load directly instead of paging there.
  if (anchorTimestampPrecise !== null && anchorTimestampPrecise !== undefined) {
    if (!sortBy) {
      // Only sort by timestamp precise is supported for infinite queries.
      return null;
    }
    // `timestamp_precise` is serialized as a JS number, so a nanosecond value loses
    // its low digits when parsed and the anchor can land just past the target —
    // which the boundary then excludes (`>=` for asc, `<=` for desc), so the target
    // never enters the window. Nudge the boundary outward (the side the comparison
    // keeps) by more than the float rounding error so the target is always inside.
    const anchorWithTolerance =
      sortBy.kind === 'asc'
        ? anchorTimestampPrecise - SEEK_ANCHOR_TOLERANCE_NS
        : anchorTimestampPrecise + SEEK_ANCHOR_TOLERANCE_NS;
    return {
      logId: '',
      timestampPrecise: anchorWithTolerance,
      sortByDirection: sortBy.kind,
      indexFromInitialPage: 0,
      querySortDirection: undefined,
      autoRefresh,
    };
  }

  if (!autoRefresh) {
    return null;
  }

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
  cursor: string | undefined;
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

type LogsInfiniteApiOptions = ReturnType<typeof useLogsApiOptions>['infiniteApiOptions'];
type QueryKey = LogsInfiniteApiOptions['queryKey'];

/**
 * `maxPages` is evaluated before `useInfiniteQuery` returns `data`, so we base it on the
 * query cache (same snapshot React Query will use for this key).
 */
function maxPagesForLogsInfiniteQuery(client: QueryClient, queryKey: QueryKey): number {
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
  referrer,
  staleTime: staleTimeOverride,
}: {
  disabled?: boolean;
  highFidelity?: boolean;
  referrer?: string;
  staleTime?: number;
} = {}) {
  const _referrer = referrer ?? 'api.explore.logs-table';
  const autoRefresh = useLogsAutoRefreshEnabled();
  const {hasInitialized: autoRefreshHasInitialized} = useLogsAutoRefresh();

  // High fidelity and auto refresh are disjoint features and cannot
  // be used together. So if auto refresh was ever initialized, we must
  // disable high fidelity mode.
  highFidelity = autoRefreshHasInitialized ? false : highFidelity;

  // A transient seek target for "View in table". While an anchor is active we
  // run the query in timestamp-window mode (high fidelity OFF): high fidelity
  // paginates by Link cursors, which cannot move to rows newer than the anchor's
  // `timestamp_precise:<=T` filter, so the anchored window would be one-directional
  // (no scrolling up). The timestamp-window path issues a fresh `>=T` query for the
  // previous page, so the anchored window can be paged in both directions.
  const [seekAnchor, setSeekAnchor] = useState<{
    baseQuerySignature: string;
    timestampPrecise: bigint;
  } | null>(null);
  const anchorTimestampPrecise = seekAnchor?.timestampPrecise ?? null;
  const effectiveHighFidelity = anchorTimestampPrecise === null ? highFidelity : false;

  // While seeking we query with high accuracy so the specific target row is returned
  // rather than sampled out — in high-volume views default sampling can drop it, and
  // the empty-result retry below never fires because neighbor rows still come back.
  const {infiniteApiOptions, other} = useLogsApiOptionsWithInfinite({
    referrer: _referrer,
    autoRefresh,
    highFidelity: effectiveHighFidelity,
    highAccuracy: anchorTimestampPrecise !== null,
  });
  const queryKeyWithInfinite = infiniteApiOptions.queryKey;
  const queryClient = useQueryClient();

  const sortBys = useQueryParamsSortBys();

  // Identity of the underlying query independent of the seek anchor. The anchor
  // only changes `sampling` (via high fidelity) within the query params, so
  // omitting it keeps this stable across seek toggles. We use it to drop a
  // now-stale anchor once the user changes search/sort/time.
  const baseQuerySignature = useMemo(() => {
    const {url, options} = parseQueryKey(queryKeyWithInfinite);
    const {sampling: _sampling, ...restQuery} = options?.query ?? {};
    return JSON.stringify([url, restQuery]);
  }, [queryKeyWithInfinite]);

  // The user changed search/sort/time, so a previously set anchor no longer
  // applies; drop it and return the table to its normal (live) window.
  useEffect(() => {
    if (seekAnchor && seekAnchor.baseQuerySignature !== baseQuerySignature) {
      setSeekAnchor(null);
    }
  }, [seekAnchor, baseQuerySignature]);

  useRefetchQueryOnAnchorChange({
    anchorTimestampPrecise,
    queryClient,
    queryKey: queryKeyWithInfinite,
  });

  const seekToTimestamp = useCallback(
    (timestampPrecise: string | number) => {
      let value: bigint;
      try {
        value = BigInt(timestampPrecise);
      } catch {
        return false;
      }
      setSeekAnchor({baseQuerySignature, timestampPrecise: value});
      return true;
    },
    [baseQuerySignature]
  );

  const getPreviousPageParam = useCallback(
    (data: ApiResponse<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getPageParam(
        'previous',
        sortBys.slice(),
        autoRefresh,
        effectiveHighFidelity
      )(data, _, pageParam),
    [sortBys, autoRefresh, effectiveHighFidelity]
  );
  const getNextPageParam = useCallback(
    (data: ApiResponse<EventsLogsResult>, _: unknown, pageParam: LogPageParam) =>
      getPageParam(
        'next',
        sortBys.slice(),
        autoRefresh,
        effectiveHighFidelity
      )(data, _, pageParam),
    [sortBys, autoRefresh, effectiveHighFidelity]
  );

  const initialPageParam = useMemo(
    () => getInitialPageParam(autoRefresh, sortBys, anchorTimestampPrecise),
    [autoRefresh, sortBys, anchorTimestampPrecise]
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

      let response = await apiFetch<EventsLogsResult>({
        ...fetchContext,
        queryKey: [
          url,
          {
            ...baseOptions,
            query: getParamBasedQuery(baseOptions?.query, pageParam),
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
              query: getParamBasedQuery(retryOptions.query, pageParam),
            },
            {infinite: false},
          ],
        });
      }

      if (pageParam?.querySortDirection && Array.isArray(response.json?.data)) {
        // We reverse the data if the query sort direction has been changed from the table sort direction.
        return {
          ...response,
          json: {...response.json, data: response.json.data.toReversed()},
        };
      }
      return response;
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

      if (effectiveHighFidelity) {
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
  }, [effectiveHighFidelity, queryClient, queryKeyWithInfinite, sortBys]);

  const {virtualStreamedTimestamp} = useVirtualStreaming({
    data,
    highFidelity: effectiveHighFidelity,
  });

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

  const _data = useMemo(() => {
    const usedRowIds = new Set();
    return (
      data?.pages.flatMap(page =>
        page.json.data.filter(row => {
          if (usedRowIds.has(row[OurLogKnownFieldKey.ID])) {
            return false;
          }

          if (!isRowVisibleInVirtualStream(row, virtualStreamedTimestamp)) {
            return false;
          }

          usedRowIds.add(row[OurLogKnownFieldKey.ID]);
          return true;
        })
      ) ?? []
    );
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

  // Settled whether or not the anchored page found anything, so an empty result can
  // still release the seek.
  const isAnchoredPageSettled = !queryResult.isPending && !isFetching;
  const isSeekSettled = useCenteredSeekWindow({
    anchorTimestampPrecise,
    isAnchoredPageSettled,
    hasAnchoredRows: _data.length > 0,
    hasPreviousPage,
    fetchPreviousPage: _fetchPreviousPage,
  });

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
    !!effectiveHighFidelity &&
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
    seekToTimestamp,
    isSeekSettled,
    isSeeking: anchorTimestampPrecise !== null,
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
  };
}

export type UseInfiniteLogsQueryResult = ReturnType<typeof useInfiniteLogsQuery>;

/**
 * `initialPageParam` is not part of the query key, so setting a seek anchor alone
 * won't refetch when the key is otherwise unchanged (e.g. high fidelity was already
 * off). Drop the cached query once per anchor so the observer re-creates it and reads
 * the now-anchored `initialPageParam`. No-op when there's nothing cached to replace —
 * a key change from the high-fidelity toggle already fetches fresh.
 */
function useRefetchQueryOnAnchorChange({
  anchorTimestampPrecise,
  queryClient,
  queryKey,
}: {
  anchorTimestampPrecise: bigint | null;
  queryClient: QueryClient;
  queryKey: QueryKey;
}) {
  const lastResetAnchorRef = useRef<bigint | null>(null);
  useEffect(() => {
    if (anchorTimestampPrecise === null) {
      lastResetAnchorRef.current = null;
      return;
    }
    if (lastResetAnchorRef.current === anchorTimestampPrecise) {
      return;
    }
    lastResetAnchorRef.current = anchorTimestampPrecise;
    if (queryClient.getQueryData(queryKey)) {
      queryClient.removeQueries({queryKey});
    }
  }, [anchorTimestampPrecise, queryClient, queryKey]);
}

/**
 * Loads the page of newer rows above a "View in table" seek target so the anchored
 * window has context on both sides (the anchored initial page is `timestamp_precise:<=T`,
 * the target plus older rows). Runs once per anchor. Returns whether the window is
 * settled — true once the newer page resolves, or immediately when there are none. The
 * table waits on this before centering so it doesn't settle on a half-loaded window,
 * and the loaded newer rows are what scroll-up then pages from.
 *
 * When the anchored page comes back empty (the target was a needle in a haystack the
 * query couldn't surface) or errors, it settles immediately so the table falls through
 * to its normal empty/error state instead of holding the seek loader forever.
 */
function useCenteredSeekWindow({
  anchorTimestampPrecise,
  isAnchoredPageSettled,
  hasAnchoredRows,
  hasPreviousPage,
  fetchPreviousPage,
}: {
  anchorTimestampPrecise: bigint | null;
  fetchPreviousPage: () => void | Promise<unknown> | false;
  hasAnchoredRows: boolean;
  hasPreviousPage: boolean;
  isAnchoredPageSettled: boolean;
}) {
  const [isSeekSettled, setIsSeekSettled] = useState(false);
  const balancedAnchorRef = useRef<bigint | null>(null);

  // Tracks the live anchor so a slow fetchPreviousPage from a superseded seek can tell
  // it's stale and skip settling the window that's since moved on to a newer anchor.
  const latestAnchorRef = useRef<bigint | null>(null);
  latestAnchorRef.current = anchorTimestampPrecise;

  // A new anchor (or a cleared one) starts a fresh, not-yet-settled window.
  useEffect(() => {
    balancedAnchorRef.current = null;
    setIsSeekSettled(false);
  }, [anchorTimestampPrecise]);

  useEffect(() => {
    if (
      anchorTimestampPrecise === null ||
      !isAnchoredPageSettled ||
      balancedAnchorRef.current === anchorTimestampPrecise
    ) {
      return;
    }

    balancedAnchorRef.current = anchorTimestampPrecise;

    if (hasAnchoredRows && hasPreviousPage) {
      Promise.resolve(fetchPreviousPage()).finally(() => {
        if (latestAnchorRef.current === anchorTimestampPrecise) {
          setIsSeekSettled(true);
        }
      });
    } else {
      setIsSeekSettled(true);
    }
  }, [
    anchorTimestampPrecise,
    isAnchoredPageSettled,
    hasAnchoredRows,
    hasPreviousPage,
    fetchPreviousPage,
  ]);

  return isSeekSettled;
}

interface AutoFetchWindowOptions {
  canAutoFetchNextPage: boolean;
  fetchNextPage: () => unknown;
  isFetchingNextPage: boolean;
  nextPageCursor: string | null | undefined;
  queryKey: QueryKey;
}

function getAutoFetchWindowDeadlineMs(
  resumeCount: number,
  windowStartMs: number | undefined
) {
  if (!windowStartMs) {
    return;
  }

  if (!resumeCount) {
    return windowStartMs + LOGS_HIGH_FIDELITY_INITIAL_AUTO_FETCH_WINDOW_MS;
  }

  return windowStartMs + LOGS_HIGH_FIDELITY_RESUMED_AUTO_FETCH_WINDOW_MS * resumeCount;
}

/**
 * Time-bounds the high-fidelity "needle in a haystack" auto-fetching.
 * Whenever the caller reports it wants to start (`canAutoFetchNextPage`),
 * this hook continuously calls `fetchNextPage` until the window closes.
 * `resumeAutoFetch` reopens progressively longer windows after the first.
 */
function useAutoFetchWindow({
  queryKey,
  canAutoFetchNextPage,
  isFetchingNextPage,
  nextPageCursor,
  fetchNextPage,
}: AutoFetchWindowOptions) {
  const [windowStartMs, setWindowStartMs] = useState<number | undefined>();
  const [resumeCount, setResumeCount] = useState(0);
  const timesFetched = useRef(0);
  const deadlineMs = getAutoFetchWindowDeadlineMs(resumeCount, windowStartMs);

  const queryKeyHash = useMemo(() => {
    const {url, options} = parseQueryKey(queryKey);
    return JSON.stringify([url, options?.query]);
  }, [queryKey]);

  useEffect(() => {
    setWindowStartMs(undefined);
    setResumeCount(0);
    timesFetched.current = 0;
  }, [queryKeyHash]);

  useEffect(() => {
    if (!canAutoFetchNextPage || isFetchingNextPage) {
      return;
    }

    if (!windowStartMs) {
      setWindowStartMs(Date.now());
      return;
    }

    if (deadlineMs && Date.now() >= deadlineMs) {
      Sentry.metrics.distribution(
        'explore.logs.flex_time_pages_before_data',
        timesFetched.current,
        {attributes: {status: 'out_of_time'}}
      );
      return;
    }

    Sentry.metrics.distribution(
      'explore.logs.flex_time_pages_before_data',
      timesFetched.current,
      {attributes: {status: 'fetching'}}
    );

    timesFetched.current += 1;
    fetchNextPage();
  }, [
    canAutoFetchNextPage,
    deadlineMs,
    fetchNextPage,
    isFetchingNextPage,
    nextPageCursor,
    resumeCount,
    windowStartMs,
  ]);

  const resumeAutoFetch = useCallback(() => {
    setResumeCount(resumeCount + 1);
    setWindowStartMs(Date.now());
  }, [resumeCount]);

  const shouldAutoFetchNextPage =
    canAutoFetchNextPage && (!deadlineMs || Date.now() < deadlineMs);

  return {shouldAutoFetchNextPage, resumeAutoFetch};
}

export function useLogsQueryHighFidelity() {
  const sortBys = useQueryParamsSortBys();

  // we can only turn on high accuracy flex time sampling when
  // the order by is exactly timestamp descending,
  return (
    sortBys.length === 1 &&
    sortBys[0]?.field === 'timestamp' &&
    sortBys[0]?.kind === 'desc'
  );
}
