// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationAlertRuleIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationAlertRuleIndexQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<OrganizationAlertRuleIndexResponse>;
type TData = OrganizationAlertRuleIndexResponse;

/**
 * @public
 * ## Deprecated
 *         🚧 Use [Fetch an Organization's Monitors](/api/monitors/fetch-an-organizations-monitors) and [Fetch Alerts](/api/monitors/fetch-alerts) instead.
 *
 *
 *         Return a list of active metric alert rules bound to an organization.
 *
 *         A metric alert rule is a configuration that defines the conditions for triggering an alert.
 *         It specifies the metric type, function, time interval, and threshold
 *         values that determine when an alert should be triggered. Metric alert rules are used to monitor
 *         and notify you when certain metrics, like error count, latency, or failure rate, cross a
 *         predefined threshold. These rules help you proactively identify and address issues in your
 *         project.
 */
export function organizationAlertRuleIndexOptions(
  organization: Organization,
  query?: OrganizationAlertRuleIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/alert-rules/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
