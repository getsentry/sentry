import {AutomationBuilderNumberInput} from 'sentry/components/workflowEngine/form/automationBuilderNumberInput';
import {tct} from 'sentry/locale';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
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
  return (
    <AutomationBuilderNumberInput
      name={`${condition_id}.comparison.value`}
      value={condition.comparison.value}
      min={1}
      step={1}
      onChange={(value: number) => {
        onUpdate({comparison: {...condition.comparison, value}});
      }}
    />
  );
}
