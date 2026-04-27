import {queryOptions, type QueryClient, mutationOptions} from '@tanstack/react-query';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {projectSeerPreferencesApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {PROVIDER_TO_HANDOFF_TARGET} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';

export type PreferredAgent = 'seer' | CodingAgentIntegration;

/**
 * Returns the list of coding agent integrations formatted as select options,
 * with Seer Agent as the first/default option.
 */
export function getCodingAgentSelectQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  return queryOptions({
    ...organizationIntegrationsCodingAgents(organization),
    select: (data): Array<{label: string; value: PreferredAgent}> => [
      {value: 'seer', label: t('Seer Agent')},
      ...(data.json.integrations ?? [])
        .filter(integration => integration.id)
        .map(integration => ({value: integration, label: integration.name})),
    ],
  });
}

/**
 * Derives the currently selected coding agent for a project from its
 * preferences. Returns 'seer' when no external agent handoff is configured.
 * Pass the full integrations list to resolve the integration_id to an object.
 */
export function getSelectedAgentForProject({
  integrations,
  preference,
}: {
  integrations: CodingAgentIntegration[];
  preference: ProjectSeerPreferences;
}): PreferredAgent {
  if (!preference?.automation_handoff?.integration_id) {
    return 'seer';
  }
  return (
    integrations.find(
      i => i.id === String(preference.automation_handoff?.integration_id)
    ) ?? 'seer'
  );
}

/**
 * Returns mutation options for updating the preferred coding agent on a project,
 * suitable for passing directly to AutoSaveForm.
 *
 * Fetches current preferences before mutating to preserve repositories and
 * stopping point. Carries over auto_create_pr when switching agents.
 * Performs optimistic updates to ProjectsStore and rolls back on error.
 */
export function getProjectAgentMutationOptions({
  organization,
  project,
  queryClient,
}: {
  organization: Organization;
  project: Project;
  queryClient: QueryClient;
}) {
  const prefsOptions = projectSeerPreferencesApiOptions(organization.slug, project.slug);
  const seerPrefsQueryKey = prefsOptions.queryKey;

  return mutationOptions({
    mutationFn: async ({agent}: {agent: PreferredAgent}) => {
      const prefsData = await queryClient.fetchQuery({...prefsOptions, staleTime: 0});
      const preference = prefsData.json.preference;

      const handoff: ProjectSeerPreferences['automation_handoff'] =
        agent === 'seer'
          ? undefined
          : {
              handoff_point: 'root_cause',
              target: PROVIDER_TO_HANDOFF_TARGET[agent.provider]!,
              integration_id: Number(agent.id),
              auto_create_pr:
                preference?.automated_run_stopping_point === 'open_pr' ||
                Boolean(preference?.automation_handoff?.auto_create_pr),
            };

      return Promise.all([
        fetchMutation<Project>({
          method: 'PUT',
          url: `/projects/${organization.slug}/${project.slug}/`,
          data: {autofixAutomationTuning: 'medium'},
        }),
        fetchMutation({
          method: 'POST',
          url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
          data: {
            repositories: preference?.repositories ?? [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: handoff,
          },
        }),
      ]);
    },
    onMutate: ({agent}) => {
      const previousProject = ProjectsStore.getById(project.id);
      const previousPreference = queryClient.getQueryData(seerPrefsQueryKey);
      ProjectsStore.onUpdateSuccess({...project, autofixAutomationTuning: 'medium'});
      if (previousPreference?.json?.preference) {
        const handoff: ProjectSeerPreferences['automation_handoff'] =
          agent === 'seer'
            ? undefined
            : {
                handoff_point: 'root_cause',
                target: PROVIDER_TO_HANDOFF_TARGET[agent.provider]!,
                integration_id: Number(agent.id),
                auto_create_pr:
                  previousPreference.json.preference.automated_run_stopping_point ===
                    'open_pr' ||
                  Boolean(
                    previousPreference.json.preference.automation_handoff?.auto_create_pr
                  ),
              };
        queryClient.setQueryData(seerPrefsQueryKey, {
          ...previousPreference,
          json: {
            ...previousPreference.json,
            preference: {
              ...previousPreference.json.preference,
              automation_handoff: handoff,
            },
          },
        });
      }
      return {previousProject, previousPreference};
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProject) {
        ProjectsStore.onUpdateSuccess(context.previousProject);
      }
      if (context?.previousPreference) {
        queryClient.setQueryData(seerPrefsQueryKey, context.previousPreference);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: seerPrefsQueryKey});
      queryClient.invalidateQueries({
        queryKey: bulkAutofixAutomationSettingsInfiniteOptions({organization}).queryKey,
      });
    },
  });
}
