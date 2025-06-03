import styled from '@emotion/styled';

import SelectMembers from 'sentry/components/selectMembers';
import TeamSelector from 'sentry/components/teamSelector';
import AutomationBuilderSelectField, {
  selectControlStyles,
} from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import {ActionTarget} from 'sentry/types/workflowEngine/actions';
import useOrganization from 'sentry/utils/useOrganization';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

enum FallthroughChoiceType {
  ALL_MEMBERS = 'AllMembers',
  ACTIVE_MEMBERS = 'ActiveMembers',
  NO_ONE = 'NoOne',
}

const TARGET_TYPE_CHOICES = [
  {value: ActionTarget.ISSUE_OWNERS, label: 'Suggested assignees'},
  {value: ActionTarget.TEAM, label: 'Team'},
  {value: ActionTarget.USER, label: 'Member'},
];

const FALLTHROUGH_CHOICES = [
  {value: FallthroughChoiceType.ACTIVE_MEMBERS, label: 'Recently Active Members'},
  {value: FallthroughChoiceType.ALL_MEMBERS, label: 'All Project Members'},
  {value: FallthroughChoiceType.NO_ONE, label: 'No One'},
];

export function EmailNode() {
  return tct('Notify [targetType] [identifier]', {
    targetType: <TargetTypeField />,
    identifier: <IdentifierField />,
  });
}

function TargetTypeField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${actionId}.config.target_type`}
      value={action.config.target_type}
      options={TARGET_TYPE_CHOICES}
      onChange={(value: string) =>
        onUpdate({config: {target_type: value, target_identifier: undefined}})
      }
    />
  );
}

function IdentifierField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  const organization = useOrganization();

  if (action.config.target_type === ActionTarget.TEAM) {
    return (
      <SelectWrapper>
        <TeamSelector
          name={`${actionId}.config.target_identifier`}
          value={action.config.target_identifier}
          onChange={(value: any) =>
            onUpdate({config: {target_identifier: value.actor.id}})
          }
          useId
          styles={selectControlStyles}
        />
      </SelectWrapper>
    );
  }
  if (action.config.target_type === ActionTarget.USER) {
    return (
      <SelectWrapper>
        <SelectMembers
          organization={organization}
          key={`${actionId}.config.target_identifier`}
          value={action.config.target_identifier}
          onChange={(value: any) =>
            onUpdate({config: {target_identifier: value.actor.id}})
          }
          styles={selectControlStyles}
        />
      </SelectWrapper>
    );
  }
  return tct('and, if none found, notify [fallThrough]', {
    fallThrough: <FallthroughField />,
  });
}

function FallthroughField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${actionId}.data.fallthroughType`}
      value={action.data.fallthroughType}
      options={FALLTHROUGH_CHOICES}
      onChange={(value: string) => onUpdate({data: {fallthroughType: value}})}
    />
  );
}

const SelectWrapper = styled('div')`
  width: 200px;
`;
