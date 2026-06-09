import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {SeerProjectRepoResponse} from 'sentry/utils/seer/types';

export function getInfiniteSeerProjectReposQueryOptions({
  organization,
  project,
  query,
}: {
  organization: Organization;
  project: AvatarProject;
  query: {
    per_page?: number;
  };
}) {
  return apiOptions.asInfinite<SeerProjectRepoResponse[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query,
      staleTime: 60_000, // 1 minute
    }
  );
}
