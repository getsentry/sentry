import {useCallback} from 'react';

import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

import useSeerSettingsFormModel from 'getsentry/views/seerAutomation/components/projectDetails/useSeerSettingsFormModel';

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
}

export default function ProjectDetailsForm({canWrite, project, preference}: Props) {
  const {mutate: updateProject} = useUpdateProject(project);
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  const formModel = useSeerSettingsFormModel({
    updateProject: useCallback(
      data =>
        new Promise<void>((resolve, reject) =>
          updateProject(data, {onSuccess: () => resolve(), onError: reject})
        ),
      [updateProject]
    ),
    updateProjectSeerPreferences: useCallback(
      data =>
        new Promise<void>((resolve, reject) =>
          updateProjectSeerPreferences(
            {...preference, ...data},
            {onSuccess: () => resolve(), onError: reject}
          )
        ),
      [preference, updateProjectSeerPreferences]
    ),
  });

  return (
    <Form
      saveOnBlur
      allowUndo
      model={formModel}
      initialData={{
        autofixAutomationTuning: project.autofixAutomationTuning,
        automated_run_stopping_point: preference?.automated_run_stopping_point,
        automation_handoff: preference?.automation_handoff,
      }}
    >
      <JsonForm
        disabled={!canWrite}
        forms={[
          {
            title: t('AI Code Review'),
            fields: [
              {
                name: 'autofixAutomationTuning',
                label: t('Auto-Triggered Fixes'),
                help: t(
                  'Seer will automatically analyze highly actionable issues, and create a root cause analysis and proposed solution without a user needing to prompt it.'
                ),
                type: 'boolean',
                setValue: (value: Project['autofixAutomationTuning']): boolean =>
                  Boolean(value && value !== 'off'),
                getValue: (value: boolean): Project['autofixAutomationTuning'] =>
                  value ? 'medium' : 'off',
              },
              {
                name: 'automated_run_stopping_point',
                label: t('Allow PR Creation'),
                help: t(
                  'Seer will be able to make a pull requests for highly actionable issues.'
                ),
                type: 'boolean',
                setValue: (
                  value: ProjectSeerPreferences['automated_run_stopping_point']
                ): boolean => Boolean(value && value !== 'code_changes'),
                getValue: (
                  value: boolean
                ): ProjectSeerPreferences['automated_run_stopping_point'] =>
                  value ? 'open_pr' : 'code_changes',
                disabled: () => Boolean(preference?.automation_handoff),
                disabledReason: () => {
                  if (preference?.automation_handoff) {
                    return t(
                      'This setting is not available when using background agents.'
                    );
                  }
                  return null;
                },
              },
            ],
          },
        ]}
      />
    </Form>
  );
}
