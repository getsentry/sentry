// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationSCIMTeamDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationSCIMTeamDetailsResponse>;
type TData = OrganizationSCIMTeamDetailsResponse;

/**
 * @public
 * Query an individual team with a SCIM Group GET Request.
 *         - Note that the members field will only contain up to 10000 members.
 */
export function organizationSCIMTeamDetailsOptions(
  organization: Organization,
  teamIdOrSlug: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/scim/v2/Groups/$teamIdOrSlug',
      {
        path: {organizationIdOrSlug: organization.slug, teamIdOrSlug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
