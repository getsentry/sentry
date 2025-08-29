import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';

interface UptimeChecksParameters {
  detectorId: string;
  orgSlug: string;
  projectSlug: string;
  cursor?: string;
  end?: string;
  limit?: number;
  start?: string;
  statsPeriod?: string;
}

function makeUptimeChecksQueryKey({
  orgSlug,
  projectSlug,
  detectorId,
  cursor,
  limit,
  start,
  end,
  statsPeriod,
}: UptimeChecksParameters): ApiQueryKey {
  return [
    `/projects/${orgSlug}/${projectSlug}/uptime/${detectorId}/checks/`,
    {
      query: {
        per_page: limit,
        cursor,
        start,
        end,
        statsPeriod,
        // TODO(epurkhiser): Can be removed once these APIs only take detectors
        useDetectorId: 1,
      },
    },
  ];
}

export function useUptimeChecks(
  params: UptimeChecksParameters,
  options: Partial<UseApiQueryOptions<UptimeCheck[]>> = {}
) {
  // TODO(Leander): Add querying and sorting, when the endpoint supports it
  return useApiQuery<UptimeCheck[]>(makeUptimeChecksQueryKey(params), {
    staleTime: 10000,
    retry: true,
    ...options,
  });
}
