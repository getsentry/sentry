// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationMonitorScheduleSampleWindowResponse {
  end: unknown;
  start: unknown;
}

type TQueryData = ApiResponse<OrganizationMonitorScheduleSampleWindowResponse>;
type TData = OrganizationMonitorScheduleSampleWindowResponse;

/** @public */
export function organizationMonitorScheduleSampleWindowOptions(
  organization: Organization
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/monitors-schedule-window/',
      {
        path: {organizationIdOrSlug: organization.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
