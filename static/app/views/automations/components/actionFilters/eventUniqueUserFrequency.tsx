import {RowLine} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {t, tct} from 'sentry/locale';
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
import {
  SubfilterDetailsList,
  SubfiltersList,
  validateSubfilters,
} from 'sentry/views/automations/components/actionFilters/subfiltersList';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {
  dataConditionNodesMap,
  useDataConditionNodeContext,
} from 'sentry/views/automations/components/dataConditionNodes';

export function EventUniqueUserFrequencyCountDetails({
  condition,
}: {
  condition: DataCondition;
}) {
  const hasSubfilters = condition.comparison.filters?.length > 0;
  return (
    <div>
      {tct(
        'Number of users affected by an issue is more than [value] [interval] [where]',
        {
          value: condition.comparison.value,
          interval:
            INTERVAL_CHOICES.find(
              choice => choice.value === condition.comparison.interval
            )?.label || condition.comparison.interval,
          where: hasSubfilters ? t('where') : null,
        }
      )}
      {hasSubfilters && (
        <SubfilterDetailsList subfilters={condition.comparison.filters} />
      )}
    </div>
  );
}

export function EventUniqueUserFrequencyPercentDetails({
  condition,
}: {
  condition: DataCondition;
}) {
  const hasSubfilters = condition.comparison.filters?.length > 0;
  return (
    <div>
      {tct(
        'Number of users affected by an issue is [value]% higher [interval] compared to [comparison_interval] [where]',
        {
          value: condition.comparison.value,
          interval:
            INTERVAL_CHOICES.find(
              choice => choice.value === condition.comparison.interval
            )?.label || condition.comparison.interval,
          comparison_interval:
            COMPARISON_INTERVAL_CHOICES.find(
              choice => choice.value === condition.comparison.comparison_interval
            )?.label || condition.comparison.comparison_interval,
          where: hasSubfilters ? t('where') : null,
        }
      )}
      {hasSubfilters && (
        <SubfilterDetailsList subfilters={condition.comparison.filters} />
      )}
    </div>
  );
}

export function EventUniqueUserFrequencyNode() {
  const {condition} = useDataConditionNodeContext();
  const hasSubfilters = condition.comparison.filters?.length > 0;

  return (
    <div>
      <RowLine>
        {tct('Number of users affected by an issue is [select] [where]', {
          select: <ComparisonTypeField />,
          where: hasSubfilters ? <ConditionBadge>{t('Where')}</ConditionBadge> : null,
        })}
      </RowLine>
      <SubfiltersList />
    </div>
  );
}

function ComparisonTypeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  if (condition.type === DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT) {
    return <CountBranch />;
  }
  if (condition.type === DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT) {
    return <PercentBranch />;
  }

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.type`}
      aria-label={t('Comparison type')}
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
      onChange={(option: SelectValue<DataConditionType>) => {
        onUpdate({
          type: option.value,
          comparison: {
            ...condition.comparison,
            ...dataConditionNodesMap.get(option.value)?.defaultComparison,
          },
        });
        removeError(condition.id);
      }}
    />
  );
}

export function validateEventUniqueUserFrequencyCondition(
  condition: DataCondition
): string | undefined {
  if (condition.type === DataConditionType.EVENT_UNIQUE_USER_FREQUENCY) {
    return t('You must select a comparison type.');
  }
  if (
    !condition.comparison.value ||
    !condition.comparison.interval ||
    (condition.type === DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT &&
      !condition.comparison.comparison_interval)
  ) {
    return t('Ensure all fields are filled in.');
  }
  if (condition.comparison.filters) {
    return validateSubfilters(condition.comparison.filters);
  }
  return undefined;
}
