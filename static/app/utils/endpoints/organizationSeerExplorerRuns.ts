// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationSeerExplorerRunsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationSeerExplorerRunsQueryParams {
  category_key?: string;
  category_value?: string;
}

type TQueryData = ApiResponse<OrganizationSeerExplorerRunsResponse>;
type TData = OrganizationSeerExplorerRunsResponse;

/**
 * @public
 * Get a list of explorer runs triggered by the requesting user.
 *
 *         Query Parameters:
 *             category_key: Optional category key to filter by (e.g., "bug-fixer", "researcher")
 *             category_value: Optional category value to filter by (e.g., "issue-123", "a5b32")
 */
export function organizationSeerExplorerRunsOptions(
  organization: Organization,
  query?: OrganizationSeerExplorerRunsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/seer/explorer-runs/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
