import InlineNumberField from 'sentry/components/workflowEngine/form/inlineNumberField';
import InlineSelectField from 'sentry/components/workflowEngine/form/inlineSelectField';
import {tct} from 'sentry/locale';
import {
  AGE_COMPARISON_CHOICES,
  type AgeComparison,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export default function AgeComparisonNode() {
  return tct('The issue is [comparisonType] [value] [time]', {
    comparisonType: <ComparisonField />,
    value: <ValueField />,
    time: <TimeField />,
  });
}

function ComparisonField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <InlineSelectField
      name={`${condition_id}.comparison.type`}
      value={condition.comparison.type}
      options={AGE_COMPARISON_CHOICES}
      onChange={(value: AgeComparison) => {
        onUpdate({
          type: value,
        });
      }}
    />
  );
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <InlineNumberField
      name={`${condition_id}.comparison.value`}
      value={condition.comparison.value}
      min={0}
      step={1}
      onChange={(value: string) => {
        onUpdate({
          value: parseInt(value, 10),
        });
      }}
    />
  );
}

function TimeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <InlineSelectField
      name={`${condition_id}.comparison.time`}
      value={condition.comparison.time}
      options={[
        {value: 'minutes', label: 'minute(s)'},
        {value: 'hours', label: 'hour(s)'},
        {value: 'days', label: 'day(s)'},
      ]}
      onChange={(value: string) => {
        onUpdate({
          time: value,
        });
      }}
    />
  );
}
