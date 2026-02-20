// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationPluginsConfigsResponse {
  detail: unknown;
}

interface OrganizationPluginsConfigsQueryParams {
  plugins?: string[];
}

type TQueryData = ApiResponse<OrganizationPluginsConfigsResponse>;
type TData = OrganizationPluginsConfigsResponse;

/**
 * @public
 * List one or more plugin configurations, including a `projectList` for each plugin which contains
 *         all the projects that have that specific plugin both configured and enabled.
 *
 *         - similar to the `OrganizationPluginsEndpoint`, and can eventually replace it
 *
 *         :qparam plugins array[string]: an optional list of plugin ids (slugs) if you want specific plugins.
 *                                     If not set, will return configurations for all plugins.
 */
export function organizationPluginsConfigsOptions(
  organization: Organization,
  query?: OrganizationPluginsConfigsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/plugins/configs/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
