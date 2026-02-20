// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Team} from 'sentry/types/team';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface TeamAlertsTriggeredIndexResponse {
  // No response keys detected — fill in manually
}

interface TeamAlertsTriggeredIndexQueryParams {
  end?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<TeamAlertsTriggeredIndexResponse>;
type TData = TeamAlertsTriggeredIndexResponse;

/**
 * @public
 * Returns alert rules ordered by highest number of alerts fired this week.
 */
export function teamAlertsTriggeredIndexOptions(
  organization: Organization,
  team: Team,
  query?: TeamAlertsTriggeredIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/teams/$organizationIdOrSlug/$teamIdOrSlug/alerts-triggered-index/',
      {
        path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: team.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
