import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
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

export function EventUniqueUserFrequencyCountDetails({
  condition,
}: {
  condition: DataCondition;
}) {
  return tct('Number of users affected by an issue is more than [value] [interval]', {
    value: condition.comparison.value,
    interval:
      INTERVAL_CHOICES.find(choice => choice.value === condition.comparison.interval)
        ?.label || condition.comparison.interval,
  });
}

export function EventUniqueUserFrequencyPercentDetails({
  condition,
}: {
  condition: DataCondition;
}) {
  return tct(
    'Number of users affected by an issue is [value]% higher [interval] compared to [comparison_interval]',
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

export default function EventUniqueUserFrequencyNode() {
  return tct('Number of users affected by an issue is [select]', {
    select: <ComparisonTypeField />,
  });
}

function ComparisonTypeField() {
  const {condition, condition_id, onUpdateType} = useDataConditionNodeContext();

  if (condition.type === DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT) {
    return <CountBranch />;
  }
  if (condition.type === DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT) {
    return <PercentBranch />;
  }

  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.type`}
      value={condition.type}
      options={[
        {
          label: 'more than...',
          value: DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
        },
        {
          label: 'relatively higher than...',
          value: DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
        },
      ]}
      onChange={(value: DataConditionType) => {
        onUpdateType(value);
      }}
    />
  );
}
