import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {CheckIn} from 'sentry/views/insights/crons/types';

interface MonitorChecksParameters {
  monitorIdOrSlug: string;
  orgSlug: string;
  projectSlug: string;
  cursor?: string;
  environment?: string[];
  expand?: 'groups';
  limit?: number;
  // Allows passing in arbitrary location query params
  queryParams?: Record<string, string | string[] | null | undefined>;
}

function makeMonitorCheckInsQueryKey({
  orgSlug,
  projectSlug,
  monitorIdOrSlug,
  cursor,
  limit,
  environment,
  expand,
  queryParams,
}: MonitorChecksParameters): ApiQueryKey {
  return [
    getApiUrl(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/checkins/',
      {
        path: {
          organizationIdOrSlug: orgSlug,
          projectIdOrSlug: projectSlug,
          monitorIdOrSlug,
        },
      }
    ),
    {query: {per_page: limit, cursor, environment, expand, ...queryParams}},
  ];
}

export function useMonitorCheckIns(
  params: MonitorChecksParameters,
  options: Partial<UseApiQueryOptions<CheckIn[]>> = {}
) {
  const queryKey = makeMonitorCheckInsQueryKey(params);
  return useApiQuery<CheckIn[]>(queryKey, {staleTime: 0, ...options});
}
