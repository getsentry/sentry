import styled from '@emotion/styled';

import SelectMembers from 'sentry/components/selectMembers';
import TeamSelector from 'sentry/components/teamSelector';
import AutomationBuilderSelectField, {
  selectControlStyles,
} from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

enum TargetType {
  UNASSIGNED = 'Unassigned',
  TEAM = 'Team',
  MEMBER = 'Member',
}

const TARGET_TYPE_CHOICES = [
  {value: TargetType.UNASSIGNED, label: 'No One'},
  {value: TargetType.TEAM, label: 'Team'},
  {value: TargetType.MEMBER, label: 'Member'},
];

export function AssignedToNode() {
  return tct('Issue is assigned to [targetType] [identifier]', {
    targetType: <TargetTypeField />,
    identifier: <IdentifierField />,
  });
}

function TargetTypeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${condition_id}.comparison.targetType`}
      value={condition.comparison.targetType}
      options={TARGET_TYPE_CHOICES}
      onChange={(value: string) => onUpdate({targetType: value, targetIdentifier: ''})}
    />
  );
}

function IdentifierField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const organization = useOrganization();

  if (condition.comparison.targetType === TargetType.TEAM) {
    return (
      <SelectWrapper>
        <TeamSelector
          name={`${condition_id}.data.targetIdentifier`}
          value={condition.comparison.targetIdentifier}
          onChange={(value: any) => onUpdate({targetIdentifier: value})}
          useId
          styles={selectControlStyles}
        />
      </SelectWrapper>
    );
  }

  if (condition.comparison.targetType === TargetType.MEMBER) {
    return (
      <SelectWrapper>
        <SelectMembers
          organization={organization}
          key={`${condition_id}.data.targetIdentifier`}
          value={condition.comparison.targetIdentifier}
          onChange={(value: any) => onUpdate({targetIdentifier: value.actor.id})}
          styles={selectControlStyles}
        />
      </SelectWrapper>
    );
  }

  return null;
}

const SelectWrapper = styled('div')`
  width: 200px;
`;
