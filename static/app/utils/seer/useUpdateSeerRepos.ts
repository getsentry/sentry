import {useMutation, useQueryClient} from '@tanstack/react-query';

import {projectSeerPreferencesApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {BranchOverride} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type SeerRepoEntry = {
  branchName: string | null;
  repositoryId: number;
  branchOverrides?: BranchOverride[];
  instructions?: string | null;
};

/**
 * Replaces the full set of Seer repos for a project via the dedicated repos
 * endpoint, which looks up repos by internal repository ID. This avoids the
 * whitespace-stripping bug in the legacy preferences endpoint that caused
 * GitLab repos with spaces in their names to produce "Invalid repository"
 * errors on save.
 */
export function useUpdateSeerRepos(project: Project) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repos: SeerRepoEntry[]) =>
      fetchMutation({
        method: 'PUT',
        url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/', {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: project.slug,
          },
        }),
        data: {repos},
      }),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectSeerPreferencesApiOptions(organization.slug, project.slug)
          .queryKey,
      });
    },
  });
}
