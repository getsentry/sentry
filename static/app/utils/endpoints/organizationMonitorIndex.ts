// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationMonitorIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationMonitorIndexQueryParams {
  /** The name of environments to filter by. */
  environment?: string[];
  /** The owner of the monitor, in the format `user:id` or `team:id`. May be specified multiple times. */
  owner?: string;
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: number[];
}

type TQueryData = ApiResponse<OrganizationMonitorIndexResponse>;
type TData = OrganizationMonitorIndexResponse;

/**
 * @public
 * Lists monitors, including nested monitor environments. May be filtered to a project or environment.
 */
export function organizationMonitorIndexOptions(
  organization: Organization,
  query?: OrganizationMonitorIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/monitors/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
