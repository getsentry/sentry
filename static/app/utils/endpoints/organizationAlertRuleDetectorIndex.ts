// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationAlertRuleDetectorIndexResponse {
  alertRuleId: string | number;
  detectorId: string | number;
  ruleId: string | number;
}

type TQueryData = ApiResponse<OrganizationAlertRuleDetectorIndexResponse>;
type TData = OrganizationAlertRuleDetectorIndexResponse;

/**
 * @public
 * Returns a dual-written rule/alert rule and its associated detector.
 */
export function organizationAlertRuleDetectorIndexOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/alert-rule-detector/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
