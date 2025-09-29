import {useCallback, useEffect, useMemo} from 'react';
import {logger} from '@sentry/react';

import {type ApiResult} from 'sentry/api';
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
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';

import {AlwaysPresentMetricFields, QUERY_PAGE_LIMIT} from './constants';
import {
  TraceMetricKnownFieldKey,
  type EventsMetricsResult,
  type MetricsAggregatesResult,
} from './types';

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

  const result = useInfiniteQuery<
    ApiResult<EventsMetricsResult['data'], EventsMetricsResult['meta']>
  >({
    queryKey,
    queryFn: fetchDataQuery,
    getNextPageParam: (lastPage, _pages) => {
      const links = parseLinkHeader(lastPage.getResponseHeader('Link') ?? null);
      const cursor = links.next?.results ? links.next.cursor : undefined;
      return cursor;
    },
    enabled: other.pageFiltersReady && !disabled,
    staleTime: 0,
    retry: false,
    initialPageParam: undefined,
  });

  const data = useMemo(() => {
    return (
      result.data?.pages.flatMap(page => {
        return page.json?.data ?? [];
      }) ?? []
    );
  }, [result.data?.pages]);

  const meta = useMemo(() => {
    const lastPage = result.data?.pages[result.data?.pages.length - 1];
    return lastPage?.json?.meta;
  }, [result.data?.pages]);

  return {
    ...result,
    data,
    meta,
    eventView: other.eventView,
  };
}
