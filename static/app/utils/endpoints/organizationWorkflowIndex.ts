// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationWorkflowIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationWorkflowIndexQueryParams {
  /** The ID of the alert you'd like to query. */
  id?: string[];
  priorityDetector?: string;
  /** The IDs of projects to filter by. `-1` means all available projects. For example, the following are valid parameters: -  */
  project?: string[];
  /** An optional search query for filtering alerts. */
  query?: string | MutableSearch;
  /** The field to sort results by. If not specified, the results are sorted by id. Available fields are: - `name` - `id` - `d */
  sortBy?: string;
}

type TQueryData = ApiResponse<OrganizationWorkflowIndexResponse>;
type TData = OrganizationWorkflowIndexResponse;

/**
 * @public
 * ⚠️ This endpoint is currently in **beta** and may be subject to change. It is supported by [New Monitors and Alerts](/product/new-monitors-and-alerts/) and may not be viewable in the UI today.
 *
 *         Returns a list of alerts for a given organization
 */
export function organizationWorkflowIndexOptions(
  organization: Organization,
  query?: OrganizationWorkflowIndexQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/workflows/', {
      path: {organizationIdOrSlug: organization.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
