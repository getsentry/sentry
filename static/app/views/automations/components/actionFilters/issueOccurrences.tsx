import {tct} from 'sentry/locale';
import {
  InlineNumberInput,
  useDataConditionNodeContext,
} from 'sentry/views/automations/components/dataConditionNodes';

export default function IssueOccurrencesNode() {
  return tct('The issue has happened at least [value] times', {
    value: <ValueField />,
  });
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <InlineNumberInput
      name={`${condition_id}.comparison.value`}
      value={condition.comparison.value}
      min={1}
      step={1}
      onChange={(value: string) => {
        onUpdate({
          value,
        });
      }}
    />
  );
}
