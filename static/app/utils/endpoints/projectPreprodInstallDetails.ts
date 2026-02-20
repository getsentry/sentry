// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectPreprodInstallDetailsResponse {
  code_signature_errors: unknown;
  error: unknown;
  is_code_signature_valid: boolean;
  platform: string;
}

type TQueryData = ApiResponse<ProjectPreprodInstallDetailsResponse>;
type TData = ProjectPreprodInstallDetailsResponse;

/** @public */
export function projectPreprodInstallDetailsOptions(
  organization: Organization,
  project: Project,
  headArtifactId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/$headArtifactId/install-details/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          headArtifactId,
        },
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
