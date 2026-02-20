// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface ProjectReleasesResponse {
  // No response keys detected — fill in manually
}

interface ProjectReleasesQueryParams {
  query?: string | MutableSearch;
}

type TQueryData = ApiResponse<ProjectReleasesResponse>;
type TData = ProjectReleasesResponse;

/**
 * @public
 * List a Project's Releases
 *         `````````````````````````
 *
 *         Retrieve a list of releases for a given project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to list the
 *                                      releases of.
 *         :qparam string query: this parameter can be used to create a
 *                               "starts with" filter for the version.
 */
export function projectReleasesOptions(
  organization: Organization,
  project: Project,
  query?: ProjectReleasesQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/releases/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
