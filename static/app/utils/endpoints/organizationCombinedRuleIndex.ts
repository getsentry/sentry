// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationCombinedRuleIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationCombinedRuleIndexQueryParams {
  alertType?: string[];
  asc?: string;
  dataset?: string[];
  expand?: string[];
  name?: string;
  project?: string;
  sort?: Sort;
  team?: string[];
}

type TQueryData = ApiResponse<OrganizationCombinedRuleIndexResponse>;
type TData = OrganizationCombinedRuleIndexResponse;

/**
 * @public
 * Fetches metric, issue, crons, and uptime alert rules for an organization
 */
export function organizationCombinedRuleIndexOptions(
  organization: Organization,
  query?: OrganizationCombinedRuleIndexQueryParams
) {
  const {sort, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(sort === undefined ? {} : {sort: encodeSort(sort)}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/combined-rules/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
