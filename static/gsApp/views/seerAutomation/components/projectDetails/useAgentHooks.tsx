import {useCallback, useMemo} from 'react';

import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {type CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

export function useAgentOptions({
  integrations,
}: {
  integrations: CodingAgentIntegration[];
}) {
  return useMemo(() => {
    return [
      {value: 'seer', label: t('Seer Agent')},
      ...integrations
        .filter(integration => integration.id)
        .map(integration => ({
          value: integration,
          label: `${integration.name} (${integration.id})`,
        })),
      {value: 'none', label: t('Manual Agent Selection')},
    ];
  }, [integrations]);
}

export function useSelectedAgent({
  preference,
  project,
  integrations,
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

type MutateOptions = {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
};

export function useMutateSelectedAgent({
  preference,
  project,
}: {
  preference: ProjectSeerPreferences;
  project: Project;
}) {
  const {mutateAsync: updateProject} = useUpdateProject(project);
  const {mutateAsync: updateProjectSeerPreferences} =
    useUpdateProjectSeerPreferences(project);

  return useCallback(
    (
      integration: 'seer' | 'none' | CodingAgentIntegration,
      {onSuccess, onError}: MutateOptions
    ) => {
      if (integration === 'seer' || integration === 'none') {
        // When we're picking Seer Agent:
        // - Set the `autofixAutomationTuning` to medium
        // When we're disabling agents:
        // - Set the `autofixAutomationTuning` to off
        //
        // In either case, we're leaving the existing `automated_run_stopping_point`
        // value alone, and previously picked `integration_id` value.
        Promise.all([
          updateProject({
            autofixAutomationTuning: integration === 'seer' ? 'medium' : 'off',
          }),
          updateProjectSeerPreferences({
            repositories: preference?.repositories || [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: undefined,
          }),
        ])
          .then(() => onSuccess?.())
          .catch(() => onError?.(new Error('Failed to update agent setting')));
      } else {
        // Ensure autofixAutomationTuning is set to medium
        // Set the `integration_id` to the new integration
        // Re-use previous `automated_run_stopping_point` value
        Promise.all([
          updateProject({autofixAutomationTuning: 'medium'}),
          updateProjectSeerPreferences({
            repositories: preference?.repositories || [],
            automated_run_stopping_point: preference?.automated_run_stopping_point,
            automation_handoff: integration
              ? {
                  handoff_point: 'root_cause',
                  target: 'cursor_background_agent',
                  integration_id: Number(integration.id),
                  auto_create_pr: preference?.automated_run_stopping_point === 'open_pr',
                }
              : undefined,
          }),
        ])
          .then(() => onSuccess?.())
          .catch(() => onError?.(new Error('Failed to update agent setting')));
      }
    },
    [preference, updateProject, updateProjectSeerPreferences]
  );
}
