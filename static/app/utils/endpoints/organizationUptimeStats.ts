// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationUptimeStatsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationUptimeStatsQueryParams {
  project?: string;
  uptimeDetectorId?: string[];
}

type TQueryData = ApiResponse<OrganizationUptimeStatsResponse>;
type TData = OrganizationUptimeStatsResponse;

/** @public */
export function organizationUptimeStatsOptions(
  organization: Organization,
  query?: OrganizationUptimeStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/uptime-stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
