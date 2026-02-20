// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectPerformanceIssueSettingsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<ProjectPerformanceIssueSettingsResponse>;
type TData = ProjectPerformanceIssueSettingsResponse;

/**
 * @public
 * Retrieve performance issue settings
 *         ``````````````````
 *
 *         Return settings for performance issues
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           project belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to configure.
 *         :auth: required
 */
export function projectPerformanceIssueSettingsOptions(
  organization: Organization,
  project: Project
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/performance-issues/configure/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
