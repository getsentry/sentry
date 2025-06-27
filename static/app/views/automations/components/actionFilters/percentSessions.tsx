import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {
  CountBranch,
  PercentBranch,
} from 'sentry/views/automations/components/actionFilters/comparisonBranches';
import {
  COMPARISON_INTERVAL_CHOICES,
  INTERVAL_CHOICES,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function PercentSessionsCountDetails({condition}: {condition: DataCondition}) {
  return tct(
    'Percentage of sessions affected by an issue is more than [value] [interval]',
    {
      value: condition.comparison.value,
      interval:
        INTERVAL_CHOICES.find(choice => choice.value === condition.comparison.interval)
          ?.label || condition.comparison.interval,
    }
  );
}

export function PercentSessionsPercentDetails({condition}: {condition: DataCondition}) {
  return tct(
    'Percentage of sessions affected by an issue is [value]% higher [interval] compared to [comparison_interval]',
    {
      value: condition.comparison.value,
      interval:
        INTERVAL_CHOICES.find(choice => choice.value === condition.comparison.interval)
          ?.label || condition.comparison.interval,
      comparison_interval:
        COMPARISON_INTERVAL_CHOICES.find(
          choice => choice.value === condition.comparison.comparison_interval
        )?.label || condition.comparison.comparison_interval,
    }
  );
}

export function PercentSessionsNode() {
  return tct('Percentage of sessions affected by an issue is [select]', {
    select: <ComparisonTypeField />,
  });
}

function ComparisonTypeField() {
  const {condition, condition_id, onUpdateType} = useDataConditionNodeContext();

  if (condition.type === DataConditionType.PERCENT_SESSIONS_COUNT) {
    return <CountBranch />;
  }
  if (condition.type === DataConditionType.PERCENT_SESSIONS_PERCENT) {
    return <PercentBranch />;
  }

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.type`}
      value={condition.type}
      options={[
        {
          label: 'more than...',
          value: DataConditionType.PERCENT_SESSIONS_COUNT,
        },
        {
          label: 'relatively higher than...',
          value: DataConditionType.PERCENT_SESSIONS_PERCENT,
        },
      ]}
      onChange={(option: SelectValue<DataConditionType>) => {
        onUpdateType(option.value);
      }}
    />
  );
}
