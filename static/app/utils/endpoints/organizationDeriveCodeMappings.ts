// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationDeriveCodeMappingsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationDeriveCodeMappingsResponse>;
type TData = OrganizationDeriveCodeMappingsResponse;

/**
 * @public
 * Get all files from the customer repositories that match a stack trace frame.
 *         ``````````````````
 *
 *         :param organization:
 *         :param string absPath:
 *         :param string module:
 *         :param string stacktraceFilename:
 *         :param string platform:
 *         :auth: required
 */
export function organizationDeriveCodeMappingsOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/derive-code-mappings/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
