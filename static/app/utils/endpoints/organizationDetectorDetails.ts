// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationDetectorDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationDetectorDetailsResponse>;
type TData = OrganizationDetectorDetailsResponse;

/**
 * @public
 * ⚠️ This endpoint is currently in **beta** and may be subject to change. It is supported by [New Monitors and Alerts](/product/new-monitors-and-alerts/) and may not be viewable in the UI today.
 *
 *         Return details on an individual monitor
 */
export function organizationDetectorDetailsOptions(
  organization: Organization,
  detectorId: string
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/detectors/$detectorId/', {
      path: {organizationIdOrSlug: organization.slug, detectorId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
