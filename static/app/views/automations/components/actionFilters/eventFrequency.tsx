import {RowLine} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {t, tct} from 'sentry/locale';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {
  CountBranch,
  PercentBranch,
} from 'sentry/views/automations/components/actionFilters/comparisonBranches';
import {SubfiltersList} from 'sentry/views/automations/components/actionFilters/subfiltersList';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export default function EventFrequencyNode() {
  const {condition} = useDataConditionNodeContext();
  const hasSubfilters = condition.comparison.filters?.length > 0;

  return (
    <div>
      <RowLine>
        {tct('Number of events in an issue is [select] [where]', {
          select: <ComparisonTypeField />,
          where: hasSubfilters ? <ConditionBadge>{t('Where')}</ConditionBadge> : null,
        })}
      </RowLine>
      <SubfiltersList />
    </div>
  );
}

function ComparisonTypeField() {
  const {condition, condition_id, onUpdateType} = useDataConditionNodeContext();

  if (condition.type === DataConditionType.EVENT_FREQUENCY_COUNT) {
    return <CountBranch />;
  }
  if (condition.type === DataConditionType.EVENT_FREQUENCY_PERCENT) {
    return <PercentBranch />;
  }

  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.type`}
      value={condition.type}
      options={[
        {
          label: 'more than...',
          value: DataConditionType.EVENT_FREQUENCY_COUNT,
        },
        {
          label: 'relatively higher than...',
          value: DataConditionType.EVENT_FREQUENCY_PERCENT,
        },
      ]}
      onChange={(value: DataConditionType) => {
        onUpdateType(value);
      }}
    />
  );
}
