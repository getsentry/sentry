// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationEventsVitalsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationEventsVitalsQueryParams {
  end?: string;
  environment?: string;
  preventMetricAggregates?: string;
  project?: string;
  query?: string | MutableSearch;
  start?: string;
  statsPeriod?: string;
  vital?: string[];
}

type TQueryData = ApiResponse<OrganizationEventsVitalsResponse>;
type TData = OrganizationEventsVitalsResponse;

/** @public */
export function organizationEventsVitalsOptions(
  organization: Organization,
  query?: OrganizationEventsVitalsQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/events-vitals/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
