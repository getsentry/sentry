// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface ProjectTagKeyValuesResponse {
  // No response keys detected — fill in manually
}

interface ProjectTagKeyValuesQueryParams {
  end?: string;
  query?: string | MutableSearch;
  start?: string;
  statsPeriod?: string;
  useFlagsBackend?: string;
  utc?: string;
}

type TQueryData = ApiResponse<ProjectTagKeyValuesResponse>;
type TData = ProjectTagKeyValuesResponse;

/**
 * @public
 * List a Tag's Values
 *         ```````````````````
 *
 *         Return a list of values associated with this key.  The `query`
 *         parameter can be used to to perform a "contains" match on
 *         values.
 *         When paginated can return at most 1000 values.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization.
 *         :pparam string project_id_or_slug: the id or slug of the project.
 *         :pparam string key: the tag key to look up.
 *         :auth: required
 */
export function projectTagKeyValuesOptions(
  organization: Organization,
  project: Project,
  key: string,
  query?: ProjectTagKeyValuesQueryParams
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
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/tags/$key/values/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          key,
        },
        query: serializedQuery,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
