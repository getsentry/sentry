// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Team} from 'sentry/types/team';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface TeamMembersResponse {
  // No response keys detected — fill in manually
}

interface TeamMembersQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
}

type TQueryData = ApiResponse<TeamMembersResponse>;
type TData = TeamMembersResponse;

/**
 * @public
 * List all members on a team.
 *
 *         The response will not include members with pending invites.
 */
export function teamMembersOptions(
  organization: Organization,
  team: Team,
  query?: TeamMembersQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/teams/$organizationIdOrSlug/$teamIdOrSlug/members/', {
      path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: team.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
