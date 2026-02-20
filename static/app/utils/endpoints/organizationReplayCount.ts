// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface OrganizationReplayCountResponse {
  detail: unknown;
}

interface OrganizationReplayCountQueryParams {
  /** The end of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  end?: string;
  /** The name of environments to filter by. */
  environment?: string[];
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: number[];
  /** Filters results by using [query syntax](/product/sentry-basics/search/). Example: `query=(transaction:foo AND release:ab */
  query?: string | MutableSearch;
  /** The start of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  start?: string;
  /** The period of time for the query, will override the start & end parameters, a number followed by one of: - `d` for days  */
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationReplayCountResponse>;
type TData = OrganizationReplayCountResponse;

/**
 * @public
 * Return a count of replays for a list of issue or transaction IDs.
 *
 *         The `query` parameter is required. It is a search query that includes exactly one of `issue.id`, `transaction`, or `replay_id` (string or list of strings).
 */
export function organizationReplayCountOptions(
  organization: Organization,
  query?: OrganizationReplayCountQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/replay-count/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
