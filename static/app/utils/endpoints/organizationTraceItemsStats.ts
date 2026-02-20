// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface OrganizationTraceItemsStatsResponse {
  data: unknown;
}

interface OrganizationTraceItemsStatsQueryParams {
  statsType: string[];
  end?: string;
  environment?: string;
  limit?: number;
  project?: string;
  query?: string | MutableSearch;
  spansLimit?: number;
  start?: string;
  statsPeriod?: string;
  /** Match substring on attribute name. */
  substringMatch?: string;
}

type TQueryData = ApiResponse<OrganizationTraceItemsStatsResponse>;
type TData = OrganizationTraceItemsStatsResponse;

/** @public */
export function organizationTraceItemsStatsOptions(
  organization: Organization,
  query?: OrganizationTraceItemsStatsQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/trace-items/stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
