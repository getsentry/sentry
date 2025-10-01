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
import {SpanFields} from 'sentry/views/insights/types';

import {getIntervalForTimeSeriesQuery} from './getIntervalForTimeSeriesQuery';

interface UseFetchEventsTimeSeriesOptions<YAxis, Attribute> {
  /**
   * The fields (or single field) to fetch from the API. e.g., `"p50(span.duration)"`
   */
  yAxis: YAxis | YAxis[];
  /**
   * Boolean. If missing, the query is enabled. If supplied, the query will obey the prop as specified.
   */
  enabled?: boolean;
  /**
   * If true, the query will exclude the "other" group.
   */
  excludeOther?: boolean;
  /**
   * An array of tags by which to group the results. e.g., passing `["transaction"]` will group the results by the `"transaction"` tag. `["env", "transaction"]` will group by both the `"env"` and `"transaction"` tags.
   */
  groupBy?: Attribute[];
  /**
   * Duration between items in the time series, as a string. e.g., `"5m"`
   */
  interval?: string;
  /**
   * Page filters to apply to the request. This applies the date selection, projects, and environments. By default uses the currently applied filters after waiting for them to become available. If `pageFilters` are passed as a prop, does not wait for readiness.
   */
  pageFilters?: PageFilters;
  /**
   * Query to apply to the data set. Can be either a `MutableSearch` object (preferred) or a plain string.
   */
  query?: MutableSearch | string;
  /**
   * Sampling mode. Only specify this if you're sure you require a specific sampling mode. In most cases, the backend will automatically decide this.
   */
  sampling?: SamplingMode;
  /**
   * Sort order for the results, only applies if `groupBy` is provided.
   */
  sort?: Sort;
  /**
   * Number of groups for a `groupBy` request. e.g., if `topEvents` is `5` and `groupBy` is `["transaction"]` this will group the results by `transaction` and fetch the top 5 results
   */
  topEvents?: number;
}

export function useFetchSpanTimeSeries<
  Fields extends SpanProperty,
  Attributes extends SpanFields,
>(options: UseFetchEventsTimeSeriesOptions<Fields, Attributes>, referrer: string) {
  return useFetchEventsTimeSeries<Fields, Attributes>(
    DiscoverDatasets.SPANS,
    options,
    referrer
  );
}

/**
 * Fetch time series data from the `/events-timeseries/` endpoint. Returns an array of `TimeSeries` objects.
 */
export function useFetchEventsTimeSeries<YAxis extends string, Attribute extends string>(
  dataset: DiscoverDatasets,
  {
    yAxis,
    excludeOther,
    enabled,
    groupBy,
    interval,
    query,
    sampling,
    pageFilters,
    sort,
    topEvents,
  }: UseFetchEventsTimeSeriesOptions<YAxis, Attribute>,
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
          excludeOther: excludeOther ? 1 : 0,
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
