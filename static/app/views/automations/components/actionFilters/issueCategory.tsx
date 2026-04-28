import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {ValidateDataConditionProps} from 'sentry/views/automations/components/automationFormData';
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

const INCLUDE_CHOICES = [
  {value: true, label: t('equal to')},
  {value: false, label: t('not equal to')},
];

export function IssueCategoryDetails({condition}: {condition: DataCondition}) {
  const include = condition.comparison.include ?? true;
  const includeLabel =
    INCLUDE_CHOICES.find(choice => choice.value === include)?.label ?? '';
  return tct('Issue category is [include] [category]', {
    include: includeLabel,
    category:
      GROUP_CATEGORY_CHOICES.find(choice => choice.value === condition.comparison.value)
        ?.label || condition.comparison.value,
  });
}

export function IssueCategoryNode() {
  return tct('Issue category is [include] [category]', {
    include: <IncludeField />,
    category: <CategoryField />,
  });
}

function IncludeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.include`}
      aria-label={t('Include or exclude')}
      value={condition.comparison.include ?? true}
      options={INCLUDE_CHOICES}
      onChange={(option: SelectValue<boolean>) => {
        onUpdate({comparison: {...condition.comparison, include: option.value}});
        removeError(condition.id);
      }}
    />
  );
}

function CategoryField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.value`}
      aria-label={t('Issue category')}
      value={condition.comparison.value}
      options={GROUP_CATEGORY_CHOICES}
      onChange={(option: SelectValue<GroupCategory>) => {
        onUpdate({comparison: {...condition.comparison, value: option.value}});
        removeError(condition.id);
      }}
    />
  );
}

export function validateIssueCategoryCondition({
  condition,
}: ValidateDataConditionProps): string | undefined {
  if (!condition.comparison.value) {
    return t('You must select an issue category.');
  }
  return undefined;
}
