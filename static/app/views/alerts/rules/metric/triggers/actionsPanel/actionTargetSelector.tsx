import SelectControl from 'sentry/components/forms/controls/selectControl';
import Input from 'sentry/components/input';
import SelectMembers from 'sentry/components/selectMembers';
import TeamSelector from 'sentry/components/teamSelector';
import type {SelectValue} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Action, MetricActionTemplate} from 'sentry/views/alerts/rules/metric/types';
import {ActionType, TargetType} from 'sentry/views/alerts/rules/metric/types';

const getPlaceholderForType = (type: ActionType) => {
  switch (type) {
    case ActionType.SLACK:
      return '@username or #channel';
    case ActionType.MSTEAMS:
      // no prefixes for msteams
      return 'username or channel';
    case ActionType.DISCORD:
      return 'Discord channel ID';
    case ActionType.PAGERDUTY:
      return 'service';
    case ActionType.OPSGENIE:
      return 'team';
    default:
      throw Error('Not implemented');
  }
};

type Props = {
  action: Action;
  disabled: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  organization: Organization;
  availableAction?: MetricActionTemplate;
  project?: Project;
};

export default function ActionTargetSelector(props: Props) {
  const {action, availableAction, disabled, loading, onChange, organization, project} =
    props;

  const handleChangeTargetIdentifier = (value: SelectValue<string>) => {
    onChange(value.value);
  };

  const handleChangeSpecificTargetIdentifier = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange(e.target.value);
  };

  switch (action.targetType) {
    case TargetType.TEAM:
    case TargetType.USER: {
      const isTeam = action.targetType === TargetType.TEAM;

      return isTeam ? (
        <TeamSelector
          disabled={disabled}
          key="team"
          project={project}
          value={action.targetIdentifier}
          onChange={handleChangeTargetIdentifier}
          useId
        />
      ) : (
        <SelectMembers
          disabled={disabled}
          key="member"
          organization={organization}
          value={action.targetIdentifier}
          onChange={handleChangeTargetIdentifier}
        />
      );
    }
    case TargetType.SPECIFIC:
      return availableAction?.options ? (
        <SelectControl
          isDisabled={disabled || loading}
          value={action.targetIdentifier}
          options={availableAction.options}
          onChange={handleChangeTargetIdentifier}
        />
      ) : (
        <Input
          type="text"
          autoComplete="off"
          disabled={disabled}
          required={action.type === 'discord'} // Only required for discord channel ID
          key={action.type}
          value={action.targetIdentifier || ''}
          onChange={handleChangeSpecificTargetIdentifier}
          placeholder={getPlaceholderForType(action.type)}
        />
      );

    default:
      return null;
  }
}
