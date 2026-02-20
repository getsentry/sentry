// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface ProjectReplayClicksIndexResponse {
  // No response keys detected — fill in manually
}

interface ProjectReplayClicksIndexQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** The name of environments to filter by. */
  environment?: string[];
  /** Limit the number of rows to return in the result. Default and maximum allowed is 100. */
  per_page?: number;
  /** Filters results by using [query syntax](/product/sentry-basics/search/). Example: `query=(transaction:foo AND release:ab */
  query?: string | MutableSearch;
}

type TQueryData = ApiResponse<ProjectReplayClicksIndexResponse>;
type TData = ProjectReplayClicksIndexResponse;

/**
 * @public
 * Retrieve a collection of RRWeb DOM node-ids and the timestamp they were clicked.
 */
export function projectReplayClicksIndexOptions(
  organization: Organization,
  project: Project,
  replayId: string,
  query?: ProjectReplayClicksIndexQueryParams
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
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/clicks/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          replayId,
        },
        query: serializedQuery,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
