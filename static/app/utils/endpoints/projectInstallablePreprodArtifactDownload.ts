// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectInstallablePreprodArtifactDownloadResponse {
  error: unknown;
}

interface ProjectInstallablePreprodArtifactDownloadQueryParams {
  response_format?: string;
}

type TQueryData = ApiResponse<ProjectInstallablePreprodArtifactDownloadResponse>;
type TData = ProjectInstallablePreprodArtifactDownloadResponse;

/**
 * @public
 * Download an installable preprod artifact or its plist, if not expired.
 */
export function projectInstallablePreprodArtifactDownloadOptions(
  organization: Organization,
  project: Project,
  urlPath: string,
  query?: ProjectInstallablePreprodArtifactDownloadQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/installablepreprodartifact/$urlPath/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          urlPath,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
