import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {getIssueTitleFromType, VISIBLE_ISSUE_TYPES} from 'sentry/types/group';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {ValidateDataConditionProps} from 'sentry/views/automations/components/automationFormData';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

const INCLUDE_CHOICES = [
  {value: true, label: t('equal to')},
  {value: false, label: t('not equal to')},
];

type IssueTypeChoice = {
  label: string;
  value: string;
};

const ISSUE_TYPE_CHOICES: IssueTypeChoice[] = VISIBLE_ISSUE_TYPES.map(value => ({
  value,
  label: getIssueTitleFromType(value) ?? value,
}));

export function IssueTypeDetails({condition}: {condition: DataCondition}) {
  const include = condition.comparison.include ?? true;
  const includeLabel =
    INCLUDE_CHOICES.find(choice => choice.value === include)?.label ?? '';

  return tct('Issue type is [include] [type]', {
    include: includeLabel,
    type:
      ISSUE_TYPE_CHOICES.find(choice => choice.value === condition.comparison.value)
        ?.label || condition.comparison.value,
  });
}

export function IssueTypeNode() {
  return tct('Issue type is [include] [type]', {
    include: <IncludeField />,
    type: <TypeField />,
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

function TypeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.value`}
      aria-label={t('Issue type')}
      value={condition.comparison.value}
      options={ISSUE_TYPE_CHOICES}
      onChange={(option: SelectValue<string>) => {
        onUpdate({comparison: {...condition.comparison, value: option.value}});
        removeError(condition.id);
      }}
    />
  );
}

export function validateIssueTypeCondition({
  condition,
}: ValidateDataConditionProps): string | undefined {
  if (condition.comparison.value === undefined || condition.comparison.value === null) {
    return t('You must select an issue type.');
  }
  return undefined;
}
