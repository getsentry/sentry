import {Container} from '@sentry/scraps/layout';

import SelectMembers from 'sentry/components/selectMembers';
import {TeamSelector} from 'sentry/components/teamSelector';
import {
  AutomationBuilderSelect,
  selectControlStyles,
} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import useUserFromId from 'sentry/utils/useUserFromId';
import {TargetType} from 'sentry/views/automations/components/actionFilters/constants';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {ValidateDataConditionProps} from 'sentry/views/automations/components/automationFormData';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

const TARGET_TYPE_CHOICES = [
  {value: TargetType.UNASSIGNED, label: 'No One'},
  {value: TargetType.TEAM, label: 'Team'},
  {value: TargetType.MEMBER, label: 'Member'},
];

export function AssignedToDetails({condition}: {condition: DataCondition}) {
  const {targetType, targetIdentifier} = condition.comparison;

  if (targetType === TargetType.TEAM) {
    return <AssignedToTeam teamId={String(targetIdentifier)} />;
  }
  if (targetType === TargetType.MEMBER) {
    return <AssignedToMember memberId={targetIdentifier} />;
  }
  return tct('Issue is unassigned', {});
}

function AssignedToTeam({teamId}: {teamId: string}) {
  const {teams} = useTeamsById({ids: [teamId]});
  const team = teams.find(tm => tm.id === teamId);
  return t('Issue is assigned to team %s', `#${team?.slug ?? 'unknown'}`);
}

function AssignedToMember({memberId}: {memberId: number}) {
  const {data: user} = useUserFromId({id: memberId});
  return t('Issue is assigned to member %s', `${user?.email ?? 'unknown'}`);
}

export function AssignedToNode() {
  return tct('Issue is assigned to [targetType] [identifier]', {
    targetType: <TargetTypeField />,
    identifier: <IdentifierField />,
  });
}

function TargetTypeField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${condition_id}.comparison.targetType`}
      aria-label={t('Assignee type')}
      value={condition.comparison.targetType}
      options={TARGET_TYPE_CHOICES}
      onChange={(option: SelectValue<string>) =>
        onUpdate({
          comparison: {
            ...condition.comparison,
            targetType: option.value,
            targetIdentifier: '',
          },
        })
      }
    />
  );
}

function IdentifierField() {
  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();
  const organization = useOrganization();

  if (condition.comparison.targetType === TargetType.TEAM) {
    return (
      <Container width="200px">
        <TeamSelector
          name={`${condition_id}.data.targetIdentifier`}
          aria-label={t('Team')}
          value={String(condition.comparison.targetIdentifier)}
          onChange={(option: SelectValue<string>) => {
            onUpdate({
              comparison: {
                ...condition.comparison,
                // Backend expects a number
                targetIdentifier: Number(option.value),
              },
            });
            removeError(condition.id);
          }}
          useId
          styles={selectControlStyles}
        />
      </Container>
    );
  }

  if (condition.comparison.targetType === TargetType.MEMBER) {
    return (
      <Container width="200px">
        <SelectMembers
          organization={organization}
          key={`${condition_id}.data.targetIdentifier`}
          aria-label={t('Member')}
          value={String(condition.comparison.targetIdentifier)}
          onChange={(value: any) => {
            onUpdate({
              comparison: {
                ...condition.comparison,
                // Backend expects a number
                targetIdentifier: Number(value.actor.id),
              },
            });
            removeError(condition.id);
          }}
          styles={selectControlStyles}
        />
      </Container>
    );
  }

  return null;
}

export function validateAssignedToCondition({
  condition,
}: ValidateDataConditionProps): string | undefined {
  if (!condition.comparison.targetType) {
    return t('You must specify an assignee type.');
  }
  if (
    condition.comparison.targetType === TargetType.TEAM &&
    !condition.comparison.targetIdentifier
  ) {
    return t('You must specify a team.');
  }
  if (
    condition.comparison.targetType === TargetType.MEMBER &&
    !condition.comparison.targetIdentifier
  ) {
    return t('You must specify a member.');
  }
  return undefined;
}
