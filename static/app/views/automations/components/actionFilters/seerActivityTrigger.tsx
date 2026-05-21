import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
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
  const labels = stages
    .map(s => SEER_ACTIVITY_STAGE_CHOICES.find(c => c.value === s)?.label)
    .filter(Boolean);
  if (labels.length === 1) {
    return <span>{t("Seer reaches the '%s' stage", labels[0])}</span>;
  }
  return <span>{t('Seer reaches any of these stages: %s', labels.join(', '))}</span>;
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
