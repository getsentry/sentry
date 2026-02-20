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
interface OrganizationTraceLogsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationTraceLogsQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  query?: string | MutableSearch;
  replayId?: string;
  sort?: Sort;
  start?: string;
  statsPeriod?: string;
  traceId?: string[];
}

type TQueryData = ApiResponse<OrganizationTraceLogsResponse>;
type TData = OrganizationTraceLogsResponse;

/** @public */
export function organizationTraceLogsOptions(
  organization: Organization,
  query?: OrganizationTraceLogsQueryParams
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
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/trace-logs/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
