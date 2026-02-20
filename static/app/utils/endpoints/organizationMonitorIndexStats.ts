// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationMonitorIndexStatsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationMonitorIndexStatsQueryParams {
  environment?: string;
  monitor?: string[];
  project?: string;
}

type TQueryData = ApiResponse<OrganizationMonitorIndexStatsResponse>;
type TData = OrganizationMonitorIndexStatsResponse;

/** @public */
export function organizationMonitorIndexStatsOptions(
  organization: Organization,
  query?: OrganizationMonitorIndexStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/monitors-stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
