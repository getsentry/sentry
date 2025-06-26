import {AutomationBuilderNumberInput} from 'sentry/components/workflowEngine/form/automationBuilderNumberInput';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {
  COMPARISON_INTERVAL_CHOICES,
  INTERVAL_CHOICES,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function CountBranch() {
  return tct('more than [value] [interval]', {
    value: <ValueField />,
    interval: <IntervalField />,
  });
}

export function PercentBranch() {
  return tct('[value] higher [interval] compared to [comparison_interval]', {
    value: <ValueField />,
    interval: <IntervalField />,
    comparison_interval: <ComparisonIntervalField />,
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
        onUpdate({
          value,
        });
      }}
      placeholder="100"
    />
  );
}

function IntervalField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.interval`}
      value={condition.comparison.interval}
      options={INTERVAL_CHOICES}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          interval: option.value,
        });
      }}
    />
  );
}

function ComparisonIntervalField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.comparison_interval`}
      value={condition.comparison.comparison_interval}
      options={COMPARISON_INTERVAL_CHOICES}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          comparison_interval: option.value,
        });
      }}
    />
  );
}
