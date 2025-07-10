import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  MATCH_CHOICES,
  type MatchType,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function TaggedEventDetails({condition}: {condition: DataCondition}) {
  return tct("The event's [key] tag [match] [value]", {
    key: condition.comparison.key,
    match:
      MATCH_CHOICES.find(choice => choice.value === condition.comparison.match)?.label ||
      condition.comparison.match,
    value: condition.comparison.value,
  });
}

export function TaggedEventNode() {
  return tct("The event's [key] [match] [value]", {
    key: <KeyField />,
    match: <MatchField />,
    value: <ValueField />,
  });
}

function KeyField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderInput
      name={`${condition_id}.comparison.key`}
      placeholder={t('tag')}
      value={condition.comparison.key}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({comparison: {...condition.comparison, key: e.target.value}});
      }}
      aria-label={t('Tag')}
    />
  );
}

function MatchField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.match`}
      aria-label={t('Match type')}
      value={condition.comparison.match}
      options={MATCH_CHOICES}
      onChange={(value: SelectValue<MatchType>) => {
        onUpdate({comparison: {...condition.comparison, match: value}});
      }}
    />
  );
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderInput
      name={`${condition_id}.comparison.value`}
      aria-label={t('Value')}
      placeholder={t('value')}
      value={condition.comparison.value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({comparison: {...condition.comparison, value: e.target.value}});
      }}
    />
  );
}
