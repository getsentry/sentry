import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {
  CountBranch,
  PercentBranch,
} from 'sentry/views/automations/components/actionFilters/comparisonBranches';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export default function EventUniqueUserFrequencyNode() {
  return tct('Number of users affected by an issue is [select]', {
    select: <ComparisonTypeField />,
  });
}

function ComparisonTypeField() {
  const {condition, condition_id, onUpdateType} = useDataConditionNodeContext();

  if (condition.comparison_type === DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT) {
    return <CountBranch />;
  }
  if (
    condition.comparison_type === DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT
  ) {
    return <PercentBranch />;
  }

  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison_type`}
      value={condition.comparison_type}
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
