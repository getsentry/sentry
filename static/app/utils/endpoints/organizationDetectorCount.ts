// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationDetectorCountResponse {
  // No response keys detected — fill in manually
}

interface OrganizationDetectorCountQueryParams {
  end?: string;
  environment?: string;
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: string[];
  start?: string;
  statsPeriod?: string;
  /** Filter by monitor type(s). Can be specified multiple times. */
  type?: string[];
}

type TQueryData = ApiResponse<OrganizationDetectorCountResponse>;
type TData = OrganizationDetectorCountResponse;

/**
 * @public
 * Retrieves the count of detectors for an organization.
 */
export function organizationDetectorCountOptions(
  organization: Organization,
  query?: OrganizationDetectorCountQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/detectors/count/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
