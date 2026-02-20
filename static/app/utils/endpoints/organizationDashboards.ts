// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationDashboardsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationDashboardsQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** Limit the number of rows to return in the result. Default and maximum allowed is 100. */
  per_page?: number;
}

type TQueryData = ApiResponse<OrganizationDashboardsResponse>;
type TData = OrganizationDashboardsResponse;

/**
 * @public
 * Retrieve a list of custom dashboards that are associated with the given organization.
 */
export function organizationDashboardsOptions(
  organization: Organization,
  query?: OrganizationDashboardsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/dashboards/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
