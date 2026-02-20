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
interface OrganizationReplaySelectorIndexResponse {
  data: unknown;
}

interface OrganizationReplaySelectorIndexQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** This defines the inclusive end of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds. */
  end?: string;
  /** The name of environments to filter by. */
  environment?: string[];
  /** Limit the number of rows to return in the result. Default and maximum allowed is 100. */
  per_page?: number;
  /** The ID of the projects to filter by. */
  project?: number[];
  /** Filters results by using [query syntax](/product/sentry-basics/search/). Example: `query=(transaction:foo AND release:ab */
  query?: string | MutableSearch;
  /** The field to sort the output by. */
  sort?: Sort;
  /** This defines the start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds.Use alon */
  start?: string;
  /** This defines the range of the time series, relative to now. The range is given in a `<number><unit>` format. For example */
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationReplaySelectorIndexResponse>;
type TData = OrganizationReplaySelectorIndexResponse;

/**
 * @public
 * Return a list of selectors for a given organization.
 */
export function organizationReplaySelectorIndexOptions(
  organization: Organization,
  query?: OrganizationReplaySelectorIndexQueryParams
) {
  const {sort, query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(sort === undefined ? {} : {sort: encodeSort(sort)}),
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/replay-selectors/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
