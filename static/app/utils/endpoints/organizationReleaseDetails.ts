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
interface OrganizationReleaseDetailsResponse {
  detail: unknown;
}

interface OrganizationReleaseDetailsQueryParams {
  /** Whether or not to include adoption stages with the release. By default, this is false. */
  adoptionStages?: boolean;
  /** Whether or not to include health data with the release. By default, this is false. */
  health?: boolean;
  /** The period of time used to query health stats for the release. By default, this is 24h if health is enabled. */
  healthStatsPeriod?: '14d' | '1d' | '1h' | '24h' | '2d' | '30d' | '48h' | '7d' | '90d';
  /** The project ID to filter by. */
  project_id?: string;
  /** Filters results by using [query syntax](/product/sentry-basics/search/). Example: `query=(transaction:foo AND release:ab */
  query?: string | MutableSearch;
  /** The field used to sort results by. By default, this is `date`. */
  sort?: Sort;
  /** Release statuses that you can filter by. */
  status?: 'archived' | 'open';
  /** The period of time used to query summary stats for the release. By default, this is 14d. */
  summaryStatsPeriod?: '14d' | '1d' | '1h' | '24h' | '2d' | '30d' | '48h' | '7d' | '90d';
}

type TQueryData = ApiResponse<OrganizationReleaseDetailsResponse>;
type TData = OrganizationReleaseDetailsResponse;

/**
 * @public
 * Return details on an individual release.
 */
export function organizationReleaseDetailsOptions(
  organization: Organization,
  version: string,
  query?: OrganizationReleaseDetailsQueryParams
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
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/releases/$version/', {
      path: {organizationIdOrSlug: organization.slug, version},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
