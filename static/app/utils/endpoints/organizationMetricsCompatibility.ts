// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationMetricsCompatibilityResponse {
  // No response keys detected — fill in manually
}

interface OrganizationMetricsCompatibilityQueryParams {
  end?: string;
  environment?: string;
  per_page?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationMetricsCompatibilityResponse>;
type TData = OrganizationMetricsCompatibilityResponse;

/** @public */
export function organizationMetricsCompatibilityOptions(
  organization: Organization,
  query?: OrganizationMetricsCompatibilityQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/metrics-compatibility/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
