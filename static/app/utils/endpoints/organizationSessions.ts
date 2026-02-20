// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationSessionsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationSessionsQueryParams {
  /** The list of fields to query. The available fields are - `sum(session)` - `count_unique(user)` - `avg`, `p50`, `p75`, `p9 */
  field: string[];
  /** The end of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  end?: string;
  /** The name of environments to filter by. */
  environment?: string[];
  /** The list of properties to group by. The available groupBy conditions are `project`, `release`, `environment` and `sessio */
  groupBy?: string[];
  /** Specify `0` to exclude series from the response. The default is `1` */
  includeSeries?: number;
  /** Specify `0` to exclude totals from the response. The default is `1` */
  includeTotals?: number;
  /** Resolution of the time series, given in the same format as `statsPeriod`. The default and the minimum interval is `1h`. */
  interval?: string;
  /** An optional field to order by, which must be one of the fields provided in `field`. Use `-` for descending order, for ex */
  orderBy?: string;
  /** The number of groups to return per request. */
  per_page?: number;
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: number[];
  /** Filters results by using [query syntax](/product/sentry-basics/search/). Example: `query=(transaction:foo AND release:ab */
  query?: string | MutableSearch;
  /** The start of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  start?: string;
  /** The period of time for the query, will override the start & end parameters, a number followed by one of: - `d` for days  */
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationSessionsResponse>;
type TData = OrganizationSessionsResponse;

/**
 * @public
 * Returns a time series of release health session statistics for projects bound to an organization.
 *
 *         The interval and date range are subject to certain restrictions and rounding rules.
 *
 *         The date range is rounded to align with the interval, and is rounded to at least one
 *         hour. The interval can at most be one day and at least one hour currently. It has to cleanly
 *         divide one day, for rounding reasons.
 *
 *         Because of technical limitations, this endpoint returns
 *         at most 10000 data points. For example, if you select a 90 day window grouped by releases,
 *         you will see at most `floor(10k / (90 + 1)) = 109` releases. To get more results, reduce the
 *         `statsPeriod`.
 */
export function organizationSessionsOptions(
  organization: Organization,
  query?: OrganizationSessionsQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/sessions/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
