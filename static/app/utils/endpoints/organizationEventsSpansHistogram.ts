// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationEventsSpansHistogramResponse {
  // No response keys detected — fill in manually
}

interface OrganizationEventsSpansHistogramQueryParams {
  numBuckets: number;
  precision: number;
  span: string;
  dataFilter?: 'all' | 'exclude_outliers';
  end?: string;
  environment?: string;
  max?: number;
  min?: number;
  project?: string;
  query?: string | MutableSearch;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationEventsSpansHistogramResponse>;
type TData = OrganizationEventsSpansHistogramResponse;

/** @public */
export function organizationEventsSpansHistogramOptions(
  organization: Organization,
  query?: OrganizationEventsSpansHistogramQueryParams
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
      '/organizations/$organizationIdOrSlug/events-spans-histogram/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: serializedQuery,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
