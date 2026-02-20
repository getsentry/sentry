// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationApiKeyDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationApiKeyDetailsResponse>;
type TData = OrganizationApiKeyDetailsResponse;

/**
 * @public
 * Retrieves API Key details
 *         `````````````````````````
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           team belongs to.
 *         :pparam string api_key_id: the ID of the api key to delete
 *         :auth: required
 */
export function organizationApiKeyDetailsOptions(
  organization: Organization,
  apiKeyId: string
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/api-keys/$apiKeyId/', {
      path: {organizationIdOrSlug: organization.slug, apiKeyId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
