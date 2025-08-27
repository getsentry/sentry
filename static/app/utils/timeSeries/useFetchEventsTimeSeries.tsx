import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

import {getIntervalForTimeSeriesQuery} from './getIntervalForTimeSeriesQuery';

interface UseFetchEventsTimeSeriesOptions<Field> {
  yAxis: Field | Field[];
  enabled?: boolean;
  search?: MutableSearch;
}

export function useFetchEventsTimeSeries<T extends string>(
  dataset: DiscoverDatasets,
  {yAxis, search, enabled}: UseFetchEventsTimeSeriesOptions<T>,
  referrer: string
) {
  const organization = useOrganization();

  const {isReady: arePageFiltersReady, selection} = usePageFilters();

  if (!referrer) {
    throw new Error(
      '`useFetchEventsTimeSeries` cannot accept an empty referrer string, please specify a referrer!'
    );
  }

  return useApiQuery<TimeSeries[]>(
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
          search: search ? search.formatString() : undefined,
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
