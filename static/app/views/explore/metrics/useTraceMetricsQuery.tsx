import {useCallback, useMemo} from 'react';
import {logger} from '@sentry/react';

import {type ApiResult} from 'sentry/api';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  fetchDataQuery,
  useApiQuery,
  useInfiniteQuery,
  useQueryClient,
  type ApiQueryKey,
  type InfiniteData,
} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  useQueryParamsCursor,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';

import {AlwaysPresentMetricFields, QUERY_PAGE_LIMIT} from './constants';
import {
  TraceMetricKnownFieldKey,
  type EventsMetricsResult,
  type MetricsAggregatesResult,
} from './types';

type MetricPageParam = {
  timestampPrecise: bigint;
  id: string;
  sort: Sort;
} | null;

function getTimeBasedSortBy(sortBys: Sort[]): Sort | undefined {
  return sortBys.find(
    sort =>
      sort.field === TraceMetricKnownFieldKey.TIMESTAMP_PRECISE ||
      sort.field === TraceMetricKnownFieldKey.TIMESTAMP
  );
}

function getPageParam(
  pageDirection: 'previous' | 'next',
  sortBys: Sort[],
  _autoRefresh: boolean
) {
  const isGetPreviousPage = pageDirection === 'previous';
  return (
    [pageData]: ApiResult<EventsMetricsResult>,
    _: unknown,
    pageParam: MetricPageParam
  ): MetricPageParam => {
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

    let firstTimestamp: bigint;
    let lastTimestamp: bigint;
    try {
      firstTimestamp = BigInt(firstRow[TraceMetricKnownFieldKey.TIMESTAMP_PRECISE]);
      lastTimestamp = BigInt(lastRow[TraceMetricKnownFieldKey.TIMESTAMP_PRECISE]);
    } catch {
      logger.warn(`No timestamp precise found for metric row, using timestamp instead`, {
        metricId: firstRow[TraceMetricKnownFieldKey.ID],
        timestamp: firstRow[TraceMetricKnownFieldKey.TIMESTAMP],
        timestampPrecise: firstRow[TraceMetricKnownFieldKey.TIMESTAMP_PRECISE],
      });
      firstTimestamp =
        BigInt(new Date(firstRow[TraceMetricKnownFieldKey.TIMESTAMP]).getTime()) *
        1_000_000n;
      lastTimestamp =
        BigInt(new Date(lastRow[TraceMetricKnownFieldKey.TIMESTAMP]).getTime()) *
        1_000_000n;
    }

    const metricId = isGetPreviousPage
      ? firstRow[TraceMetricKnownFieldKey.ID]
      : lastRow[TraceMetricKnownFieldKey.ID];
    const isDescending = sortBy.kind === 'desc';
    const timestampPrecise = isGetPreviousPage ? firstTimestamp : lastTimestamp;

    if (isGetPreviousPage) {
      // When getting the previous page, we want to get metrics that are newer than the first metric in the current page.
      // If we're sorting descending, we want metrics with timestamp > firstTimestamp
      // If we're sorting ascending, we want metrics with timestamp < firstTimestamp
      return {
        timestampPrecise,
        id: metricId,
        sort: {
          field: sortBy.field,
          kind: isDescending ? 'desc' : 'asc',
        },
      };
    } else {
      // When getting the next page, we want to get metrics that are older than the last metric in the current page.
      // If we're sorting descending, we want metrics with timestamp < lastTimestamp
      // If we're sorting ascending, we want metrics with timestamp > lastTimestamp
      return {
        timestampPrecise,
        id: metricId,
        sort: {
          field: sortBy.field,
          kind: isDescending ? 'desc' : 'asc',
        },
      };
    }
  };
}

function getInitialPageParam(_autoRefresh: boolean, _sortBys: Sort[]): MetricPageParam {
  return null;
}

function getParamBasedQuery(
  baseQuery: Record<string, any> | undefined,
  pageParam: MetricPageParam
): Record<string, any> {
  if (!pageParam || !baseQuery) {
    return baseQuery || {};
  }

  const {timestampPrecise, sort} = pageParam;
  const isDescending = sort.kind === 'desc';
  const operator = isDescending ? '<=' : '>=';

  // Add timestamp-based pagination to the query
  const timestampQuery = `${sort.field}:${operator}${timestampPrecise}`;
  const existingQuery = baseQuery.query || '';
  const newQuery = existingQuery ? `${existingQuery} ${timestampQuery}` : timestampQuery;

  return {
    ...baseQuery,
    query: newQuery,
  };
}

