import type {SelectValue} from '@sentry/scraps/select';

import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import {
  ISSUE_CATEGORY_TO_GROUP_CATEGORY,
  VALID_ISSUE_CATEGORIES,
} from 'sentry/types/group';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {ValidateDataConditionProps} from 'sentry/views/automations/components/automationFormData';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

const GROUP_CATEGORY_CHOICES = VALID_ISSUE_CATEGORIES.map(issueCategory => ({
  value: ISSUE_CATEGORY_TO_GROUP_CATEGORY[issueCategory],
  label: issueCategory,
}));

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
      onChange={(option: SelectValue<number>) => {
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
