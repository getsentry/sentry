// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationUserTeamsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationUserTeamsResponse>;
type TData = OrganizationUserTeamsResponse;

/**
 * @public
 * Returns a list of teams the user has access to in the specified organization.
 *         Note that this endpoint is restricted to [user auth tokens](https://docs.sentry.io/account/auth-tokens/#user-auth-tokens).
 */
export function organizationUserTeamsOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/user-teams/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
