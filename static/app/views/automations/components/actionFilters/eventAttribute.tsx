import AutomationBuilderInputField from 'sentry/components/workflowEngine/form/automationBuilderInputField';
import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {t, tct} from 'sentry/locale';
import {
  Attributes,
  MATCH_CHOICES,
  type MatchType,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export default function EventAttributeNode() {
  return tct("The event's [attribute] [match] [value]", {
    attribute: <AttributeField />,
    match: <MatchField />,
    value: <ValueField />,
  });
}

function AttributeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.attribute`}
      placeholder={t('attribute')}
      value={condition.comparison.attribute}
      options={Object.values(Attributes).map(attribute => ({
        value: attribute,
        label: attribute,
      }))}
      onChange={(value: Attributes) => {
        onUpdate({
          attribute: value,
        });
      }}
    />
  );
}

function MatchField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.match`}
      value={condition.comparison.match}
      options={MATCH_CHOICES}
      onChange={(value: MatchType) => {
        onUpdate({
          match: value,
        });
      }}
    />
  );
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderInputField
      name={`${condition_id}.comparison.value`}
      placeholder={t('value')}
      value={condition.comparison.value}
      onChange={(value: string) => {
        onUpdate({
          value,
        });
      }}
    />
  );
}
