// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface DebugFilesResponse {
  // No response keys detected — fill in manually
}

interface DebugFilesQueryParams {
  code_id?: string;
  debug_id?: string;
  file_formats?: string[];
  id?: string;
  query?: string | MutableSearch;
}

type TQueryData = ApiResponse<DebugFilesResponse>;
type TData = DebugFilesResponse;

/**
 * @public
 * List a Project's Debug Information Files
 *         ````````````````````````````````````````
 *
 *         Retrieve a list of debug information files for a given project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           file belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to list the
 *                                      DIFs of.
 *         :qparam string query: If set, this parameter is used to locate DIFs with.
 *         :qparam string id: If set, the specified DIF will be sent in the response.
 *         :qparam string file_formats: If set, only DIFs with these formats will be returned.
 *         :auth: required
 */
export function debugFilesOptions(
  organization: Organization,
  project: Project,
  query?: DebugFilesQueryParams
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
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/dsyms/',
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
