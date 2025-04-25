import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import {
  type Priority,
  PRIORITY_CHOICES,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export default function IssuePriorityNode() {
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
