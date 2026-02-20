// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationIssueTimeSeriesResponse {
  meta: unknown;
  timeSeries: unknown;
}

interface OrganizationIssueTimeSeriesQueryParams {
  category?: string;
  end?: string;
  environment?: string;
  groupBy?: string[];
  project?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
  yAxis?: string[];
}

type TQueryData = ApiResponse<OrganizationIssueTimeSeriesResponse>;
type TData = OrganizationIssueTimeSeriesResponse;

/**
 * @public
 * Stats bucketed by time.
 */
export function organizationIssueTimeSeriesOptions(
  organization: Organization,
  query?: OrganizationIssueTimeSeriesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/issues-timeseries/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
