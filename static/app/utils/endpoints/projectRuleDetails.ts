// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectRuleDetailsResponse {
  // No response keys detected — fill in manually
}

interface ProjectRuleDetailsQueryParams {
  expand?: string[];
}

type TQueryData = ApiResponse<ProjectRuleDetailsResponse>;
type TData = ProjectRuleDetailsResponse;

/**
 * @public
 * ## Deprecated
 *         🚧 Use [Fetch an Alert](/api/monitors/fetch-an-alert) instead.
 *
 *
 *         Return details on an individual issue alert rule.
 *
 *         An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
 *         - Triggers - specify what type of activity you'd like monitored or when an alert should be triggered.
 *         - Filters - help control noise by triggering an alert only if the issue matches the specified criteria.
 *         - Actions - specify what should happen when the trigger conditions are met and the filters match.
 */
export function projectRuleDetailsOptions(
  organization: Organization,
  project: Project,
  ruleId: string,
  query?: ProjectRuleDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/$ruleId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          ruleId,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
