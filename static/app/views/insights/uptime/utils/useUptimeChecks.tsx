import getApiUrl from 'sentry/utils/api/getApiUrl';
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
    getApiUrl(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/uptime/$uptimeDetectorId/checks/',
      {
        path: {
          organizationIdOrSlug: orgSlug,
          projectIdOrSlug: projectSlug,
          uptimeDetectorId: detectorId,
        },
      }
    ),
    {
      query: {
        per_page: limit,
        cursor,
        start,
        end,
        statsPeriod,
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
    staleTime: 10_000,
    retry: true,
    ...options,
  });
}
