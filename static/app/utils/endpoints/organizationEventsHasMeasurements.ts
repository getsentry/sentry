// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationEventsHasMeasurementsResponse {
  measurements: unknown;
}

interface OrganizationEventsHasMeasurementsQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
  transaction?: string;
  type?: string;
}

type TQueryData = ApiResponse<OrganizationEventsHasMeasurementsResponse>;
type TData = OrganizationEventsHasMeasurementsResponse;

/** @public */
export function organizationEventsHasMeasurementsOptions(
  organization: Organization,
  query?: OrganizationEventsHasMeasurementsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/events-has-measurements/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
