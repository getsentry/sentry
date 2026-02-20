// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface ProjectUsersResponse {
  // No response keys detected — fill in manually
}

interface ProjectUsersQueryParams {
  /** Limit results to users matching the given query. Prefixes should be used to suggest the field to match on: `id`, `email` */
  query?: string | MutableSearch;
}

type TQueryData = ApiResponse<ProjectUsersResponse>;
type TData = ProjectUsersResponse;

/**
 * @public
 * List a Project's Users
 *         ``````````````````````
 *
 *         Return a list of users seen within this project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization.
 *         :pparam string project_id_or_slug: the id or slug of the project.
 *         :pparam string key: the tag key to look up.
 *         :auth: required
 *         :qparam string query: Limit results to users matching the given query.
 *                               Prefixes should be used to suggest the field to
 *                               match on: ``id``, ``email``, ``username``, ``ip``.
 *                               For example, ``query=email:foo@example.com``
 */
export function projectUsersOptions(
  organization: Organization,
  project: Project,
  query?: ProjectUsersQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/users/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
