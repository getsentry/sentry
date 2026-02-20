// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectServiceHookDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<ProjectServiceHookDetailsResponse>;
type TData = ProjectServiceHookDetailsResponse;

/**
 * @public
 * Retrieve a Service Hook
 *         ```````````````````````
 *
 *         Return a service hook bound to a project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           client keys belong to.
 *         :pparam string project_id_or_slug: the id or slug of the project the client keys
 *                                      belong to.
 *         :pparam string hook_id: the guid of the service hook.
 *         :auth: required
 */
export function projectServiceHookDetailsOptions(
  organization: Organization,
  project: Project,
  hookId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/hooks/$hookId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          hookId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
