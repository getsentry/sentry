import {useQuery} from '@tanstack/react-query';

import type {
  ProjectSeerPreferences,
  SeerRepoDefinition,
} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface SeerPreferencesResponse {
  code_mapping_repos: SeerRepoDefinition[];
  preference?: ProjectSeerPreferences | null;
}

/**
 * @deprecated This endpoint is deprecated and will be removed in a future release.
 * TODO(ryan953): Remove this endpoint in a future release.
 */
export function projectSeerPreferencesApiOptions(orgSlug: string, projectSlug: string) {
  return apiOptions.as<SeerPreferencesResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/preferences/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      staleTime: 60_000, // 1 minute
    }
  );
}

/**
 * @deprecated This endpoint is deprecated and will be removed in a future release.
 * TODO(ryan953): Remove this endpoint in a future release.
 */
export function useProjectSeerPreferences(project: Project) {
  const organization = useOrganization();

  return useQuery(projectSeerPreferencesApiOptions(organization.slug, project.slug));
}
