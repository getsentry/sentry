// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationApiKeyIndexResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationApiKeyIndexResponse>;
type TData = OrganizationApiKeyIndexResponse;

/**
 * @public
 * List an Organization's API Keys
 *         ```````````````````````````````````
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization
 *         :auth: required
 */
export function organizationApiKeyIndexOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/api-keys/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
