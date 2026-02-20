// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationIntegrationReposResponse {
  // No response keys detected — fill in manually
}

interface OrganizationIntegrationReposQueryParams {
  installableOnly?: string;
  search?: string;
}

type TQueryData = ApiResponse<OrganizationIntegrationReposResponse>;
type TData = OrganizationIntegrationReposResponse;

/**
 * @public
 * Get the list of repositories available in an integration
 *         ````````````````````````````````````````````````````````
 *
 *         Gets all repositories that an integration makes available,
 *         and indicates whether or not you can search repositories
 *         by name.
 *
 *         :qparam string search: Name fragment to search repositories by.
 *         :qparam bool installableOnly: If true, return only repositories that can be installed.
 *                                       If false or not provided, return all repositories.
 */
export function organizationIntegrationReposOptions(
  organization: Organization,
  integrationId: string,
  query?: OrganizationIntegrationReposQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
      {
        path: {organizationIdOrSlug: organization.slug, integrationId},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
