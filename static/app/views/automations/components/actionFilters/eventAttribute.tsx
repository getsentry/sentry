import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  Attributes,
  MATCH_CHOICES,
  type MatchType,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export function EventAttributeDetails({condition}: {condition: DataCondition}) {
  return tct("The event's [attribute] [match] [value]", {
    attribute: condition.comparison.attribute,
    match:
      MATCH_CHOICES.find(choice => choice.value === condition.comparison.match)?.label ||
      condition.comparison.match,
    value: condition.comparison.value,
  });
}

export function EventAttributeNode() {
  return tct("The event's [attribute] [match] [value]", {
    attribute: <AttributeField />,
    match: <MatchField />,
    value: <ValueField />,
  });
}

function AttributeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.attribute`}
      aria-label={t('Attribute')}
      placeholder={t('attribute')}
      value={condition.comparison.attribute}
      options={Object.values(Attributes).map(attribute => ({
        value: attribute,
        label: attribute,
      }))}
      onChange={(option: SelectValue<Attributes>) => {
        onUpdate({comparison: {...condition.comparison, attribute: option.value}});
      }}
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
      onChange={(option: SelectValue<MatchType>) => {
        onUpdate({comparison: {...condition.comparison, match: option.value}});
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
