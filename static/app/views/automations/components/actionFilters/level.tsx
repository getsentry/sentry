import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  type Level,
  LEVEL_CHOICES,
  LEVEL_MATCH_CHOICES,
  type MatchType,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {ValidateDataConditionProps} from 'sentry/views/automations/components/automationFormData';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function LevelDetails({condition}: {condition: DataCondition}) {
  return tct("The event's level [match] [level]", {
    match:
      LEVEL_MATCH_CHOICES.find(choice => choice.value === condition.comparison.match)
        ?.label || condition.comparison.match,
    level:
      LEVEL_CHOICES.find(choice => choice.value === condition.comparison.level)?.label ||
      condition.comparison.level,
  });
}

export function LevelNode() {
  return tct("The event's level [match] [level]", {
    match: <MatchField />,
    level: <LevelField />,
  });
}

function MatchField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.match`}
      aria-label={t('Match type')}
      value={condition.comparison.match}
      options={LEVEL_MATCH_CHOICES}
      onChange={(option: SelectValue<MatchType>) => {
        onUpdate({comparison: {...condition.comparison, match: option.value}});
        removeError(condition.id);
      }}
    />
  );
}

function LevelField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.level`}
      aria-label={t('Level')}
      value={condition.comparison.level}
      options={LEVEL_CHOICES}
      onChange={(option: SelectValue<Level>) => {
        onUpdate({comparison: {...condition.comparison, level: option.value}});
        removeError(condition.id);
      }}
    />
  );
}

export function validateLevelCondition({
  condition,
}: ValidateDataConditionProps): string | undefined {
  if (!condition.comparison.match || !condition.comparison.level) {
    return t('Ensure all fields are filled in.');
  }
  return undefined;
}
