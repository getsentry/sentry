import AutomationBuilderNumberField from 'sentry/components/workflowEngine/form/automationBuilderNumberField';
import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  AGE_COMPARISON_CHOICES,
  type AgeComparison,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

enum TimeUnit {
  MINUTES = 'minute',
  HOURS = 'hour',
  DAYS = 'day',
  WEEKS = 'week',
}

const TIME_CHOICES = [
  {value: TimeUnit.MINUTES, label: 'minute(s)'},
  {value: TimeUnit.HOURS, label: 'hour(s)'},
  {value: TimeUnit.DAYS, label: 'day(s)'},
  {value: TimeUnit.WEEKS, label: 'week(s)'},
];

interface AgeComparisonDetailsProps {
  condition: DataCondition;
}

export function AgeComparisonDetails({condition}: AgeComparisonDetailsProps) {
  return tct('The issue is [comparisonType] [value] [time]', {
    comparisonType:
      AGE_COMPARISON_CHOICES.find(
        choice => choice.value === condition.comparison.comparison_type
      )?.label || condition.comparison.comparison_type,
    value: condition.comparison.value,
    time:
      TIME_CHOICES.find(choice => choice.value[0] === condition.comparison.time)?.label ||
      condition.comparison.time,
  });
}

export function AgeComparisonNode() {
  return tct('The issue is [comparisonType] [value] [time]', {
    comparisonType: <ComparisonField />,
    value: <ValueField />,
    time: <TimeField />,
  });
}

function ComparisonField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.comparison_type`}
      value={condition.comparison.comparison_type}
      options={AGE_COMPARISON_CHOICES}
      onChange={(value: AgeComparison) => {
        onUpdate({
          comparison_type: value,
        });
      }}
    />
  );
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderNumberField
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
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.time`}
      value={condition.comparison.time}
      options={TIME_CHOICES}
      onChange={(value: string) => {
        onUpdate({
          time: value,
        });
      }}
    />
  );
}
