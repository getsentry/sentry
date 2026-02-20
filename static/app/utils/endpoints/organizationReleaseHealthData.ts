// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationReleaseHealthDataResponse {
  // No response keys detected — fill in manually
}

interface OrganizationReleaseHealthDataQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<OrganizationReleaseHealthDataResponse>;
type TData = OrganizationReleaseHealthDataResponse;

/** @public */
export function organizationReleaseHealthDataOptions(
  organization: Organization,
  query?: OrganizationReleaseHealthDataQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/metrics/data/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
