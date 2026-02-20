// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationMonitorStatsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationMonitorStatsResponse>;
type TData = OrganizationMonitorStatsResponse;

/** @public */
export function organizationMonitorStatsOptions(
  organization: Organization,
  monitorIdOrSlug: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/monitors/$monitorIdOrSlug/stats/',
      {
        path: {organizationIdOrSlug: organization.slug, monitorIdOrSlug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
