import {tct} from 'sentry/locale';
import {AgeComparison} from 'sentry/types/workflowEngine/dataConditions';
import {
  InlineNumberInput,
  InlineSelectControl,
  selectControlStyles,
  useDataConditionNodeContext,
} from 'sentry/views/automations/components/dataConditionNodes';

export default function AgeComparisonNode() {
  return tct('The issue is [comparisonType] [value] [time]', {
    comparisonType: <ComparisonField />,
    value: <ValueField />,
    time: <TimeField />,
  });
}

const ageComparisonOptions = [
  {
    value: AgeComparison.OLDER,
    label: 'older than',
  },
  {
    value: AgeComparison.NEWER,
    label: 'newer than',
  },
];

function ComparisonField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <InlineSelectControl
      styles={selectControlStyles}
      name={`${condition_id}.comparison.type`}
      value={condition.comparison.type}
      options={ageComparisonOptions}
      onChange={(value: AgeComparison) => {
        onUpdate({
          type: value,
        });
      }}
    />
  );
}

function ValueField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <InlineNumberInput
      name={`${condition_id}.comparison.value`}
      value={condition.comparison.value}
      min={0}
      step={1}
      onChange={(value: string) => {
        onUpdate({
          value: parseInt(value, 10),
        });
      }}
    />
  );
}

function TimeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <InlineSelectControl
      styles={selectControlStyles}
      name={`${condition_id}.comparison.time`}
      value={condition.comparison.time}
      options={[
        {value: 'minutes', label: 'minute(s)'},
        {value: 'hours', label: 'hour(s)'},
        {value: 'days', label: 'day(s)'},
      ]}
      onChange={(value: string) => {
        onUpdate({
          time: value,
        });
      }}
    />
  );
}
