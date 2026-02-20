// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationCodingAgentsResponse {
  detail: unknown;
}

type TQueryData = ApiResponse<OrganizationCodingAgentsResponse>;
type TData = OrganizationCodingAgentsResponse;

/**
 * @public
 * Get all available coding agent integrations for the organization.
 */
export function organizationCodingAgentsOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/integrations/coding-agents/',
      {
        path: {organizationIdOrSlug: organization.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
