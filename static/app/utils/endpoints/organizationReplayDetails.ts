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
interface OrganizationReplayDetailsResponse {
  data: unknown;
}

interface OrganizationReplayDetailsQueryParams {
  /** The cursor parameter is used to paginate results. See [here](https://docs.sentry.io/api/pagination/) for how to use this */
  cursor?: string;
  /** This defines the inclusive end of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds. */
  end?: string;
  /** The environment to filter by. */
  environment?: string;
  /** Specifies a field that should be marshaled in the output. Invalid fields will be rejected. */
  field?: string[];
  /** Limit the number of rows to return in the result. */
  per_page?: number;
  /** The ID of the projects to filter by. */
  project?: number[];
  /** A structured query string to filter the output by. */
  query?: string | MutableSearch;
  /** The field to sort the output by. */
  sort?: Sort;
  /** This defines the start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds. Use alo */
  start?: string;
  /** This defines the range of the time series, relative to now. The range is given in a `<number><unit>` format. For example */
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationReplayDetailsResponse>;
type TData = OrganizationReplayDetailsResponse;

/**
 * @public
 * Return details on an individual replay.
 */
export function organizationReplayDetailsOptions(
  organization: Organization,
  replayId: string,
  query?: OrganizationReplayDetailsQueryParams
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
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/replays/$replayId/', {
      path: {organizationIdOrSlug: organization.slug, replayId},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
