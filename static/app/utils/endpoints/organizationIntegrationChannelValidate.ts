// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationIntegrationChannelValidateResponse {
  detail: unknown;
  valid: string | number;
}

interface OrganizationIntegrationChannelValidateQueryParams {
  channel: string;
}

type TQueryData = ApiResponse<OrganizationIntegrationChannelValidateResponse>;
type TData = OrganizationIntegrationChannelValidateResponse;

/**
 * @public
 * Validate whether a channel exists for the given integration.
 */
export function organizationIntegrationChannelValidateOptions(
  organization: Organization,
  integrationId: string,
  query?: OrganizationIntegrationChannelValidateQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/channel-validate/',
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
