import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import {
  type Level,
  LEVEL_CHOICES,
  LEVEL_MATCH_CHOICES,
  type MatchType,
} from 'sentry/views/automations/components/actionFilters/constants';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

export default function LevelNode() {
  return tct("The event's level [match] [level]", {
    match: <MatchField />,
    level: <LevelField />,
  });
}

function MatchField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.match`}
      value={condition.comparison.match}
      options={LEVEL_MATCH_CHOICES}
      onChange={(value: MatchType) => {
        onUpdate({
          match: value,
        });
      }}
    />
  );
}

function LevelField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.level`}
      value={condition.comparison.level}
      options={LEVEL_CHOICES}
      onChange={(value: Level) => {
        onUpdate({
          level: value,
        });
      }}
    />
  );
}
