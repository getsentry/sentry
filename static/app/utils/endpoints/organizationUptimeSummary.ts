// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationUptimeSummaryResponse {
  // No response keys detected — fill in manually
}

interface OrganizationUptimeSummaryQueryParams {
  end?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
  uptimeDetectorId?: string[];
  utc?: string;
}

type TQueryData = ApiResponse<OrganizationUptimeSummaryResponse>;
type TData = OrganizationUptimeSummaryResponse;

/** @public */
export function organizationUptimeSummaryOptions(
  organization: Organization,
  query?: OrganizationUptimeSummaryQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/uptime-summary/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
