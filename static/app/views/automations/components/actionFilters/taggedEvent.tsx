import {
  InlineInputField,
  InlineSelectControl,
  selectControlStyles,
} from 'sentry/components/workflowEngine/ui/inlineFormFields';
import {t, tct} from 'sentry/locale';
import {
  MATCH_CHOICES,
  type MatchType,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export default function TaggedEventNode() {
  return tct("The event's [key] [match] [value]", {
    key: <KeyField />,
    match: <MatchField />,
    value: <ValueField />,
  });
}

function KeyField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <InlineInputField
      name={`${condition_id}.comparison.key`}
      placeholder={t('tag')}
      value={condition.comparison.key}
      onChange={(value: string) => {
        onUpdate({
          key: value,
        });
      }}
    />
  );
}

function MatchField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <InlineSelectControl
      styles={selectControlStyles}
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
    <InlineInputField
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
