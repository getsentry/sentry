// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Team} from 'sentry/types/team';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface TeamReleaseCountResponse {
  detail: unknown;
  last_week_totals: unknown;
  project_avgs: unknown;
  release_counts: unknown;
}

interface TeamReleaseCountQueryParams {
  end?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<TeamReleaseCountResponse>;
type TData = TeamReleaseCountResponse;

/**
 * @public
 * Returns a dict of team projects, and a time-series list of release counts for each.
 */
export function teamReleaseCountOptions(
  organization: Organization,
  team: Team,
  query?: TeamReleaseCountQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/teams/$organizationIdOrSlug/$teamIdOrSlug/release-count/', {
      path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: team.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
