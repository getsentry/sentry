import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

interface UptimeCheckInsParameters {
  orgSlug: string;
  projectSlug: string;
  uptimeAlertId: string;
  cursor?: string;
  limit?: number;
}

export interface UptimeCheckIn {
  checkStatus: 'success' | 'failure' | 'missed_window';
  checkStatusReason: string;
  durationMs: number;
  environment: string;
  projectUptimeSubscriptionId: number;
  region: string;
  scheduledCheckTime: string;
  // This hasn't been implemented on the backend yet
  statusCode: string;
  timestamp: string;
  traceId: string;
  uptimeCheckId: string;
  uptimeSubscriptionId: number;
}

export function makeUptimeCheckInsQueryKey({
  orgSlug,
  projectSlug,
  uptimeAlertId,
  cursor,
  limit,
}: UptimeCheckInsParameters): ApiQueryKey {
  return [
    `/organizations/${orgSlug}/${projectSlug}/uptime-alert/${uptimeAlertId}/checks/`,
    {query: {per_page: limit, cursor}},
  ];
}

export function useUptimeCheckIns(
  params: UptimeCheckInsParameters,
  options: Partial<UseApiQueryOptions<UptimeCheckIn[]>> = {}
) {
  // TODO(Leander): Add querying and sorting, when the endpoint supports it
  return useApiQuery<UptimeCheckIn[]>(makeUptimeCheckInsQueryKey(params), {
    staleTime: 10000,
    retry: false,
    ...options,
  });
}
