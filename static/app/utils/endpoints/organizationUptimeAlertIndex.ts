// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationUptimeAlertIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationUptimeAlertIndexQueryParams {
  end?: string;
  /** The name of environments to filter by. */
  environment?: string[];
  /** The owner of the uptime alert, in the format `user:id` or `team:id`. May be specified multiple times. */
  owner?: string;
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: string[];
  query?: string | MutableSearch;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationUptimeAlertIndexResponse>;
type TData = OrganizationUptimeAlertIndexResponse;

/**
 * @public
 * Lists uptime alerts. May be filtered to a project or environment.
 */
export function organizationUptimeAlertIndexOptions(
  organization: Organization,
  query?: OrganizationUptimeAlertIndexQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/uptime/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
