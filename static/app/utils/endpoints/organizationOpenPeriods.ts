// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationOpenPeriodsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationOpenPeriodsQueryParams {
  bucketSize?: string;
  /** ID of the detector which is associated with the issue group. */
  detectorId?: string;
  /** The end of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  end?: string;
  /** ID of the event to filter open periods by. */
  eventId?: string;
  /** ID of the issue group. */
  groupId?: string;
  /** Limit the number of rows to return in the result. Default and maximum allowed is 100. */
  per_page?: string;
  /** The start of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  start?: string;
  /** The period of time for the query, will override the start & end parameters, a number followed by one of: - `d` for days  */
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<OrganizationOpenPeriodsResponse>;
type TData = OrganizationOpenPeriodsResponse;

/**
 * @public
 * Return a list of open periods for a group, identified by either detector_id or group_id.
 */
export function organizationOpenPeriodsOptions(
  organization: Organization,
  query?: OrganizationOpenPeriodsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/open-periods/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
