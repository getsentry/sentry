// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationEventsFacetsPerformanceHistogramResponse {
  // No response keys detected — fill in manually
}

interface OrganizationEventsFacetsPerformanceHistogramQueryParams {
  numBucketsPerKey?: string;
  per_page?: string;
  tagKey?: string;
}

type TQueryData = ApiResponse<OrganizationEventsFacetsPerformanceHistogramResponse>;
type TData = OrganizationEventsFacetsPerformanceHistogramResponse;

/** @public */
export function organizationEventsFacetsPerformanceHistogramOptions(
  organization: Organization,
  query?: OrganizationEventsFacetsPerformanceHistogramQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/events-facets-performance-histogram/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