export function useTraceMetricsAggregatesQuery({
  disabled,
  limit,
  referrer,
}: {
  disabled?: boolean;
  limit?: number;
  referrer?: string;
}) {
  const {other, queryKey} = useMetricsQueryKey({
    limit,
    referrer: referrer || 'api.explore.metrics.aggregates',
  });

  const queryClient = useQueryClient();

  const result = useApiQuery<MetricsAggregatesResult>(queryKey, {
    enabled: other.pageFiltersReady && !disabled,
    staleTime: 0,
    retry: false,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({queryKey}),
    [queryClient, queryKey]
  );

  return {
    ...result,
    invalidate,
    eventView: other.eventView,
  };
}

function useMetricsQueryKey({limit, referrer}: {referrer: string; limit?: number}) {
  const organization = useOrganization();
  const _search = useQueryParamsSearch();
  const cursor = useQueryParamsCursor();
  const _fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const location = useLocation();
  const groupBys = useQueryParamsGroupBys();

  const search = _search;
  const fields = Array.from(
    new Set([...AlwaysPresentMetricFields, ..._fields, ...groupBys.filter(Boolean)])
  );
  const sorts = sortBys ?? [];
  const pageFilters = selection;
  const dataset = DiscoverDatasets.METRICS; // Using METRICS dataset for tracemetrics

  const eventView = getEventView(
    search,
    fields,
    sorts.slice(),
    pageFilters,
    dataset,
    pageFilters.projects
  );

  const eventViewPayload = eventView.getEventsAPIPayload(location);

  const params = {
    query: {
      ...eventViewPayload,
      cursor,
      orderby: eventViewPayload.sort,
      per_page: limit ? limit : undefined,
      referrer,
      dataset: 'tracemetrics', // Override dataset to tracemetrics
    },
    pageFiltersReady,
    eventView,
  };

  const queryKey: ApiQueryKey = [`/organizations/${organization.slug}/events/`, params];

  return {
    queryKey,
    other: params,
  };
}

export function useInfiniteTraceMetricsQuery({
  disabled,
  limit = QUERY_PAGE_LIMIT,
  referrer = 'api.explore.metrics.infinite',
}: {
  disabled?: boolean;
  limit?: number;
  referrer?: string;
}) {
  const {other, queryKey} = useMetricsQueryKey({limit, referrer});
  const sortBys = useQueryParamsSortBys();
  const autoRefresh = false; // For now, keep autoRefresh disabled for metrics

  const getPreviousPageParam = useCallback(
    (data: ApiResult<EventsMetricsResult>, _: unknown, pageParam: MetricPageParam) =>
      getPageParam('previous', sortBys.slice(), autoRefresh)(data, _, pageParam),
    [sortBys, autoRefresh]
  );
  const getNextPageParam = useCallback(
    (data: ApiResult<EventsMetricsResult>, _: unknown, pageParam: MetricPageParam) =>
      getPageParam('next', sortBys.slice(), autoRefresh)(data, _, pageParam),
    [sortBys, autoRefresh]
  );

  const initialPageParam = useMemo(
    () => getInitialPageParam(autoRefresh, sortBys.slice()),
    [autoRefresh, sortBys]
  );

  const queryKeyWithInfinite = useMemo(
    () => ['infinite', ...queryKey] as const,
    [queryKey]
  );

  const result = useInfiniteQuery<
    ApiResult<EventsMetricsResult>,
    Error,
    InfiniteData<ApiResult<EventsMetricsResult>>,
    typeof queryKeyWithInfinite,
    MetricPageParam
  >({
    queryKey: queryKeyWithInfinite,
    queryFn: async ({
      pageParam,
      queryKey: [, url, endpointOptions],
      client,
      signal,
      meta,
    }): Promise<ApiResult<EventsMetricsResult>> => {
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

      return result as ApiResult<EventsMetricsResult>;
    },
    getPreviousPageParam,
    getNextPageParam,
    initialPageParam,
    enabled: other.pageFiltersReady && !disabled,
    staleTime: 0,
    retry: false,
  });

  const data = useMemo(() => {
    return (
      result.data?.pages.flatMap(([pageData]) => {
        return pageData.data ?? [];
      }) ?? []
    );
  }, [result.data?.pages]);

  const meta = useMemo(() => {
    const lastPage = result.data?.pages[result.data?.pages.length - 1];
    return lastPage?.[0]?.meta;
  }, [result.data?.pages]);

  return {
    ...result,
    data,
    meta,
    eventView: other.eventView,
  };
}
