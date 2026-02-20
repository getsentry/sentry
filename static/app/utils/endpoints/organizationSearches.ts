// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationSearchesResponse {
  detail: unknown;
}

interface OrganizationSearchesQueryParams {
  type?: string;
}

type TQueryData = ApiResponse<OrganizationSearchesResponse>;
type TData = OrganizationSearchesResponse;

/**
 * @public
 * List an Organization's saved searches
 *         `````````````````````````````````````
 *         Retrieve a list of saved searches for a given Organization. For custom
 *         saved searches, return them for all projects even if we have duplicates.
 *         For default searches, just return one of each search
 *
 *         :auth: required
 */
export function organizationSearchesOptions(
  organization: Organization,
  query?: OrganizationSearchesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/searches/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
