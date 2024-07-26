import type {MetricsUsage} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

export const getMetricUsageURL = (
  orgSlug: string,
  projectId: string | number,
  spanAttribute: string
) =>
  [
    `/organizations/${orgSlug}/projects/${projectId}/metrics-usage/${spanAttribute}/`,
  ] as const;

export function useMetricUsage(
  orgSlug: string,
  projectId: string | number,
  spanAttribute: string
) {
  return useApiQuery<MetricsUsage[]>(
    getMetricUsageURL(orgSlug, projectId, spanAttribute),
    {
      staleTime: 0,
      retry: false,
      enabled: !!projectId,
    }
  );
}
