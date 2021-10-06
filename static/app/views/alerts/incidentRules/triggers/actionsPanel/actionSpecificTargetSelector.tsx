import * as React from 'react';
import {Fragment} from 'react';

import SelectControl from 'app/components/forms/selectControl';
import TeamSelector from 'app/components/forms/teamSelector';
import SelectMembers from 'app/components/selectMembers';
import {Organization, Project, SelectValue} from 'app/types';
import {
  Action,
  ActionType,
  MetricActionTemplate,
  TargetType,
} from 'app/views/alerts/incidentRules/types';
import Input from 'app/views/settings/components/forms/controls/input';

type Props = {
  action: Action;
  availableAction?: MetricActionTemplate;
  disabled: boolean;
  loading: boolean;
  organization: Organization;
  project?: Project;
  onChange: (value: string) => void;
};

export default function ActionSpecificTargetSelector(props: Props) {
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
    case TargetType.USER:
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
          project={project}
          organization={organization}
          value={action.targetIdentifier}
          onChange={handleChangeTargetIdentifier}
        />
      );

    case TargetType.SPECIFIC:
      return availableAction?.options ? (
        <SelectControl
          isDisabled={disabled || loading}
          value={action.targetIdentifier}
          options={availableAction.options}
          onChange={handleChangeTargetIdentifier}
        />
      ) : action.type === ActionType.SLACK ? (
        <Fragment>
          <Input
            type="text"
            autoComplete="off"
            disabled={disabled}
            key="inputChannelId"
            value={action.inputChannelId || ''}
            onChange={handleChangeSpecificTargetIdentifier}
            placeholder="optional: channel ID or user ID"
          />
        </Fragment>
      ) : (
        <Fragment />
      );

    default:
      return null;
  }
}
