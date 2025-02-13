import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {CheckIn} from 'sentry/views/monitors/types';

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

// TODO(Leander): Fix pagination and dont commit this comment

export function makeMonitorChecksQueryKey({
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
    `/projects/${orgSlug}/${projectSlug}/monitors/${monitorIdOrSlug}/checkins/`,
    {query: {per_page: limit, cursor, environment, expand, ...queryParams}},
  ];
}

export function useMonitorChecks(
  params: MonitorChecksParameters,
  options: Partial<UseApiQueryOptions<CheckIn[]>> = {}
) {
  const queryKey = makeMonitorChecksQueryKey(params);
  return useApiQuery<CheckIn[]>(queryKey, {staleTime: 0, ...options});
}
