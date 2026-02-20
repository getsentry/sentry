// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationAlertRuleDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationAlertRuleDetailsResponse>;
type TData = OrganizationAlertRuleDetailsResponse;

/**
 * @public
 * ## Deprecated
 *         🚧 Use [Fetch a Monitor](/api/monitors/fetch-a-monitor) and [Fetch an Alert](/api/monitors/fetch-an-alert) instead.
 *
 *
 *         Return details on an individual metric alert rule.
 *
 *         A metric alert rule is a configuration that defines the conditions for triggering an alert.
 *         It specifies the metric type, function, time interval, and threshold
 *         values that determine when an alert should be triggered. Metric alert rules are used to monitor
 *         and notify you when certain metrics, like error count, latency, or failure rate, cross a
 *         predefined threshold. These rules help you proactively identify and address issues in your
 *         project.
 */
export function organizationAlertRuleDetailsOptions(
  organization: Organization,
  alertRuleId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/alert-rules/$alertRuleId/',
      {
        path: {organizationIdOrSlug: organization.slug, alertRuleId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
