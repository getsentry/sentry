import type {
  ProjectSeerPreferences,
  SeerRepoDefinition,
} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export interface SeerPreferencesResponse {
  code_mapping_repos: SeerRepoDefinition[];
  preference?: ProjectSeerPreferences | null;
}

export function makeProjectSeerPreferencesQueryKey(
  orgSlug: string,
  projectSlug: string
): ApiQueryKey {
  return [`/projects/${orgSlug}/${projectSlug}/seer/preferences/`];
}

export function useProjectSeerPreferences(project: Project) {
  const organization = useOrganization();

  const {data, ...rest} = useApiQuery<SeerPreferencesResponse>(
    makeProjectSeerPreferencesQueryKey(organization.slug, project.slug),
    {
      staleTime: 60000, // 1 minute
    }
  );

  return {
    preference: data?.preference,
    codeMappingRepos: data?.code_mapping_repos,
    ...rest,
  };
}
