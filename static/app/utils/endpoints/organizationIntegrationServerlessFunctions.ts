// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationIntegrationServerlessFunctionsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationIntegrationServerlessFunctionsResponse>;
type TData = OrganizationIntegrationServerlessFunctionsResponse;

/**
 * @public
 * Get the list of repository project path configs in an integration
 */
export function organizationIntegrationServerlessFunctionsOptions(
  organization: Organization,
  integrationId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/serverless-functions/',
      {
        path: {organizationIdOrSlug: organization.slug, integrationId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
