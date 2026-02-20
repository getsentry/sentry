// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationStatsEndpointV2Response {
  // No response keys detected — fill in manually
}

interface OrganizationStatsEndpointV2QueryParams {
  /** the `sum(quantity)` field is bytes for attachments, and all others the 'event' count for those types of events. `sum(tim */
  field: 'sum(quantity)' | 'sum(times_seen)';
  /** can pass multiple groupBy parameters to group by multiple, e.g. `groupBy=project&groupBy=outcome` to group by multiple d */
  groupBy: string[];
  /** Filter by data category. Each category represents a different type of data: - `error`: Error events (includes `default`  */
  category?:
    | 'error'
    | 'transaction'
    | 'attachment'
    | 'replay'
    | 'profile'
    | 'profile_duration'
    | 'monitor';
  /** This defines the inclusive end of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds. */
  end?: string;
  /** This is the resolution of the time series, given in the same format as `statsPeriod`. The default resolution is `1h` and */
  interval?: string;
  /** See https://docs.sentry.io/product/stats/ for more information on outcome statuses. * `accepted` * `filtered` * `rate_li */
  outcome?:
    | 'accepted'
    | 'filtered'
    | 'rate_limited'
    | 'invalid'
    | 'abuse'
    | 'client_discard'
    | 'cardinality_limited';
  /** The ID of the projects to filter by. Use `-1` to include all accessible projects. */
  project?: string[];
  /** The reason field will contain why an event was filtered/dropped. */
  reason?: string;
  /** This defines the start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds.Use alon */
  start?: string;
  /** This defines the range of the time series, relative to now. The range is given in a `<number><unit>` format. For example */
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationStatsEndpointV2Response>;
type TData = OrganizationStatsEndpointV2Response;

/**
 * @public
 * Query event counts for your Organization.
 *         Select a field, define a date range, and group or filter by columns.
 */
export function organizationStatsEndpointV2Options(
  organization: Organization,
  query?: OrganizationStatsEndpointV2QueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/stats_v2/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
