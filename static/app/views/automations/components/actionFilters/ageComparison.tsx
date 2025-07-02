import {AutomationBuilderNumberInput} from 'sentry/components/workflowEngine/form/automationBuilderNumberInput';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import type {AgeComparison} from 'sentry/views/automations/components/actionFilters/constants';
import {
  AGE_COMPARISON_CHOICES,
  TimeUnit,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

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
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.comparison_type`}
      aria-label={t('Comparison')}
      value={condition.comparison.comparison_type}
      options={AGE_COMPARISON_CHOICES}
      onChange={(option: SelectValue<AgeComparison>) => {
        onUpdate({comparison: {...condition.comparison, comparison_type: option.value}});
      }}
    />
  );
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderNumberInput
      name={`${condition_id}.comparison.value`}
      aria-label={t('Value')}
      value={condition.comparison.value}
      min={0}
      step={1}
      onChange={(value: number) => {
        onUpdate({comparison: {...condition.comparison, value}});
      }}
      placeholder={'10'}
    />
  );
}

function TimeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.time`}
      aria-label={t('Time unit')}
      value={condition.comparison.time}
      options={TIME_CHOICES}
      onChange={(option: SelectValue<TimeUnit>) => {
        onUpdate({comparison: {...condition.comparison, time: option.value}});
      }}
    />
  );
}
