import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  type Priority,
  PRIORITY_CHOICES,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function IssuePriorityDetails({condition}: {condition: DataCondition}) {
  return tct('Current issue priority is [level]', {
    level:
      PRIORITY_CHOICES.find(choice => choice.value === condition.comparison.level)
        ?.label || condition.comparison.level,
  });
}

export function IssuePriorityNode() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return tct('Current issue priority is [level]', {
    level: (
      <AutomationBuilderSelectField
        name={`${condition_id}.comparison`}
        value={condition.comparison.match}
        options={PRIORITY_CHOICES}
        onChange={(value: Priority) => {
          onUpdate({
            match: value,
          });
        }}
      />
    ),
  });
}
