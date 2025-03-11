import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {Incident} from 'sentry/views/alerts/types';

interface MetricIncidentsParams {
  orgSlug: string;
  query?: {
    alertRule?: string;
    end?: string;
    expand?: string[];
    includeSnapshots?: boolean;
    project?: string;
    start?: string;
  };
}

export function makeMetricIncidentsQueryKey(params: MetricIncidentsParams): ApiQueryKey {
  const {orgSlug, query} = params;
  return [
    `/organizations/${orgSlug}/incidents/`,
    {
      query: {
        project: '-1',
        includeSnapshots: true,
        expand: ['activities', 'original_alert_rule'],
        ...query,
      },
    },
  ];
}

export function useMetricIncidents(
  params: MetricIncidentsParams,
  options: Partial<UseApiQueryOptions<Incident[]>> = {}
) {
  return useApiQuery<Incident[]>(makeMetricIncidentsQueryKey(params), {
    staleTime: 0,
    ...options,
  });
}
