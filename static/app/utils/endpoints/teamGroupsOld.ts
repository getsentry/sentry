// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Team} from 'sentry/types/team';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface TeamGroupsOldResponse {
  // No response keys detected — fill in manually
}

interface TeamGroupsOldQueryParams {
  environment?: string;
  limit?: string;
}

type TQueryData = ApiResponse<TeamGroupsOldResponse>;
type TData = TeamGroupsOldResponse;

/**
 * @public
 * Return the oldest issues owned by a team
 */
export function teamGroupsOldOptions(
  organization: Organization,
  team: Team,
  query?: TeamGroupsOldQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/teams/$organizationIdOrSlug/$teamIdOrSlug/issues/old/', {
      path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: team.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
