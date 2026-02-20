// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface OrganizationReleasesStatsResponse {
  detail: unknown;
}

interface OrganizationReleasesStatsQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  query?: string | MutableSearch;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationReleasesStatsResponse>;
type TData = OrganizationReleasesStatsResponse;

/**
 * @public
 * List an Organization's Releases specifically for building timeseries
 *         ```````````````````````````````
 *         Return a list of releases for a given organization, sorted for most recent releases.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization
 */
export function organizationReleasesStatsOptions(
  organization: Organization,
  query?: OrganizationReleasesStatsQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/releases/stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
