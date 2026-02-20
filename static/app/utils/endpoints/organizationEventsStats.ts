// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationEventsStatsResponse {
  detail: unknown;
}

interface OrganizationEventsStatsQueryParams {
  dashboardWidgetId?: string;
  dataset?: string;
  disableAggregateExtrapolation?: string;
  excludeOther?: string;
  forceMetricsLayer?: string;
  partial?: string;
  preventMetricAggregates?: string;
  referrer?: string;
  topEvents?: string;
  transformAliasToInputFormat?: string;
}

type TQueryData = ApiResponse<OrganizationEventsStatsResponse>;
type TData = OrganizationEventsStatsResponse;

/** @public */
export function organizationEventsStatsOptions(
  organization: Organization,
  query?: OrganizationEventsStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/events-stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
