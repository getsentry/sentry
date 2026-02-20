// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectRuleTaskDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<ProjectRuleTaskDetailsResponse>;
type TData = ProjectRuleTaskDetailsResponse;

/**
 * @public
 * Retrieve the status of the async task
 *
 *         Return details of the rule if the task is successful
 */
export function projectRuleTaskDetailsOptions(
  organization: Organization,
  project: Project,
  taskUuid: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/rule-task/$taskUuid/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          taskUuid,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
