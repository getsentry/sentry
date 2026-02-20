// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationGroupSearchViewsStarredResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationGroupSearchViewsStarredResponse>;
type TData = OrganizationGroupSearchViewsStarredResponse;

/**
 * @public
 * Retrieve a list of starred views for the current organization member.
 */
export function organizationGroupSearchViewsStarredOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/group-search-views/starred/',
      {
        path: {organizationIdOrSlug: organization.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
