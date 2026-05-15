import {useMemo} from 'react';
import {useQuery, type QueryClient} from '@tanstack/react-query';
import {queryOptions, mutationOptions} from '@tanstack/react-query';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {projectSeerPreferencesApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {PROVIDER_TO_HANDOFF_TARGET} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export type PreferredAgent = 'seer' | CodingAgentIntegration;

export function useOrgDefaultAgent() {
  const organization = useOrganization();
  const agentOptions = useQuery(getCodingAgentSelectQueryOptions({organization}));

  const integrations = useMemo(
    () =>
      (agentOptions.data ?? [])
        .filter(
          (o): o is {label: string; value: CodingAgentIntegration} => o.value !== 'seer'
        )
        .map(o => o.value),
    [agentOptions.data]
  );

  return useMemo((): PreferredAgent => {
    if (organization.defaultCodingAgentIntegrationId) {
      const match = integrations.find(
        i => i.id === String(organization.defaultCodingAgentIntegrationId)
      );
      if (match) {
        return match;
      }
    }
    return 'seer';
  }, [organization.defaultCodingAgentIntegrationId, integrations]);
}

/**
 * Builds the automation_handoff payload for a given agent.
 * Returns undefined for Seer (no external handoff needed).
 */
export function buildHandoffPayload(
  agent: PreferredAgent,
  autoCreatePr: boolean
): ProjectSeerPreferences['automation_handoff'] {
  if (agent === 'seer') {
    return undefined;
  }
  return {
    handoff_point: 'root_cause',
    target: PROVIDER_TO_HANDOFF_TARGET[agent.provider]!,
    integration_id: Number(agent.id),
    auto_create_pr: autoCreatePr,
  };
}

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
  project: DetailedProject;
  queryClient: QueryClient;
}) {
  const prefsOptions = projectSeerPreferencesApiOptions(organization.slug, project.slug);
  const seerPrefsQueryKey = prefsOptions.queryKey;

  return mutationOptions({
    mutationFn: async ({agent}: {agent: PreferredAgent}) => {
      const prefsData = await queryClient.fetchQuery({...prefsOptions, staleTime: 0});
      const preference = prefsData.json.preference;

      const autoCreatePr =
        preference?.automated_run_stopping_point === 'open_pr' ||
        Boolean(preference?.automation_handoff?.auto_create_pr);
      const handoff = buildHandoffPayload(agent, autoCreatePr);

      return Promise.all([
        fetchMutation<DetailedProject>({
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
    onMutate: ({agent}: {agent: PreferredAgent}) => {
      const previousProject = ProjectsStore.getById(project.id);
      const previousPreference = queryClient.getQueryData(seerPrefsQueryKey);
      const updatedProject = {...project, autofixAutomationTuning: 'medium' as const};
      ProjectsStore.onUpdateSuccess(updatedProject);
      if (previousPreference?.json?.preference) {
        const autoCreatePr =
          previousPreference.json.preference.automated_run_stopping_point === 'open_pr' ||
          Boolean(previousPreference.json.preference.automation_handoff?.auto_create_pr);
        const handoff = buildHandoffPayload(agent, autoCreatePr);
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
