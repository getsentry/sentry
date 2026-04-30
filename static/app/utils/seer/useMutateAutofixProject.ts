import {useMutation, useQueryClient} from '@tanstack/react-query';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {
  projectSeerPreferencesApiOptions,
  type SeerPreferencesResponse,
} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Repository} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useRepositoriesById} from 'sentry/utils/repositories/useRepositoriesById';
import {buildHandoffPayload, type PreferredAgent} from 'sentry/utils/seer/preferredAgent';
import {
  getTuningFromStoppingPoint,
  resolveStoppingPoint,
} from 'sentry/utils/seer/stoppingPoint';
import type {UserFacingStoppingPoint} from 'sentry/utils/seer/stoppingPoint';
import {useOrganization} from 'sentry/utils/useOrganization';

type TData = [Project, SeerPreferencesResponse];
type TVariables = {
  agent: PreferredAgent;
  project: Project;
  repoEntries: Array<{
    branch: string;
    repoId: Repository['id'];
  }>;
  stoppingPoint: UserFacingStoppingPoint;
};

export function useMutateAutofixProject() {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const repositoriesById = useRepositoriesById();

  return useMutation({
    mutationFn: async ({
      project,
      repoEntries,
      agent,
      stoppingPoint,
    }: TVariables): Promise<TData> => {
      const tuning = getTuningFromStoppingPoint(stoppingPoint);

      const handoff = buildHandoffPayload(agent, stoppingPoint === 'create_pr');
      const {stoppingPointValue, automationHandoff} = resolveStoppingPoint(
        stoppingPoint,
        handoff
      );

      const repoDefinitions = repoEntries
        .filter(e => Boolean(e.repoId))
        .map(e => {
          const repo = repositoriesById.get(e.repoId);
          const [owner, name] = (repo?.name || '/').split('/');
          return {
            integration_id: repo?.integrationId,
            organization_id: parseInt(organization.id, 10),
            provider: repo?.provider?.name?.toLowerCase() || '',
            owner: owner || '',
            name: name || repo?.name || '',
            external_id: repo?.externalId ?? e.repoId,
            branch_name: e.branch || '',
            instructions: '',
            branch_overrides: [],
          };
        });

      return Promise.all([
        fetchMutation<Project>({
          method: 'PUT',
          url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
            },
          }),
          data: {autofixAutomationTuning: tuning},
        }),
        fetchMutation<SeerPreferencesResponse>({
          method: 'POST',
          url: getApiUrl(
            '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/preferences/',
            {
              path: {
                organizationIdOrSlug: organization.slug,
                projectIdOrSlug: project.slug,
              },
            }
          ),
          data: {
            repositories: repoDefinitions,
            automated_run_stopping_point: stoppingPointValue,
            automation_handoff: automationHandoff,
          },
        }),
      ]);
    },
    onSuccess: (_data, variables) => {
      const {project, stoppingPoint} = variables;
      const tuning = getTuningFromStoppingPoint(stoppingPoint);

      ProjectsStore.onUpdateSuccess({
        ...project,
        autofixAutomationTuning: tuning,
      });
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
    },
  });
}
