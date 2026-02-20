// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationStatsSummaryResponse {
  // No response keys detected — fill in manually
}

interface OrganizationStatsSummaryQueryParams {
  /** the `sum(quantity)` field is bytes for attachments, and all others the 'event' count for those types of events. `sum(tim */
  field: 'sum(quantity)' | 'sum(times_seen)';
  /** If filtering by attachments, you cannot filter by any other category due to quantity values becoming nonsensical (combin */
  category?: 'error' | 'transaction' | 'attachment' | 'replays' | 'profiles';
  /** Download the API response in as a csv file */
  download?: boolean;
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
  /** The ID of the projects to filter by. */
  project?: string[];
  /** The reason field will contain why an event was filtered/dropped. */
  reason?: string;
  /** This defines the start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds.Use alon */
  start?: string;
  /** This defines the range of the time series, relative to now. The range is given in a `<number><unit>` format. For example */
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationStatsSummaryResponse>;
type TData = OrganizationStatsSummaryResponse;

/**
 * @public
 * Query summarized event counts by project for your Organization. Also see https://docs.sentry.io/api/organizations/retrieve-event-counts-for-an-organization-v2/ for reference.
 */
export function organizationStatsSummaryOptions(
  organization: Organization,
  query?: OrganizationStatsSummaryQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/stats-summary/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
