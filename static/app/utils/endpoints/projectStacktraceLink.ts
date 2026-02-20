// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProjectStacktraceLinkResponse {
  attemptedUrl: string;
  config: unknown;
  detail: unknown;
  error: unknown;
  integrations: unknown;
  sourcePath: string;
  sourceUrl: string;
}

type TQueryData = ApiResponse<ProjectStacktraceLinkResponse>;
type TData = ProjectStacktraceLinkResponse;

/** @public */
export function projectStacktraceLinkOptions(
  organization: Organization,
  project: Project
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/stacktrace-link/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
