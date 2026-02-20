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
interface OrganizationTagKeyValuesResponse {
  detail: unknown;
}

interface OrganizationTagKeyValuesQueryParams {
  dataset?: string;
  end?: string;
  environment?: string;
  includeReplays?: string;
  includeSessions?: string;
  includeTransactions?: string;
  project?: string;
  query?: string | MutableSearch;
  sort?: Sort;
  start?: string;
  statsPeriod?: string;
  useFlagsBackend?: string;
}

type TQueryData = ApiResponse<OrganizationTagKeyValuesResponse>;
type TData = OrganizationTagKeyValuesResponse;

/** @public */
export function organizationTagKeyValuesOptions(
  organization: Organization,
  key: string,
  query?: OrganizationTagKeyValuesQueryParams
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
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/tags/$key/values/', {
      path: {organizationIdOrSlug: organization.slug, key},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
