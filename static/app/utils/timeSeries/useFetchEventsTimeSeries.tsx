import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {DEFAULT_SAMPLING_MODE} from 'sentry/views/insights/common/queries/useDiscover';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';
import type {SpanProperty} from 'sentry/views/insights/types';

import {getIntervalForTimeSeriesQuery} from './getIntervalForTimeSeriesQuery';

interface UseFetchEventsTimeSeriesOptions<Field> {
  yAxis: Field | Field[];
  enabled?: boolean;
  groupBy?: Field[];
  interval?: string;
  /**
   * NOTE: If `pageFilters` are passed in, the implication is that these filters are ready, and have valid data. If present, the query is enabled immediately!
   */
  pageFilters?: PageFilters;
  query?: MutableSearch | string;
  sampling?: SamplingMode;
  sort?: Sort;
  topEvents?: number;
}

export function useFetchSpanTimeSeries<Fields extends SpanProperty>(
  options: UseFetchEventsTimeSeriesOptions<Fields>,
  referrer: string
) {
  return useFetchEventsTimeSeries<Fields>(DiscoverDatasets.SPANS, options, referrer);
}

/**
 * Fetch time series data from the `/events-timeseries/` endpoint. Returns an array of `TimeSeries` objects.
 */
export function useFetchEventsTimeSeries<T extends string>(
  dataset: DiscoverDatasets,
  {
    yAxis,
    enabled,
    groupBy,
    interval,
    query,
    sampling,
    pageFilters,
    sort,
    topEvents,
  }: UseFetchEventsTimeSeriesOptions<T>,
  referrer: string
) {
  const organization = useOrganization();

  const {isReady: arePageFiltersReady, selection: defaultSelection} = usePageFilters();

  const hasCustomPageFilters = Boolean(pageFilters);
  const selection = pageFilters ?? defaultSelection;

  if (!referrer) {
    throw new Error(
      '`useFetchEventsTimeSeries` cannot accept an empty referrer string, please specify a referrer!'
    );
  }

  return useApiQuery<EventsTimeSeriesResponse>(
    [
      `/organizations/${organization.slug}/events-timeseries/`,
      {
        query: {
          partial: 1,
          excludeOther: 0,
          dataset,
          referrer,
          yAxis,
          ...normalizeDateTimeParams(selection.datetime),
          project: selection.projects,
          environment: selection.environments,
          interval: interval ?? getIntervalForTimeSeriesQuery(yAxis, selection.datetime),
          query: query
            ? typeof query === 'string'
              ? query
              : query.formatString()
            : undefined,
          sampling: sampling ?? DEFAULT_SAMPLING_MODE,
          topEvents,
          groupBy,
          sort: sort ? encodeSort(sort) : undefined,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      refetchOnWindowFocus: false,
      enabled: enabled && (hasCustomPageFilters ? true : arePageFiltersReady),
    }
  );
}

type EventsTimeSeriesResponse = {
  meta: {
    dataset: DiscoverDatasets;
    end: number;
    start: number;
  };
  timeSeries: TimeSeries[];
};
