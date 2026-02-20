// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Team} from 'sentry/types/team';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface TeamIssueBreakdownResponse {
  detail: unknown;
}

interface TeamIssueBreakdownQueryParams {
  end?: string;
  environment?: string;
  start?: string;
  statsPeriod?: string;
  statuses?: string[];
  utc?: string;
}

type TQueryData = ApiResponse<TeamIssueBreakdownResponse>;
type TData = TeamIssueBreakdownResponse;

/**
 * @public
 * Returns a dict of team projects, and a time-series dict of issue stat breakdowns for each.
 *
 *         If a list of statuses is passed then we return the count of each status and the totals.
 *         Otherwise we the count of reviewed issues and the total count of issues.
 */
export function teamIssueBreakdownOptions(
  organization: Organization,
  team: Team,
  query?: TeamIssueBreakdownQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/teams/$organizationIdOrSlug/$teamIdOrSlug/issue-breakdown/', {
      path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: team.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
