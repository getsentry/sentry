import AutomationBuilderNumberField from 'sentry/components/workflowEngine/form/automationBuilderNumberField';
import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
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
    <AutomationBuilderNumberField
      name={`${condition_id}.comparison.value`}
      value={condition.comparison.value}
      min={1}
      step={1}
      onChange={(value: string) => {
        onUpdate({
          value,
        });
      }}
    />
  );
}

function IntervalField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.interval`}
      value={condition.comparison.interval}
      options={INTERVAL_CHOICES}
      onChange={(value: string) => {
        onUpdate({
          interval: value,
        });
      }}
    />
  );
}

function ComparisonIntervalField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.comparison_interval`}
      value={condition.comparison.comparison_interval}
      options={COMPARISON_INTERVAL_CHOICES}
      onChange={(value: string) => {
        onUpdate({
          comparison_interval: value,
        });
      }}
    />
  );
}
