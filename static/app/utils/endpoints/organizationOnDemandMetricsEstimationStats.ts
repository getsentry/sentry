// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationOnDemandMetricsEstimationStatsResponse {
  detail: unknown;
}

interface OrganizationOnDemandMetricsEstimationStatsQueryParams {
  yAxis?: string;
}

type TQueryData = ApiResponse<OrganizationOnDemandMetricsEstimationStatsResponse>;
type TData = OrganizationOnDemandMetricsEstimationStatsResponse;

/** @public */
export function organizationOnDemandMetricsEstimationStatsOptions(
  organization: Organization,
  query?: OrganizationOnDemandMetricsEstimationStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/metrics-estimation-stats/',
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
