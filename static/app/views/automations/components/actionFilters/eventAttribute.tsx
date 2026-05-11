import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  Attribute,
  MATCH_CHOICES,
  MatchType,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {ValidateDataConditionProps} from 'sentry/views/automations/components/automationFormData';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

function matchRequiresValue(match: MatchType): boolean {
  return match !== MatchType.IS_SET && match !== MatchType.NOT_SET;
}

export function EventAttributeDetails({condition}: {condition: DataCondition}) {
  const matchLabel =
    MATCH_CHOICES.find(choice => choice.value === condition.comparison.match)?.label ||
    condition.comparison.match;

  if (!matchRequiresValue(condition.comparison.match)) {
    return tct("The event's [attribute] attribute [match]", {
      attribute: condition.comparison.attribute,
      match: matchLabel,
    });
  }

  return tct("The event's [attribute] attribute [match] [value]", {
    attribute: condition.comparison.attribute,
    match: matchLabel,
    value: condition.comparison.value,
  });
}

export function EventAttributeNode() {
  const {condition} = useDataConditionNodeContext();

  if (!matchRequiresValue(condition.comparison.match)) {
    return tct("The event's [attribute] attribute [match]", {
      attribute: <AttributeField />,
      match: <MatchField />,
    });
  }

  return tct("The event's [attribute] attribute [match] [value]", {
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
      options={Object.values(Attribute).map(attribute => ({
        value: attribute,
        label: attribute,
      }))}
      onChange={(option: SelectValue<Attribute>) => {
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
        const {value: _value, ...rest} = condition.comparison;
        if (matchRequiresValue(option.value)) {
          onUpdate({comparison: {...condition.comparison, match: option.value}});
        } else {
          onUpdate({comparison: {...rest, match: option.value}});
        }
      }}
    />
  );
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderInput
      name={`${condition_id}.comparison.value`}
      aria-label={t('Value')}
      placeholder={t('value')}
      value={condition.comparison.value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({comparison: {...condition.comparison, value: e.target.value}});
        removeError(condition.id);
      }}
    />
  );
}

export function validateEventAttributeCondition({
  condition,
}: ValidateDataConditionProps): string | undefined {
  if (!condition.comparison.attribute || !condition.comparison.match) {
    return t('Ensure all fields are filled in.');
  }
  if (matchRequiresValue(condition.comparison.match) && !condition.comparison.value) {
    return t('Ensure all fields are filled in.');
  }
  return undefined;
}
