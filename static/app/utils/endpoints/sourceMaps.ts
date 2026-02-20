// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface SourceMapsResponse {
  error: unknown;
}

interface SourceMapsQueryParams {
  query?: string | MutableSearch;
  sortBy?: string;
}

type TQueryData = ApiResponse<SourceMapsResponse>;
type TData = SourceMapsResponse;

/**
 * @public
 * List a Project's Source Map Archives
 *         ````````````````````````````````````
 *
 *         Retrieve a list of source map archives (releases, later bundles) for a given project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           source map archive belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to list the
 *                                      source map archives of.
 *         :qparam string query: If set, this parameter is used to locate source map archives with.
 *         :auth: required
 */
export function sourceMapsOptions(
  organization: Organization,
  project: Project,
  query?: SourceMapsQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/source-maps/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        query: serializedQuery,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
