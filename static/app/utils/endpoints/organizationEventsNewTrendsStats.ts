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
interface OrganizationEventsNewTrendsStatsResponse {
  events: unknown;
  stats: unknown;
}

interface OrganizationEventsNewTrendsStatsQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  query?: string | MutableSearch;
  sort?: Sort;
  start?: string;
  statsPeriod?: string;
  topEvents?: string;
  trendFunction?: string;
  trendType?: string;
  withTimeseries?: string;
}

type TQueryData = ApiResponse<OrganizationEventsNewTrendsStatsResponse>;
type TData = OrganizationEventsNewTrendsStatsResponse;

/** @public */
export function organizationEventsNewTrendsStatsOptions(
  organization: Organization,
  query?: OrganizationEventsNewTrendsStatsQueryParams
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
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/events-trends-statsv2/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
