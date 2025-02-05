import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';

interface UptimeChecksParameters {
  orgSlug: string;
  projectSlug: string;
  uptimeAlertId: string;
  cursor?: string;
  limit?: number;
}

export function makeUptimeChecksQueryKey({
  orgSlug,
  projectSlug,
  uptimeAlertId,
  cursor,
  limit,
}: UptimeChecksParameters): ApiQueryKey {
  return [
    `/projects/${orgSlug}/${projectSlug}/uptime/${uptimeAlertId}/checks/`,
    {query: {per_page: limit, cursor}},
  ];
}

export function useUptimeChecks(
  params: UptimeChecksParameters,
  options: Partial<UseApiQueryOptions<UptimeCheck[]>> = {}
) {
  // TODO(Leander): Add querying and sorting, when the endpoint supports it
  return useApiQuery<UptimeCheck[]>(makeUptimeChecksQueryKey(params), {
    staleTime: 10000,
    retry: false,
    ...options,
  });
}
