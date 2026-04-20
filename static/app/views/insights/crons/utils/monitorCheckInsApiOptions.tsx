import {apiOptions} from 'sentry/utils/api/apiOptions';
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

export function monitorCheckInsApiOptions({
  orgSlug,
  projectSlug,
  monitorIdOrSlug,
  cursor,
  limit,
  environment,
  expand,
  queryParams,
}: MonitorChecksParameters) {
  return apiOptions.as<CheckIn[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/checkins/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        monitorIdOrSlug,
      },
      query: {per_page: limit, cursor, environment, expand, ...queryParams},
      staleTime: 0,
    }
  );
}
