import {Flex} from '@sentry/scraps/layout';
import type {SelectValue} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {ValidateDataConditionProps} from 'sentry/views/automations/components/automationFormData';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

const SEER_ACTIVITY_STAGE_CHOICES: Array<{label: string; value: string}> = [
  {value: 'rca_started', label: t('Root cause analysis started')},
  {value: 'rca_completed', label: t('Root cause analysis completed')},
  {value: 'solution_started', label: t('Solution search started')},
  {value: 'solution_completed', label: t('Solution search completed')},
  {value: 'coding_started', label: t('Coding started')},
  {value: 'coding_completed', label: t('Coding completed')},
  {value: 'pr_created', label: t('Pull request created')},
];

export function SeerActivityTriggerDetails({condition}: {condition: DataCondition}) {
  const stages: string[] = Array.isArray(condition.comparison)
    ? condition.comparison
    : [];
  // The stages should all appear in SEER_ACTIVITY_STAGE_CHOICES, but for type safety we call
  // call .filter(Boolean) to get rid of invalid stages when we render.
  const labels = stages
    .map(s => SEER_ACTIVITY_STAGE_CHOICES.find(c => c.value === s)?.label)
    .filter(Boolean);
  const details =
    labels.length === 1
      ? tct("Seer reaches the '[stage]' stage", {stage: labels[0] ?? ''})
      : tct('Seer reaches any of these stages: [stages]', {stages: labels.join(', ')});

  return <span>{details}</span>;
}

export function SeerActivityTriggerNode() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();
  const value: string[] = Array.isArray(condition.comparison) ? condition.comparison : [];

  return (
    <Flex direction="column" gap="sm">
      <Text>{t('Seer runs on an issue and reaches the stage...')}</Text>
      <AutomationBuilderSelect
        multiple
        name={`${condition_id}.comparison`}
        aria-label={t('Seer activity stages')}
        placeholder={t('Select a stage...')}
        value={value}
        options={SEER_ACTIVITY_STAGE_CHOICES}
        onChange={(options: Array<SelectValue<string>>) => {
          onUpdate({comparison: options.map(o => o.value)});
          removeError(condition.id);
        }}
      />
    </Flex>
  );
}

export function validateSeerActivityTriggerCondition({
  condition,
}: ValidateDataConditionProps): string | undefined {
  if (!Array.isArray(condition.comparison) || condition.comparison.length === 0) {
    return t('You must select at least one Seer stage.');
  }
  return undefined;
}
