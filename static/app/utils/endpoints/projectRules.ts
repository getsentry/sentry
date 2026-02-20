// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectRulesResponse {
  // No response keys detected — fill in manually
}

interface ProjectRulesQueryParams {
  expand?: string[];
}

type TQueryData = ApiResponse<ProjectRulesResponse>;
type TData = ProjectRulesResponse;

/**
 * @public
 * ## Deprecated
 *         🚧 Use [Fetch an Organization's Monitors](/api/monitors/fetch-an-organizations-monitors) and [Fetch Alerts](/api/monitors/fetch-alerts) instead.
 *
 *
 *         Return a list of active issue alert rules bound to a project.
 *
 *         An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
 *         - Triggers: specify what type of activity you'd like monitored or when an alert should be triggered.
 *         - Filters: help control noise by triggering an alert only if the issue matches the specified criteria.
 *         - Actions: specify what should happen when the trigger conditions are met and the filters match.
 */
export function projectRulesOptions(
  organization: Organization,
  project: Project,
  query?: ProjectRulesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
