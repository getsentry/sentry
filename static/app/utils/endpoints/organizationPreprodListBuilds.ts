// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationPreprodListBuildsResponse {
  error: unknown;
}

interface OrganizationPreprodListBuildsQueryParams {
  end?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<OrganizationPreprodListBuildsResponse>;
type TData = OrganizationPreprodListBuildsResponse;

/**
 * @public
 * List preprod builds for an organization across multiple projects
 *         ```````````````````````````````````````````````````````````````````
 *
 *         List preprod builds for an organization with optional filtering by projects and pagination.
 *
 *         :pparam string organization_id_or_slug: (required) the id or slug of the organization the
 *                                           artifacts belong to.
 *         :qparam list project: (optional) list of project IDs to filter by (query params like ?project=1&project=2)
 *         :qparam string app_id: (optional) filter by app identifier (e.g., "com.myapp.MyApp")
 *         :qparam string state: (optional) filter by artifact state (0=uploading, 1=uploaded, 3=processed, 4=failed)
 *         :qparam string build_version: (optional) filter by build version
 *         :qparam string build_configuration: (optional) filter by build configuration name
 *         :qparam string platform: (optional) filter by platform (ios, android, macos)
 *         :qparam string release_version: (optional) filter by release version (formats: "app_id@version+build_number" or "app_id@version")
 *         :qparam string query: (optional) general search across app name, app ID, build version, and commit SHA
 *         :qparam int per_page: (optional) number of results per page (default 25, max 100)
 *         :qparam string cursor: (optional) cursor for pagination
 *         :auth: required
 */
export function organizationPreprodListBuildsOptions(
  organization: Organization,
  query?: OrganizationPreprodListBuildsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/preprodartifacts/list-builds/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
