import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {Anomaly} from 'sentry/views/alerts/types';

interface MetricAnomaliesParams {
  orgSlug: string;
  ruleId: string;
  query?: {
    end?: string;
    start?: string;
  };
}

export function makeMetricAnomaliesQueryKey(params: MetricAnomaliesParams): ApiQueryKey {
  const {orgSlug, ruleId, query} = params;
  return [`/organizations/${orgSlug}/alert-rules/${ruleId}/anomalies/`, {query}];
}

export function useMetricAnomalies(
  params: MetricAnomaliesParams,
  options: Partial<UseApiQueryOptions<Anomaly[]>> = {}
) {
  return useApiQuery<Anomaly[]>(makeMetricAnomaliesQueryKey(params), {
    staleTime: 0,
    ...options,
  });
}
