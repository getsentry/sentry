// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationConfigIntegrationsResponse {
  detail: unknown;
  providers: unknown;
}

interface OrganizationConfigIntegrationsQueryParams {
  /** Specific integration provider to filter by such as `slack`. See our [Integrations Documentation](/product/integrations/) */
  providerKey?: string;
}

type TQueryData = ApiResponse<OrganizationConfigIntegrationsResponse>;
type TData = OrganizationConfigIntegrationsResponse;

/**
 * @public
 * Get integration provider information about all available integrations for an organization.
 */
export function organizationConfigIntegrationsOptions(
  organization: Organization,
  query?: OrganizationConfigIntegrationsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/config/integrations/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
