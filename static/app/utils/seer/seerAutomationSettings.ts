import type {AutofixAutomationSettings} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

export type AutomationStep = 'off' | 'root-cause' | 'code' | 'create-pr';

export const AUTOMATION_STEP_OPTIONS: Array<{label: string; value: AutomationStep}> = [
  {value: 'off', label: t('Off')},
  {value: 'root-cause', label: t('Root Cause Analysis')},
  {value: 'code', label: t('Write Code Changes')},
  {value: 'create-pr', label: t('Create Pull Request')},
];

export function getAutomationStepFromPreferences(
  project: Project,
  preference: ProjectSeerPreferences
): AutomationStep {
  if ([null, undefined, 'off'].includes(project.autofixAutomationTuning)) {
    return 'off';
  }
  if (preference.automated_run_stopping_point === 'root_cause') {
    return 'root-cause';
  }
  if (preference.automated_run_stopping_point === 'open_pr') {
    return 'create-pr';
  }
  if (preference.automation_handoff?.auto_create_pr) {
    return 'create-pr';
  }
  return 'code';
}

export function getAutomationStepFromBulkSettings(
  autofixSettings: AutofixAutomationSettings
): AutomationStep {
  if (
    [null, undefined, 'off'].includes(
      autofixSettings.autofixAutomationTuning as string | null | undefined
    )
  ) {
    return 'off';
  }
  if (autofixSettings.automatedRunStoppingPoint === 'root_cause') {
    return 'root-cause';
  }
  if (autofixSettings.automatedRunStoppingPoint === 'open_pr') {
    return 'create-pr';
  }
  if (autofixSettings.automationHandoff?.auto_create_pr) {
    return 'create-pr';
  }
  return 'code';
}
