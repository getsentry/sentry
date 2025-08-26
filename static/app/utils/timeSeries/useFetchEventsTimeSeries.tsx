import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

interface UseFetchEventsTimeSeriesOptions<Field> {
  yAxis: Field | Field[];
  enabled?: boolean;
}

// TODO: This hook's interface is mostly compatible with `useDiscoverSeries` for easier interoperability. Once we eliminate `useDiscoverSeries`, we can make changes here as appropriate
export function useFetchEventsTimeSeries<T extends string>(
  {yAxis, enabled}: UseFetchEventsTimeSeriesOptions<T>,
  dataset: DiscoverDatasets,
  referrer: string
) {
  const organization = useOrganization();

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
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      refetchOnWindowFocus: false,
      enabled,
    }
  );
}
