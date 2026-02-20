// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationCodeMappingsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationCodeMappingsQueryParams {
  integrationId?: string;
  project?: string[];
}

type TQueryData = ApiResponse<OrganizationCodeMappingsResponse>;
type TData = OrganizationCodeMappingsResponse;

/**
 * @public
 * Get the list of repository project path configs
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           team should be created for.
 *         :qparam int integrationId: the optional integration id.
 *         :qparam int project: Optional. Pass "-1" to filter to 'all projects user has access to'. Omit to filter for 'all projects user is a member of'.
 *         :qparam int per_page: Pagination size.
 *         :qparam string cursor: Pagination cursor.
 *         :auth: required
 */
export function organizationCodeMappingsOptions(
  organization: Organization,
  query?: OrganizationCodeMappingsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/code-mappings/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
