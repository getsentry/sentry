import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function useFetchEventsTimeSeries() {
  const organization = useOrganization();

  return useApiQuery<TimeSeries[]>(
    [`/organizations/${organization.slug}/events-timeseries/`],
    {
      staleTime: DEFAULT_STALE_TIME,
    }
  );
}

const DEFAULT_STALE_TIME = 60_000;
