// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationUsersResponse {
  // No response keys detected — fill in manually
}

interface OrganizationUsersQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<OrganizationUsersResponse>;
type TData = OrganizationUsersResponse;

/**
 * @public
 * List an Organization's Projects Users
 *         ````````````````````````````
 *
 *         Return a list of users that belong to a given organization and are part of a project.
 *
 *         :qparam string project: restrict results to users who have access to a given project ID
 *         :pparam string organization_id_or_slug: the id or slug of the organization for which the users
 *                                           should be listed.
 *         :auth: required
 */
export function organizationUsersOptions(
  organization: Organization,
  query?: OrganizationUsersQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/users/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
