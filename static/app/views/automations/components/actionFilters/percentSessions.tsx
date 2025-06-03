import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {
  CountBranch,
  PercentBranch,
} from 'sentry/views/automations/components/actionFilters/comparisonBranches';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export default function PercentSessionsNode() {
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
    <AutomationBuilderSelectField
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
      onChange={(value: DataConditionType) => {
        onUpdateType(value);
      }}
    />
  );
}
