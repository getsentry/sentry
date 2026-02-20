// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationEventsTimeseriesResponse {
  // No response keys detected — fill in manually
}

interface OrganizationEventsTimeseriesQueryParams {
  /** Which dataset to query, changing datasets changes the available fields that can be queried */
  dataset: string;
  /** The delta in seconds to return additional offset timeseries by */
  comparisonDelta?: string;
  /** Whether to disable the use of extrapolation and return the sampled values, due to sampling the number returned may be le */
  disableAggregateExtrapolation?: string;
  /** The end of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  end?: string;
  /** The name of environments to filter by. */
  environment?: string[];
  /** Only applicable with TopEvents, whether to include the 'other' timeseries which represents all the events that aren't in */
  excludeOther?: string;
  /** List of fields to group by, *Required* for topEvents queries as this and sort determine what the top events are */
  groupBy?: string[];
  /** The size of the bucket for the timeseries to have, must be a value smaller than the window being queried. If the interva */
  interval?: string;
  /** Whether to throw an error when aggregates are passed in the query or groupBy */
  preventMetricAggregates?: string;
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: string[];
  /** Filters results by using [query syntax](/product/sentry-basics/search/). Example: `query=(transaction:foo AND release:ab */
  query?: string | MutableSearch;
  /** What to order the results of the query by. Must be something in the `field` list, excluding equations. */
  sort?: Sort;
  /** The start of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`. */
  start?: string;
  /** The period of time for the query, will override the start & end parameters, a number followed by one of: - `d` for days  */
  statsPeriod?: string;
  /** <JoinedStr> */
  topEvents?: string;
  /** The aggregate field to create the timeseries for, defaults to `count()` when not included */
  yAxis?: string;
}

type TQueryData = ApiResponse<OrganizationEventsTimeseriesResponse>;
type TData = OrganizationEventsTimeseriesResponse;

/**
 * @public
 * Retrieves explore data for a given organization as a timeseries.
 *
 *         This endpoint can return timeseries for either 1 or many axis, and results grouped to the top events depending
 *         on the parameters passed
 */
export function organizationEventsTimeseriesOptions(
  organization: Organization,
  query?: OrganizationEventsTimeseriesQueryParams
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
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/events-timeseries/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
