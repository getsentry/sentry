// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Team} from 'sentry/types/team';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface TeamUnresolvedIssueAgeResponse {
  detail: unknown;
}

interface TeamUnresolvedIssueAgeQueryParams {
  environment?: string;
}

type TQueryData = ApiResponse<TeamUnresolvedIssueAgeResponse>;
type TData = TeamUnresolvedIssueAgeResponse;

/**
 * @public
 * Return a time bucketed list of how old unresolved issues are.
 */
export function teamUnresolvedIssueAgeOptions(
  organization: Organization,
  team: Team,
  query?: TeamUnresolvedIssueAgeQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/teams/$organizationIdOrSlug/$teamIdOrSlug/unresolved-issue-age/',
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
