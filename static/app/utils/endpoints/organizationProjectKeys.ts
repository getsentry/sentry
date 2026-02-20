// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationProjectKeysResponse {
  // No response keys detected — fill in manually
}

interface OrganizationProjectKeysQueryParams {
  project?: string;
  /** Filter keys by status. Options are 'active' or 'inactive'. */
  status?: 'active' | 'inactive';
  /** Filter keys by team slug or ID. If provided, only keys for projects belonging to this team will be returned. */
  team?: string;
}

type TQueryData = ApiResponse<OrganizationProjectKeysResponse>;
type TData = OrganizationProjectKeysResponse;

/**
 * @public
 * Return a list of client keys (DSNs) for all projects in an organization.
 *
 *         This paginated endpoint lists client keys across all projects in an organization. Each key includes the project ID
 *         to identify which project it belongs to.
 *
 *         Query Parameters:
 *         - team: Filter by team slug or ID to get keys only for that team's projects
 *         - status: Filter by 'active' or 'inactive' to get keys with specific status
 */
export function organizationProjectKeysOptions(
  organization: Organization,
  query?: OrganizationProjectKeysQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/project-keys/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
