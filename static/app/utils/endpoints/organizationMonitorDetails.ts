// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationMonitorDetailsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationMonitorDetailsQueryParams {
  /** The name of environments to filter by. */
  environment?: string[];
}

type TQueryData = ApiResponse<OrganizationMonitorDetailsResponse>;
type TData = OrganizationMonitorDetailsResponse;

/**
 * @public
 * Retrieves details for a monitor.
 */
export function organizationMonitorDetailsOptions(
  organization: Organization,
  monitorIdOrSlug: string,
  query?: OrganizationMonitorDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/monitors/$monitorIdOrSlug/',
      {
        path: {organizationIdOrSlug: organization.slug, monitorIdOrSlug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
