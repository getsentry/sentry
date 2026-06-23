import styled from '@emotion/styled';

import type {SelectValue} from '@sentry/scraps/select';

import {AutomationBuilderNumberInput} from 'sentry/components/workflowEngine/form/automationBuilderNumberInput';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import {
  COMPARISON_INTERVAL_CHOICES,
  INTERVAL_CHOICES,
  Interval,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

type IntervalChoice = {label: string; value: Interval};

interface BranchProps {
  intervalChoices?: IntervalChoice[];
  // Minimum allowed comparison value. Defaults to 0, which lets users alert on
  // "more than 0" (i.e. 1 or more). Percent-sessions passes 1 since its
  // validator treats 0 as missing.
  minValue?: number;
}

export function CountBranch({
  intervalChoices = INTERVAL_CHOICES,
  minValue = 0,
}: BranchProps) {
  return tct('more than [value] [interval]', {
    value: <ValueField minValue={minValue} />,
    interval: <IntervalField intervalChoices={intervalChoices} />,
  });
}

export function PercentBranch({
  intervalChoices = INTERVAL_CHOICES,
  minValue = 0,
}: BranchProps) {
  return tct('[value] higher [interval] compared to [comparison_interval]', {
    value: <PercentValueField minValue={minValue} />,
    interval: <IntervalField intervalChoices={intervalChoices} />,
    comparison_interval: <ComparisonIntervalField />,
  });
}

function ValueField({minValue = 0}: {minValue?: number}) {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderNumberInput
      name={`${condition_id}.comparison.value`}
      aria-label={t('Value')}
      value={condition.comparison.value}
      min={minValue}
      step={1}
      onChange={(value: number) => {
        onUpdate({comparison: {...condition.comparison, value}});
        removeError(condition.id);
      }}
    />
  );
}

function PercentValueField({minValue = 0}: {minValue?: number}) {
  return (
    <PercentWrapper>
      <ValueField minValue={minValue} />%
    </PercentWrapper>
  );
}

function IntervalField({
  intervalChoices = INTERVAL_CHOICES,
}: {
  intervalChoices?: IntervalChoice[];
}) {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.interval`}
      aria-label={t('Interval')}
      value={condition.comparison.interval}
      options={intervalChoices}
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
