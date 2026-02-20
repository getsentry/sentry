// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface OrganizationEventsResponse {
  data: unknown;
  detail: unknown;
  meta: unknown;
}

interface OrganizationEventsQueryParams {
  /** The fields, functions, or equations to request for the query. At most 20 fields can be selected per request. Each field  */
  field: string[];
  /** The end of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  end?: string;
  /** The name of environments to filter by. */
  environment?: string[];
  /** Limit the number of rows to return in the result. Default and maximum allowed is 100. */
  per_page?: number;
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: number[];
  /** Filters results by using [query syntax](/product/sentry-basics/search/). Example: `query=(transaction:foo AND release:ab */
  query?: string | MutableSearch;
  /** What to order the results of the query by. Must be something in the `field` list, excluding equations. */
  sort?: Sort;
  /** The start of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  start?: string;
  /** The period of time for the query, will override the start & end parameters, a number followed by one of: - `d` for days  */
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationEventsResponse>;
type TData = OrganizationEventsResponse;

/**
 * @public
 * Retrieves explore data for a given organization.
 *
 *         **Note**: This endpoint is intended to get a table of results, and is not for doing a full export of data sent to
 *         Sentry.
 *
 *         The `field` query parameter determines what fields will be selected in the `data` and `meta` keys of the endpoint response.
 *         - The `data` key contains a list of results row by row that match the `query` made
 *         - The `meta` key contains information about the response, including the unit or type of the fields requested
 */
export function organizationEventsOptions(
  organization: Organization,
  query?: OrganizationEventsQueryParams
) {
  const {query: queryParam, sort, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
    ...(sort === undefined ? {} : {sort: encodeSort(sort)}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
