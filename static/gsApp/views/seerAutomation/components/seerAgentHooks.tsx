import {useCallback, useMemo} from 'react';

import {
  bulkAutofixAutomationSettingsInfiniteOptions,
  type AutofixAutomationSettings,
} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {
  useFetchProjectSeerPreferences,
  useUpdateProjectSeerPreferences,
} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import {PROVIDER_TO_HANDOFF_TARGET} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {type CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useAgentOptions({
  integrations,
}: {
  integrations: CodingAgentIntegration[];
}) {
  return useMemo(() => {
    return [
      {value: 'seer' as const, label: t('Seer Agent')},
      ...integrations
        .filter(integration => integration.id)
        .map(integration => ({
          value: integration,
          label: `${integration.name} (${integration.id})`,
        })),
      {value: 'none' as const, label: t('Manual Agent Selection')},
    ];
  }, [integrations]);
}

export function useSelectedAgentFromProjectSettings({
  integrations,
  preference,
  project,
}: {
  integrations: CodingAgentIntegration[];
  preference: ProjectSeerPreferences;
  project: Project;
}) {
  return useMemo(() => {
    // If we have autofixAutomationTuning==OFF then 'none' is picked
    if (project.autofixAutomationTuning === 'off') {
      return 'none';
    }
    // If we have nothing in preferences, then we have Seer
    if (!preference?.automation_handoff?.integration_id) {
      return 'seer';
    }
    // Otherwise, we have a preference!
    return integrations.find(
      integration =>
        integration.id === String(preference.automation_handoff?.integration_id)
    );
  }, [
    preference?.automation_handoff?.integration_id,
    project.autofixAutomationTuning,
    integrations,
  ]);
}

export function useSelectedAgentFromBulkSettings({
  autofixSettings,
  integrations,
}: {
  autofixSettings: AutofixAutomationSettings;
  integrations: CodingAgentIntegration[];
}) {
  return useMemo(() => {
    // If we have autofixAutomationTuning==OFF then 'none' is picked
    if (autofixSettings.autofixAutomationTuning === 'off') {
      return 'none';
    }
    // If we have nothing in preferences, then we have Seer
    if (!autofixSettings?.automationHandoff?.integration_id) {
      return 'seer';
    }
    // Otherwise, we have a preference!
    return integrations.find(
      integration =>
        integration.id === String(autofixSettings.automationHandoff?.integration_id)
    );
  }, [
    autofixSettings.automationHandoff?.integration_id,
    autofixSettings.autofixAutomationTuning,
    integrations,
  ]);
}

type MutateOptions = {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
};

function useApplyOptimisticUpdate({project}: {project: Project}) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const autofixSettingsQueryOptions = bulkAutofixAutomationSettingsInfiniteOptions({
    organization,
  });

  return useCallback(
    (updates: Partial<AutofixAutomationSettings>) => {
      queryClient.setQueryData(autofixSettingsQueryOptions.queryKey, oldData => {
        if (!oldData) {
          return oldData;
        }
        return {
          ...oldData,
          pages: oldData.pages.map(page => ({
            ...page,
            json: page.json.map(setting =>
              String(setting.projectId) === project.id
                ? {...setting, ...updates}
                : setting
            ),
          })),
        };
      });

      if (
        updates.autofixAutomationTuning !== undefined &&
        updates.autofixAutomationTuning !== null
      ) {
        ProjectsStore.onUpdateSuccess({
          id: project.id,
          autofixAutomationTuning: updates.autofixAutomationTuning,
        });
      }
    },
    [queryClient, autofixSettingsQueryOptions.queryKey, project.id]
  );
}

