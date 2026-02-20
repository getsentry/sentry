// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationIntegrationsResponse {
  detail: unknown;
}

interface OrganizationIntegrationsQueryParams {
  /** Integration features to filter by. See our [Integrations Documentation](/product/integrations/) for an updated list of f */
  features?: string[];
  /** Specify `True` to fetch third-party integration configurations. Note that this can add several seconds to the response t */
  includeConfig?: boolean;
  /** Specific integration provider to filter by such as `slack`. See our [Integrations Documentation](/product/integrations/) */
  providerKey?: string;
}

type TQueryData = ApiResponse<OrganizationIntegrationsResponse>;
type TData = OrganizationIntegrationsResponse;

/**
 * @public
 * Lists all the available Integrations for an Organization.
 */
export function organizationIntegrationsOptions(
  organization: Organization,
  query?: OrganizationIntegrationsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/integrations/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
