import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

enum GroupCategory {
  ERROR = 1,
  FEEDBACK = 6,
  OUTAGE = 10,
  METRIC = 11,
  DB_QUERY = 12,
  HTTP_CLIENT = 13,
  FRONTEND = 14,
  MOBILE = 15,
}

const GROUP_CATEGORY_CHOICES = [
  {value: GroupCategory.ERROR, label: 'error'},
  {value: GroupCategory.FEEDBACK, label: 'feedback'},
  {value: GroupCategory.OUTAGE, label: 'outage'},
  {value: GroupCategory.METRIC, label: 'metric'},
  {value: GroupCategory.DB_QUERY, label: 'db_query'},
  {value: GroupCategory.HTTP_CLIENT, label: 'http_client'},
  {value: GroupCategory.FRONTEND, label: 'frontend'},
  {value: GroupCategory.MOBILE, label: 'mobile'},
];

export function IssueCategoryDetails({condition}: {condition: DataCondition}) {
  return tct('Issue category is equal to [category]', {
    category:
      GROUP_CATEGORY_CHOICES.find(choice => choice.value === condition.comparison.value)
        ?.label || condition.comparison.value,
  });
}

export function IssueCategoryNode() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return tct('Issue category is equal to [category]', {
    category: (
      <AutomationBuilderSelect
        name={`${condition_id}.comparison.value`}
        value={condition.comparison.value}
        options={GROUP_CATEGORY_CHOICES}
        onChange={(option: SelectValue<GroupCategory>) => {
          onUpdate({comparison: {value: option.value}});
        }}
      />
    ),
  });
}
