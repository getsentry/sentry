import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

interface UseFetchEventsTimeSeriesOptions {
  enabled?: boolean;
}

export function useFetchEventsTimeSeries(
  {enabled}: UseFetchEventsTimeSeriesOptions = {},
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
          referrer,
        },
      },
    ],
    {
      staleTime: DEFAULT_STALE_TIME,
      enabled,
    }
  );
}

const DEFAULT_STALE_TIME = 60_000;
