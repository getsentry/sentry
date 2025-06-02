import styled from '@emotion/styled';

import SelectMembers from 'sentry/components/selectMembers';
import TeamSelector from 'sentry/components/teamSelector';
import AutomationBuilderSelectField, {
  selectControlStyles,
} from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

enum TargetType {
  USER = 'user',
  TEAM = 'team',
  ISSUE_OWNERS = 'issue_owners',
}

enum FallthroughChoiceType {
  ALL_MEMBERS = 'AllMembers',
  ACTIVE_MEMBERS = 'ActiveMembers',
  NO_ONE = 'NoOne',
}

const TARGET_TYPE_CHOICES = [
  {value: TargetType.ISSUE_OWNERS, label: 'Suggested assignees'},
  {value: TargetType.TEAM, label: 'Team'},
  {value: TargetType.USER, label: 'Member'},
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
      name={`${actionId}.data.targetType`}
      value={action.data.targetType}
      options={TARGET_TYPE_CHOICES}
      onChange={(value: string) => onUpdate({targetType: value, targetIdentifier: ''})}
    />
  );
}

function IdentifierField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  const organization = useOrganization();

  if (action.data.targetType === TargetType.TEAM) {
    return (
      <SelectWrapper>
        <TeamSelector
          name={`${actionId}.data.targetIdentifier`}
          value={action.data.targetIdentifier}
          onChange={(value: any) => onUpdate({targetIdentifier: value.actor.id})}
          useId
          styles={selectControlStyles}
        />
      </SelectWrapper>
    );
  }
  if (action.data.targetType === TargetType.USER) {
    return (
      <SelectWrapper>
        <SelectMembers
          organization={organization}
          key={`${actionId}.data.targetIdentifier`}
          value={action.data.targetIdentifier}
          onChange={(value: any) => onUpdate({targetIdentifier: value.actor.id})}
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
      onChange={(value: string) => onUpdate({fallthroughType: value})}
    />
  );
}

const SelectWrapper = styled('div')`
  width: 200px;
`;
