import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

interface UseFetchEventsTimeSeriesOptions {
  enabled?: boolean;
}

export function useFetchEventsTimeSeries({
  enabled,
}: UseFetchEventsTimeSeriesOptions = {}) {
  const organization = useOrganization();

  return useApiQuery<TimeSeries[]>(
    [
      `/organizations/${organization.slug}/events-timeseries/`,
      {
        query: {
          partial: 1,
          excludeOther: 0,
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
