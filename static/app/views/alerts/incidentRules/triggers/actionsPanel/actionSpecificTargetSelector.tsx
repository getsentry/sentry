import * as React from 'react';
import {Fragment} from 'react';

import {Organization, Project} from 'app/types';
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
  const {action, disabled, onChange} = props;

  const handleChangeSpecificTargetIdentifier = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange(e.target.value);
  };

  if (action.targetType !== TargetType.SPECIFIC || action.type !== ActionType.SLACK) {
    return <Fragment />;
  }
  return (
    <Input
      type="text"
      autoComplete="off"
      disabled={disabled}
      key="inputChannelId"
      value={action.inputChannelId || ''}
      onChange={handleChangeSpecificTargetIdentifier}
      placeholder="optional: channel ID or user ID"
    />
  );
}
