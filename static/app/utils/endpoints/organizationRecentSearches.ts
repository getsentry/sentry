// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationRecentSearchesResponse {
  detail: unknown;
}

interface OrganizationRecentSearchesQueryParams {
  limit?: string;
  type?: string;
}

type TQueryData = ApiResponse<OrganizationRecentSearchesResponse>;
type TData = OrganizationRecentSearchesResponse;

/**
 * @public
 * List recent searches for a User within an Organization
 *         ``````````````````````````````````````````````````````
 *         Returns recent searches for a user in a given Organization.
 *
 *         :auth: required
 */
export function organizationRecentSearchesOptions(
  organization: Organization,
  query?: OrganizationRecentSearchesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/recent-searches/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
