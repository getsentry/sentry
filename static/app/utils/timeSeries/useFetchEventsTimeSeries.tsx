import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
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

import {getIntervalForTimeSeriesQuery} from './getIntervalForTimeSeriesQuery';

interface UseFetchEventsTimeSeriesOptions<Field> {
  yAxis: Field | Field[];
  enabled?: boolean;
  groupBy?: Field[];
  query?: MutableSearch;
  sampling?: SamplingMode;
  sort?: Sort;
  topEvents?: number;
}

/**
 * Fetch time series data from the `/events-timeseries/` endpoint. Returns an array of `TimeSeries` objects.
 */
export function useFetchEventsTimeSeries<T extends string>(
  dataset: DiscoverDatasets,
  {
    yAxis,
    query,
    sampling,
    topEvents,
    groupBy,
    sort,
    enabled,
  }: UseFetchEventsTimeSeriesOptions<T>,
  referrer: string
) {
  const organization = useOrganization();

  const {isReady: arePageFiltersReady, selection} = usePageFilters();

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
          interval: getIntervalForTimeSeriesQuery(yAxis, selection.datetime),
          query: query ? query.formatString() : undefined,
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
      enabled: enabled && arePageFiltersReady,
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
