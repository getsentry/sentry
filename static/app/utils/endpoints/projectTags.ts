// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectTagsResponse {
  // No response keys detected — fill in manually
}

interface ProjectTagsQueryParams {
  includeValuesSeen?: string;
  onlySamplingTags?: string;
  useFlagsBackend?: string;
}

type TQueryData = ApiResponse<ProjectTagsResponse>;
type TData = ProjectTagsResponse;

/** @public */
export function projectTagsOptions(
  organization: Organization,
  project: Project,
  query?: ProjectTagsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/tags/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
