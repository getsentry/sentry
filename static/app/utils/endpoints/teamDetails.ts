// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Team} from 'sentry/types/team';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface TeamDetailsResponse {
  // No response keys detected — fill in manually
}

interface TeamDetailsQueryParams {
  /** List of strings to opt out of certain pieces of data. Supports `organization`. */
  collapse?: string;
  /** List of strings to opt in to additional data. Supports `projects`, `externalTeams`. */
  expand?: string;
}

type TQueryData = ApiResponse<TeamDetailsResponse>;
type TData = TeamDetailsResponse;

/**
 * @public
 * Return details on an individual team.
 */
export function teamDetailsOptions(
  organization: Organization,
  team: Team,
  query?: TeamDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/teams/$organizationIdOrSlug/$teamIdOrSlug/', {
      path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: team.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
