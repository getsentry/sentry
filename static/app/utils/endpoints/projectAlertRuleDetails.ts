// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectAlertRuleDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<ProjectAlertRuleDetailsResponse>;
type TData = ProjectAlertRuleDetailsResponse;

/**
 * @public
 * Fetch a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
 *         ``````````````````
 *         :auth: required
 */
export function projectAlertRuleDetailsOptions(
  organization: Organization,
  project: Project,
  alertRuleId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/alert-rules/$alertRuleId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          alertRuleId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
