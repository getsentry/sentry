import {useCallback, useMemo} from 'react';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {
  useFetchProjectSeerPreferences,
  useUpdateProjectSeerPreferences,
} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import {PROVIDER_TO_HANDOFF_TARGET} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {fetchMutation, mutationOptions, useQuery} from 'sentry/utils/queryClient';

export type PreferredAgent = 'seer' | CodingAgentIntegration;

/**
 * Fetches the raw list of coding agent integrations available to the org.
 */
export function useFetchCodingAgentIntegrations({
  organization,
}: {
  organization: Organization;
}) {
  return useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => data.json.integrations ?? [],
  });
}

/**
 * Returns the list of coding agent integrations formatted as select options,
 * with Seer Agent as the first/default option.
 */
export function useCodingAgentSelectOptions({
  organization,
}: {
  organization: Organization;
}) {
  return useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => [
      {value: 'seer' as const, label: t('Seer Agent')},
      ...(data.json.integrations ?? [])
        .filter(integration => integration.id)
        .map(integration => ({value: integration, label: integration.name})),
    ],
  });
}

/**
 * Resolves the org's current default coding agent to the actual integration
 * object. Returns 'seer' when no external agent is configured.
 */
export function useOrgDefaultAgent({organization}: {organization: Organization}) {
  const value = organization.defaultCodingAgentIntegrationId
    ? String(organization.defaultCodingAgentIntegrationId)
    : organization.defaultCodingAgent;

  const query = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    enabled: value !== null && value !== 'seer',
    select: data =>
      data.json.integrations?.find(i => i.id === String(value!)) ?? ('seer' as const),
  });

  if (value === null || value === 'seer') {
    return {
      ...query,
      data: 'seer' as const,
      isPending: false,
      isSuccess: true,
      status: 'success' as const,
    };
  }

  return query;
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
 * Hook wrapper around getSelectedAgentForProject that memoizes the result.
 */
export function useSelectedAgentForProject({
  integrations,
  preference,
}: {
  integrations: CodingAgentIntegration[];
  preference: ProjectSeerPreferences;
}): PreferredAgent {
  return useMemo(
    () => getSelectedAgentForProject({integrations, preference}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preference?.automation_handoff?.integration_id, integrations]
  );
}

/**
 * Returns mutation options for updating the org-level default coding agent.
 * Use with useMutation(updateOrgDefaultAgentMutationOptions({organization})).
 */
export function updateOrgDefaultAgentMutationOptions({
  organization,
}: {
  organization: Organization;
}) {
  return mutationOptions({
    mutationFn: ({integration}: {integration: PreferredAgent}) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data:
          integration === 'seer'
            ? {defaultCodingAgent: integration, defaultCodingAgentIntegrationId: null}
            : {
                defaultCodingAgent: integration.provider,
                defaultCodingAgentIntegrationId: integration.id,
              },
      }),
    onSuccess: updateOrganization,
  });
}

/**
 * Returns a callback to update the preferred coding agent for a single project.
 *
 * Writes two things:
 *  - project.autofixAutomationTuning ('medium' for any agent, 'off' to disable)
 *  - project seer preferences: automation_handoff (cleared for Seer, set for external agents)
 *
 * When switching to an external agent, auto_create_pr is carried over from the
 * current automated_run_stopping_point so the user's PR preference is preserved.
 */
export function useUpdateProjectAgent({project}: {project: Project}) {
  const {mutateAsync: updateProject} = useUpdateProject(project);
  const {mutateAsync: updateProjectSeerPreferences} =
    useUpdateProjectSeerPreferences(project);
  const fetchPreferences = useFetchProjectSeerPreferences({project});

  return useCallback(
    async (integration: PreferredAgent) => {
      const preference = await fetchPreferences();

      if (integration === 'seer') {
        await Promise.all([
          updateProject({autofixAutomationTuning: 'medium'}),
          updateProjectSeerPreferences({
            repositories: preference?.repositories ?? [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: undefined,
          }),
        ]);
      } else {
        const handoff: ProjectSeerPreferences['automation_handoff'] = {
          handoff_point: 'root_cause',
          target: PROVIDER_TO_HANDOFF_TARGET[integration.provider]!,
          integration_id: Number(integration.id),
          // Carry over whether the user had "create PR" enabled
          auto_create_pr: preference?.automated_run_stopping_point === 'open_pr',
        };
        await Promise.all([
          updateProject({autofixAutomationTuning: 'medium'}),
          updateProjectSeerPreferences({
            repositories: preference?.repositories ?? [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: handoff,
          }),
        ]);
      }
    },
    [fetchPreferences, updateProject, updateProjectSeerPreferences]
  );
}
