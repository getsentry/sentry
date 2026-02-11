import styled from '@emotion/styled';

import {AutomationBuilderNumberInput} from 'sentry/components/workflowEngine/form/automationBuilderNumberInput';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {
  COMPARISON_INTERVAL_CHOICES,
  INTERVAL_CHOICES,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function CountBranch() {
  return tct('more than [value] [interval]', {
    value: <ValueField />,
    interval: <IntervalField />,
  });
}

export function PercentBranch() {
  return tct('[value] higher [interval] compared to [comparison_interval]', {
    value: <PercentValueField />,
    interval: <IntervalField />,
    comparison_interval: <ComparisonIntervalField />,
  });
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderNumberInput
      name={`${condition_id}.comparison.value`}
      aria-label={t('Value')}
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

function PercentValueField() {
  return (
    <PercentWrapper>
      <ValueField />%
    </PercentWrapper>
  );
}

function IntervalField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.interval`}
      aria-label={t('Interval')}
      value={condition.comparison.interval}
      options={INTERVAL_CHOICES}
      onChange={(option: SelectValue<string>) => {
        onUpdate({comparison: {...condition.comparison, interval: option.value}});
        removeError(condition.id);
      }}
    />
  );
}

function ComparisonIntervalField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.comparisonInterval`}
      aria-label={t('Comparison interval')}
      value={condition.comparison.comparisonInterval}
      options={COMPARISON_INTERVAL_CHOICES}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          comparison: {...condition.comparison, comparisonInterval: option.value},
        });
        removeError(condition.id);
      }}
    />
  );
}

const PercentWrapper = styled('div')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;
