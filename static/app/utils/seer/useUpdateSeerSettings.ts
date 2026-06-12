import {useMutation, useQueryClient} from '@tanstack/react-query';

import {projectSeerPreferencesApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type SeerSettingsPayload = {
  agent?: string;
  autoCreatePr?: boolean;
  integrationId?: number;
  stoppingPoint?: string;
};

/**
 * Writes Seer automation settings (agent, stopping point, handoff config)
 * through the dedicated settings endpoint, which does not touch repository
 * associations. This avoids the legacy preferences endpoint's whitespace-
 * stripping bug that caused GitLab repos with spaces in their names to
 * return "Invalid repository" (HTTP 400) whenever settings were saved.
 */
export function useUpdateSeerSettings(project: Project) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: SeerSettingsPayload) =>
      fetchMutation({
        method: 'PUT',
        url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/settings/', {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: project.slug,
          },
        }),
        data: settings,
      }),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectSeerPreferencesApiOptions(organization.slug, project.slug)
          .queryKey,
      });
    },
  });
}
