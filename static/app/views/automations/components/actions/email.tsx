import styled from '@emotion/styled';

import SelectMembers from 'sentry/components/selectMembers';
import TeamSelector from 'sentry/components/teamSelector';
import AutomationBuilderSelectField, {
  selectControlStyles,
} from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {
  FALLTHROUGH_CHOICES,
  TARGET_TYPE_CHOICES,
  TargetType,
} from 'sentry/views/automations/components/actions/constants';

export default function EmailNode() {
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
      onChange={(value: string) => onUpdate({targetType: value})}
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
          onChange={(value: any) => onUpdate({targetIdentifier: value})}
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
          onChange={(value: any) => onUpdate({targetIdentifier: value})}
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
