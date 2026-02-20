// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationPluginDeprecationInfoResponse {
  affected_groups: unknown;
  affected_rules: unknown;
}

type TQueryData = ApiResponse<OrganizationPluginDeprecationInfoResponse>;
type TData = OrganizationPluginDeprecationInfoResponse;

/**
 * @public
 * Returns a list of objects that are affected by a plugin deprecation. Objects could be issues or alert rules or both
 *         pparam: organization, plugin_slug
 */
export function organizationPluginDeprecationInfoOptions(
  organization: Organization,
  pluginSlug: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/plugins/$pluginSlug/deprecation-info/',
      {
        path: {organizationIdOrSlug: organization.slug, pluginSlug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
