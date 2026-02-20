// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface ProjectCommitsResponse {
  // No response keys detected — fill in manually
}

interface ProjectCommitsQueryParams {
  query?: string | MutableSearch;
}

type TQueryData = ApiResponse<ProjectCommitsResponse>;
type TData = ProjectCommitsResponse;

/**
 * @public
 * List a Project's Commits
 *         `````````````````````````
 *
 *         Retrieve a list of commits for a given project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           commit belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to list the
 *                                      commits of.
 *         :qparam string query: this parameter can be used to create a
 *                               "starts with" filter for the commit key.
 */
export function projectCommitsOptions(
  organization: Organization,
  project: Project,
  query?: ProjectCommitsQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/commits/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
