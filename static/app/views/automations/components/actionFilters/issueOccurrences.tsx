import {AutomationBuilderNumberInput} from 'sentry/components/workflowEngine/form/automationBuilderNumberInput';
import {t, tct} from 'sentry/locale';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {ValidateDataConditionProps} from 'sentry/views/automations/components/automationFormData';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function IssueOccurrencesDetails({condition}: {condition: DataCondition}) {
  return tct('The issue has happened at least [value] times', {
    value: condition.comparison.value,
  });
}

export function IssueOccurrencesNode() {
  return tct('The issue has happened at least [value] times', {
    value: <ValueField />,
  });
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderNumberInput
      name={`${condition_id}.comparison.value`}
      aria-label={t('Count')}
      value={condition.comparison.value}
      min={1}
      step={1}
      onChange={(value: number) => {
        onUpdate({comparison: {...condition.comparison, value}});
        removeError(condition.id);
      }}
    />
  );
}

export function validateIssueOccurrencesCondition({
  condition,
}: ValidateDataConditionProps): string | undefined {
  if (!condition.comparison.value) {
    return t('You must specify a value.');
  }
  return undefined;
}
