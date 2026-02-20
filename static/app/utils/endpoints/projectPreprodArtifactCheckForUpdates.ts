// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectPreprodArtifactCheckForUpdatesResponse {
  error: unknown;
}

interface ProjectPreprodArtifactCheckForUpdatesQueryParams {
  app_id?: string;
  build_configuration?: string;
  build_number?: string;
  build_version?: string;
  codesigning_type?: string;
  install_groups?: string[];
  main_binary_identifier?: string;
  platform?: string;
}

type TQueryData = ApiResponse<ProjectPreprodArtifactCheckForUpdatesResponse>;
type TData = ProjectPreprodArtifactCheckForUpdatesResponse;

/**
 * @public
 * Check for updates for a preprod artifact
 */
export function projectPreprodArtifactCheckForUpdatesOptions(
  organization: Organization,
  project: Project,
  query?: ProjectPreprodArtifactCheckForUpdatesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/check-for-updates/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
