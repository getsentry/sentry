// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Team} from 'sentry/types/team';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface TeamAllUnresolvedIssuesResponse {
  detail: unknown;
}

interface TeamAllUnresolvedIssuesQueryParams {
  end?: string;
  environment?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<TeamAllUnresolvedIssuesResponse>;
type TData = TeamAllUnresolvedIssuesResponse;

/**
 * @public
 * Returns cumulative counts of unresolved groups per day within the stats period time range.
 *         Response:
 *         {
 *             <project_id>: {
 *                 <isoformat_date>: {"unresolved": <unresolved_count>},
 *                 ...
 *             }
 *             ...
 *         }
 */
export function teamAllUnresolvedIssuesOptions(
  organization: Organization,
  team: Team,
  query?: TeamAllUnresolvedIssuesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/teams/$organizationIdOrSlug/$teamIdOrSlug/all-unresolved-issues/',
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
