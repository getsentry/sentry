// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationIssueMetricsResponse {
  meta: unknown;
  timeseries: unknown;
}

interface OrganizationIssueMetricsQueryParams {
  category?: string;
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<OrganizationIssueMetricsResponse>;
type TData = OrganizationIssueMetricsResponse;

/**
 * @public
 * Stats bucketed by time.
 */
export function organizationIssueMetricsOptions(
  organization: Organization,
  query?: OrganizationIssueMetricsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/issues-metrics/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
