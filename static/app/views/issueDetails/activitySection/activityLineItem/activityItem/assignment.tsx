import {useMemo} from 'react';

import {InfoText} from '@sentry/scraps/info';

import {t, tct} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';
import type {GroupActivityAssigned} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {useMembers} from 'sentry/utils/members/useMembers';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {AssigneePill} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/assigneeChip';
import {getAssignmentIntegrationName} from 'sentry/views/issueDetails/activitySection/assignmentIntegration';

function getTeamAssignee(
  data: GroupActivityAssigned['data'],
  {teams, isLoading, isError}: ReturnType<typeof useTeamsById>
) {
  const team = teams.find(({id}) => id === data.assignee);
  if (team) {
    return team;
  }

  if (isLoading || isError) {
    return data.assigneeName ? t('#%s', data.assigneeName) : t('Team');
  }

  if (data.assigneeName) {
    return t('#%s (deleted)', data.assigneeName);
  }

  return t('Deleted team');
}

function getUserAssignee(
  data: GroupActivityAssigned['data'],
  assignedUser: User | undefined,
  {isLoading, isError}: ReturnType<typeof useMembers>
) {
  if (assignedUser) {
    return assignedUser;
  }

  const name = data.assigneeName || data.assigneeEmail;
  if (isLoading || isError) {
    if (!name) {
      return t('an unknown user');
    }

    return {
      email: data.assigneeEmail,
      id: data.assignee,
      name,
      type: 'user',
    } satisfies Actor;
  }

  return name ? t('%s (deleted)', name) : t('Deleted user');
}

function TeamAssignee({data}: {data: GroupActivityAssigned['data']}) {
  const teamLookupOptions = useMemo(() => ({ids: [data.assignee]}), [data.assignee]);
  const teamLookup = useTeamsById(teamLookupOptions);

  return <AssigneePill assignee={getTeamAssignee(data, teamLookup)} />;
}

function UserAssignee({data}: {data: GroupActivityAssigned['data']}) {
  const embeddedUser = data.user && !('slug' in data.user) ? data.user : undefined;
  const memberIds = useMemo(() => [data.assignee], [data.assignee]);
  const memberLookup = useMembers({
    enabled: !embeddedUser,
    ids: memberIds,
  });
  const assignedUser =
    memberLookup.data?.find(member => member.id === data.assignee) ?? embeddedUser;

  return <AssigneePill assignee={getUserAssignee(data, assignedUser, memberLookup)} />;
}

function AssignmentAssignee({activity}: {activity: GroupActivityAssigned}) {
  const {data} = activity;

  if (data.assigneeType === 'user' && data.assignee === activity.user?.id) {
    return t('themselves');
  }

  if (data.assigneeType === 'team') {
    return <TeamAssignee data={data} />;
  }

  if (data.assigneeType === 'user') {
    return <UserAssignee data={data} />;
  }

  return t('an unknown user');
}

function AssignedActivityDetails({activity}: {activity: GroupActivityAssigned}) {
  const {data} = activity;
  const assignee = <AssignmentAssignee activity={activity} />;
  const integrationName = getAssignmentIntegrationName(data.integration);

  if (integrationName) {
    return tct('to [assignee] due to [rule]', {
      assignee,
      rule: data.rule ? (
        <InfoText title={data.rule}>{integrationName}</InfoText>
      ) : (
        integrationName
      ),
    });
  }

  return tct('to [assignee]', {assignee});
}

export function getAssignedActivityItem({activity}: {activity: GroupActivityAssigned}) {
  return {
    title: t('Assigned'),
    details: <AssignedActivityDetails activity={activity} />,
  };
}
