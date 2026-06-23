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
}

export function CountBranch({
  intervalChoices = INTERVAL_CHOICES,
  maximumFractionDigits,
}: BranchProps & {maximumFractionDigits?: number}) {
  return tct('more than [value] [interval]', {
    value: <ValueField maximumFractionDigits={maximumFractionDigits} />,
    interval: <IntervalField intervalChoices={intervalChoices} />,
  });
}

export function PercentBranch({intervalChoices = INTERVAL_CHOICES}: BranchProps) {
  return tct('[value] higher [interval] compared to [comparison_interval]', {
    value: <PercentValueField />,
    interval: <IntervalField intervalChoices={intervalChoices} />,
    comparison_interval: <ComparisonIntervalField />,
  });
}

// Integer count input by default (min 0, stepping by 1). When
// maximumFractionDigits is set, the input also accepts decimals: typed values
// are preserved and rounded to that precision on blur, while the stepper buttons
// still move by whole units. Used by percent-sessions count, where fractional
// percentages are meaningful.
function ValueField({maximumFractionDigits}: {maximumFractionDigits?: number}) {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderNumberInput
      name={`${condition_id}.comparison.value`}
      aria-label={t('Value')}
      value={condition.comparison.value}
      // Omitting `step` keeps typed decimals intact on blur — react-aria only
      // snaps to a step grid when `step` is defined. The buttons still fall back
      // to stepping by 1.
      {...(maximumFractionDigits === undefined
        ? {step: 1}
        : {formatOptions: {maximumFractionDigits}})}
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
