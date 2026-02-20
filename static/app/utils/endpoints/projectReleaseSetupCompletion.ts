// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectReleaseSetupCompletionResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<ProjectReleaseSetupCompletionResponse>;
type TData = ProjectReleaseSetupCompletionResponse;

/**
 * @public
 * Get list with release setup progress for a project
 *         1. tag an error
 *         2. link a repo
 *         3. associate commits
 *         4. tell sentry about a deploy
 */
export function projectReleaseSetupCompletionOptions(
  organization: Organization,
  project: Project
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/completion/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
