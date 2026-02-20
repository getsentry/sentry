// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectUserReportsResponse {
  // No response keys detected — fill in manually
}

interface ProjectUserReportsQueryParams {
  status?: string;
}

type TQueryData = ApiResponse<ProjectUserReportsResponse>;
type TData = ProjectUserReportsResponse;

/**
 * @public
 * List a Project's User Feedback
 *         ``````````````````````````````
 *
 *         Return a list of user feedback items within this project.
 *
 *         *This list does not include submissions from the [User Feedback Widget](https://docs.sentry.io/product/user-feedback/#user-feedback-widget). This is because it is based on an older format called User Reports - read more [here](https://develop.sentry.dev/application/feedback-architecture/#user-reports). To return a list of user feedback items from the widget, please use the [issue API](https://docs.sentry.io/api/events/list-a-projects-issues/) with the filter `issue.category:feedback`.*
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization.
 *         :pparam string project_id_or_slug: the id or slug of the project.
 *         :auth: required
 */
export function projectUserReportsOptions(
  organization: Organization,
  project: Project,
  query?: ProjectUserReportsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/user-feedback/',
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
