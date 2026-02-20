// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectEnvironmentsResponse {
  detail: unknown;
}

interface ProjectEnvironmentsQueryParams {
  /** The visibility of the environments to filter by. Defaults to `visible`. */
  visibility?: 'all' | 'hidden' | 'visible';
}

type TQueryData = ApiResponse<ProjectEnvironmentsResponse>;
type TData = ProjectEnvironmentsResponse;

/**
 * @public
 * Lists a project's environments.
 */
export function projectEnvironmentsOptions(
  organization: Organization,
  project: Project,
  query?: ProjectEnvironmentsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
