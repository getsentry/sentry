import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {projectSeerPreferencesApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {makeDetailedProjectQueryKey} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {
  knownAgentIntegrationsQueryOptions,
  parseAgentOption,
} from 'sentry/utils/seer/preferredAgent';
import {getSeerProjectSettingsQueryOptions} from 'sentry/utils/seer/seerProjectSettings';
import {
  getTuningFromStoppingPoint,
  resolveStoppingPoint,
} from 'sentry/utils/seer/stoppingPoint';
import type {
  AutofixAgentSelectOption,
  SeerProjectSettingResponse,
  UserFacingStoppingPoint,
} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

type TVariables = {
  agentOption: AutofixAgentSelectOption;
  project: Project;
  repoEntries: Array<{
    branch: string;
    repoId: string;
  }>;
  stoppingPoint: UserFacingStoppingPoint;
};

export function useMutateAutofixProject() {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );

  return useMutation({
    mutationFn: async ({
      project,
      repoEntries,
      agentOption,
      stoppingPoint,
    }: TVariables): Promise<void> => {
      const tuning = getTuningFromStoppingPoint(stoppingPoint);
      const {agent, integrationId} = parseAgentOption(agentOption, knownAgents);
      const {stoppingPointValue} = resolveStoppingPoint(stoppingPoint, undefined);

      const repos = repoEntries
        .filter(e => Boolean(e.repoId))
        .map(e => ({
          repositoryId: Number(e.repoId),
          branchName: e.branch || null,
        }));

      // 1. Connected repos go through the dedicated endpoint. It is addressed by
      //    repositoryId, so it handles GitLab's nested-group names that the
      //    legacy preferences endpoint's provider/owner/name matching cannot.
      await fetchMutation({
        method: 'PUT',
        url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/', {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: project.slug,
          },
        }),
        data: {repos},
      });

      // 2. Agent, tuning, and stopping point go through the project settings
      //    endpoint added for the new Seer settings UI.
      const settingsQueryOptions = getSeerProjectSettingsQueryOptions({
        organization,
        project: {slug: project.slug},
      });
      const [settingsUrl] = settingsQueryOptions.queryKey;
      await fetchMutation<SeerProjectSettingResponse>({
        method: 'PUT',
        url: settingsUrl,
        data: {
          agent,
          ...(integrationId ? {integrationId} : {}),
          automationTuning: tuning,
          ...(stoppingPointValue ? {stoppingPoint: stoppingPointValue} : {}),
        },
      });
    },
    onSuccess: (_data, variables) => {
      const {project, stoppingPoint} = variables;
      const tuning = getTuningFromStoppingPoint(stoppingPoint);

      const updatedProject = {...project, autofixAutomationTuning: tuning};
      ProjectsStore.onUpdateSuccess(updatedProject);
    },
    onSettled: (_data, _error, variables, _context) => {
      const {project} = variables;
      queryClient.invalidateQueries({
        queryKey: projectSeerPreferencesApiOptions(organization.slug, project.slug)
          .queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: bulkAutofixAutomationSettingsInfiniteOptions({organization}).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: getSeerProjectSettingsQueryOptions({
          organization,
          project: {slug: project.slug},
        }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: makeDetailedProjectQueryKey({
          orgSlug: organization.slug,
          projectSlug: project.slug,
        }),
      });
    },
  });
}