export function useMutateSelectedAgent({project}: {project: Project}) {
  const {mutateAsync: updateProject} = useUpdateProject(project);
  const {mutateAsync: updateProjectSeerPreferences} =
    useUpdateProjectSeerPreferences(project);
  const applyOptimisticUpdate = useApplyOptimisticUpdate({project});
  const fetchPreferences = useFetchProjectSeerPreferences({project});

  return useCallback(
    (
      integration: 'seer' | 'none' | CodingAgentIntegration,
      {onSuccess, onError}: MutateOptions
    ) => {
      if (integration === 'seer' || integration === 'none') {
        const tuning = integration === 'seer' ? 'medium' : 'off';
        applyOptimisticUpdate({
          autofixAutomationTuning: tuning,
          automationHandoff: undefined,
        });

        fetchPreferences()
          .then(preference =>
            Promise.all([
              updateProject({autofixAutomationTuning: tuning}),
              updateProjectSeerPreferences({
                repositories: preference?.repositories ?? [],
                automated_run_stopping_point: preference?.automated_run_stopping_point,
                automation_handoff: undefined,
              }),
            ])
          )
          .then(() => onSuccess?.())
          .catch(() => onError?.(new Error('Failed to update agent setting')));
      } else {
        applyOptimisticUpdate({
          autofixAutomationTuning: 'medium',
        });

        fetchPreferences()
          .then(preference => {
            const handoff: ProjectSeerPreferences['automation_handoff'] = integration
              ? {
                  handoff_point: 'root_cause',
                  target: PROVIDER_TO_HANDOFF_TARGET[integration.provider]!,
                  integration_id: Number(integration.id),
                  auto_create_pr: preference?.automated_run_stopping_point === 'open_pr',
                }
              : undefined;

            applyOptimisticUpdate({
              automationHandoff: handoff,
            });

            return Promise.all([
              updateProject({autofixAutomationTuning: 'medium'}),
              updateProjectSeerPreferences({
                repositories: preference?.repositories ?? [],
                automated_run_stopping_point: preference?.automated_run_stopping_point,
                automation_handoff: handoff,
              }),
            ]);
          })
          .then(() => onSuccess?.())
          .catch(() => onError?.(new Error('Failed to update agent setting')));
      }
    },
    [updateProject, updateProjectSeerPreferences, applyOptimisticUpdate, fetchPreferences]
  );
}

export function useMutateCreatePr({project}: {project: Project}) {
  const {mutateAsync: updateProjectSeerPreferences} =
    useUpdateProjectSeerPreferences(project);
  const applyOptimisticUpdate = useApplyOptimisticUpdate({project});
  const fetchPreferences = useFetchProjectSeerPreferences({project});

  return useCallback(
    (
      autofixAgent: 'seer' | 'none' | CodingAgentIntegration | undefined,
      value: boolean,
      {onSuccess, onError}: MutateOptions
    ) => {
      if (autofixAgent === 'seer') {
        const stoppingPoint = value ? ('open_pr' as const) : ('code_changes' as const);
        applyOptimisticUpdate({automatedRunStoppingPoint: stoppingPoint});
        fetchPreferences()
          .then(preference =>
            updateProjectSeerPreferences({
              repositories: preference?.repositories ?? [],
              automated_run_stopping_point: stoppingPoint,
              automation_handoff: preference?.automation_handoff,
            })
          )
          .then(() => onSuccess?.())
          .catch(() => onError?.(new Error('Failed to update PR setting')));
      } else if (autofixAgent && autofixAgent !== 'none') {
        fetchPreferences()
          .then(preference => {
            const updatedHandoff = {
              handoff_point: 'root_cause' as const,
              integration_id: Number(autofixAgent.id),
              ...preference?.automation_handoff,
              target: PROVIDER_TO_HANDOFF_TARGET[autofixAgent.provider]!,
              auto_create_pr: value,
            };
            applyOptimisticUpdate({automationHandoff: updatedHandoff});
            return updateProjectSeerPreferences({
              repositories: preference?.repositories ?? [],
              automated_run_stopping_point: preference?.automated_run_stopping_point,
              automation_handoff: updatedHandoff,
            });
          })
          .then(() => onSuccess?.())
          .catch(() => onError?.(new Error('Failed to update PR setting')));
      }
    },
    [updateProjectSeerPreferences, applyOptimisticUpdate, fetchPreferences]
  );
}
