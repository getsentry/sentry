// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationDetectorAnomalyDataResponse {
  data: unknown;
  detail: unknown;
}

interface OrganizationDetectorAnomalyDataQueryParams {
  end?: string;
  legacy_alert?: string;
  start?: string;
}

type TQueryData = ApiResponse<OrganizationDetectorAnomalyDataResponse>;
type TData = OrganizationDetectorAnomalyDataResponse;

/**
 * @public
 * Return anomaly detection threshold data (yhat_lower, yhat_upper) for a detector
 *         or legacy alert rule.
 *
 *         Pass `legacy_alert=true` query param to treat detector_id as a legacy alert rule ID.
 */
export function organizationDetectorAnomalyDataOptions(
  organization: Organization,
  detectorId: string,
  query?: OrganizationDetectorAnomalyDataQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/detectors/$detectorId/anomaly-data/',
      {
        path: {organizationIdOrSlug: organization.slug, detectorId},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
