import styled from '@emotion/styled';

import SelectMembers from 'sentry/components/selectMembers';
import {TeamSelector} from 'sentry/components/teamSelector';
import {
  AutomationBuilderSelect,
  selectControlStyles,
} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Action} from 'sentry/types/workflowEngine/actions';
import {ActionTarget} from 'sentry/types/workflowEngine/actions';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import useUserFromId from 'sentry/utils/useUserFromId';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';

enum FallthroughChoiceType {
  ALL_MEMBERS = 'AllMembers',
  ACTIVE_MEMBERS = 'ActiveMembers',
  NO_ONE = 'NoOne',
}

const TARGET_TYPE_CHOICES = [
  {value: ActionTarget.ISSUE_OWNERS, label: 'Suggested Assignees'},
  {value: ActionTarget.TEAM, label: 'Team'},
  {value: ActionTarget.USER, label: 'Member'},
];

const FALLTHROUGH_CHOICES = [
  {value: FallthroughChoiceType.ACTIVE_MEMBERS, label: 'Recently Active Members'},
  {value: FallthroughChoiceType.ALL_MEMBERS, label: 'All Project Members'},
  {value: FallthroughChoiceType.NO_ONE, label: 'No One'},
];

export function EmailDetails({action}: {action: Action}) {
  const {targetType, targetIdentifier} = action.config;

  if (targetType === ActionTarget.ISSUE_OWNERS) {
    return tct('Notify Suggested Assignees and, if none found, notify [fallthrough]', {
      fallthrough:
        FALLTHROUGH_CHOICES.find(choice => choice.value === action.data.fallthroughType)
          ?.label || String(action.data.fallthroughType),
    });
  }

  if (targetType === ActionTarget.TEAM && targetIdentifier) {
    return <AssignedToTeam teamId={targetIdentifier} />;
  }
  if (targetType === ActionTarget.USER && targetIdentifier) {
    return <AssignedToMember memberId={parseInt(targetIdentifier, 10)} />;
  }

  return t('Notify on preferred channel');
}

function AssignedToTeam({teamId}: {teamId: string}) {
  const {teams} = useTeamsById({ids: [teamId]});
  const team = teams.find(tm => tm.id === teamId);
  return t('Notify team %s', `#${team?.slug ?? 'unknown'}`);
}

function AssignedToMember({memberId}: {memberId: number}) {
  const {data: user} = useUserFromId({id: memberId});
  return t('Notify %s', `${user?.name ?? user?.email ?? 'unknown'}`);
}

export function EmailNode() {
  return tct('Notify [targetType] [identifier]', {
    targetType: <TargetTypeField />,
    identifier: <IdentifierField />,
  });
}

function TargetTypeField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderSelect
      aria-label={t('Notification target type')}
      name={`${actionId}.config.targetType`}
      value={action.config.targetType}
      options={TARGET_TYPE_CHOICES}
      onChange={(option: SelectValue<ActionTarget>) => {
        onUpdate({
          config: {
            ...action.config,
            targetType: option.value,
            targetIdentifier: undefined,
          },
          ...(option.value === ActionTarget.ISSUE_OWNERS
            ? {data: {fallthroughType: FallthroughChoiceType.ACTIVE_MEMBERS}}
            : {}),
        });
      }}
    />
  );
}

function IdentifierField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();
  const organization = useOrganization();

  if (action.config.targetType === ActionTarget.TEAM) {
    return (
      <SelectWrapper>
        <TeamSelector
          aria-label={t('Team')}
          name={`${actionId}.config.targetIdentifier`}
          value={action.config.targetIdentifier}
          onChange={(value: any) => {
            onUpdate({
              config: {
                ...action.config,
                targetIdentifier: value.actor.id,
                targetDisplay: value.actor.name,
              },
              data: {},
            });
            removeError(action.id);
          }}
          useId
          styles={selectControlStyles}
        />
      </SelectWrapper>
    );
  }
  if (action.config.targetType === ActionTarget.USER) {
    return (
      <SelectWrapper>
        <SelectMembers
          ariaLabel={t('User')}
          organization={organization}
          key={`${actionId}.config.targetIdentifier`}
          value={action.config.targetIdentifier}
          onChange={(value: any) => {
            onUpdate({
              config: {
                ...action.config,
                targetIdentifier: value.actor.id,
                targetDisplay: value.actor.name ?? value.actor.email,
              },
              data: {},
            });
            removeError(action.id);
          }}
          styles={selectControlStyles}
        />
      </SelectWrapper>
    );
  }
  return tct('and, if none found, notify [fallthrough]', {
    fallthrough: <FallthroughField />,
  });
}

function FallthroughField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${actionId}.data.fallthroughType`}
      aria-label={t('Fallthrough type')}
      value={action.data.fallthroughType}
      options={FALLTHROUGH_CHOICES}
      onChange={(option: SelectValue<string>) =>
        onUpdate({data: {fallthroughType: option.value}})
      }
    />
  );
}

export function validateEmailAction(action: Action): string | undefined {
  if (!action.config.targetType) {
    return t('You must notification target type.');
  }
  if (
    action.config.targetType === ActionTarget.ISSUE_OWNERS &&
    !action.data.fallthroughType
  ) {
    return t('You must specify a fallthrough type.');
  }
  if (action.config.targetType === ActionTarget.TEAM && !action.config.targetIdentifier) {
    return t('You must specify a team.');
  }
  if (action.config.targetType === ActionTarget.USER && !action.config.targetIdentifier) {
    return t('You must specify a member.');
  }
  return undefined;
}

const SelectWrapper = styled('div')`
  width: 200px;
`;
