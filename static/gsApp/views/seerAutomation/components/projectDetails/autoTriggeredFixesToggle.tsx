import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

interface Props {
  canWrite: boolean;
  project: Project;
}

/**
 * Master toggle for auto-triggered fixes.
 * This should be placed at the top of the unified settings container.
 */
export default function AutoTriggeredFixesToggle({canWrite, project}: Props) {
  const {mutate: updateProject} = useUpdateProject(project);

  const isAutoFixEnabled = Boolean(
    project.autofixAutomationTuning && project.autofixAutomationTuning !== 'off'
  );

  return (
    <BooleanField
      disabled={!canWrite}
      name="autofixAutomationTuning"
      label={t('Auto-Triggered Fixes')}
      help={t(
        'Automatically analyze highly actionable issues, and create a root cause analysis without a user needing to prompt it.'
      )}
      value={isAutoFixEnabled}
      onChange={value => {
        updateProject(
          {autofixAutomationTuning: value ? 'medium' : 'off'},
          {
            onSuccess: () =>
              addSuccessMessage(
                value
                  ? t('Enabled auto-triggered fixes')
                  : t('Disabled auto-triggered fixes')
              ),
            onError: () =>
              addErrorMessage(t('Failed to update auto-triggered fixes setting')),
          }
        );
      }}
    />
  );
}
