// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationDataConditionIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationDataConditionIndexQueryParams {
  group?: string;
}

type TQueryData = ApiResponse<OrganizationDataConditionIndexResponse>;
type TData = OrganizationDataConditionIndexResponse;

/**
 * @public
 * Returns a list of data conditions for a given org
 */
export function organizationDataConditionIndexOptions(
  organization: Organization,
  query?: OrganizationDataConditionIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/data-conditions/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
