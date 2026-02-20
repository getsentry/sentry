// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationMonitorProcessingErrorsIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationMonitorProcessingErrorsIndexQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<OrganizationMonitorProcessingErrorsIndexResponse>;
type TData = OrganizationMonitorProcessingErrorsIndexResponse;

/**
 * @public
 * Retrieves checkin processing errors for an organization
 */
export function organizationMonitorProcessingErrorsIndexOptions(
  organization: Organization,
  query?: OrganizationMonitorProcessingErrorsIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/processing-errors/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
