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
interface OrganizationTracesResponse {
  // No response keys detected — fill in manually
}

interface OrganizationTracesQueryParams {
  breakdownSlices: number;
  dataset?: 'spans';
  end?: string;
  environment?: string;
  project?: string;
  query?: string | MutableSearch;
  sort?: Sort;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationTracesResponse>;
type TData = OrganizationTracesResponse;

/** @public */
export function organizationTracesOptions(
  organization: Organization,
  query?: OrganizationTracesQueryParams
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
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/traces/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
