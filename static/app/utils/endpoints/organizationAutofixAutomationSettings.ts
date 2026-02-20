// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface OrganizationAutofixAutomationSettingsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationAutofixAutomationSettingsQueryParams {
  /** Optional search query to filter by project name or slug. */
  query?: string | MutableSearch;
}

type TQueryData = ApiResponse<OrganizationAutofixAutomationSettingsResponse>;
type TData = OrganizationAutofixAutomationSettingsResponse;

/**
 * @public
 * List projects with their autofix automation settings.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization.
 *         :qparam string query: Optional search query to filter by project name or slug.
 *         :auth: required
 */
export function organizationAutofixAutomationSettingsOptions(
  organization: Organization,
  query?: OrganizationAutofixAutomationSettingsQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/autofix/automation-settings/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: serializedQuery,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
