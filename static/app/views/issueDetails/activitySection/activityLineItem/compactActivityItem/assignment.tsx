import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';
import type {GroupActivityAssigned} from 'sentry/types/group';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {AssigneePill} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/assigneeChip';
import {getAssignmentIntegrationName} from 'sentry/views/issueDetails/activitySection/assignmentIntegration';

import type {CompactGroupActivityItem} from './types';

function getAssignee(
  data: GroupActivityAssigned['data'],
  {teams, isLoading, isError}: ReturnType<typeof useTeamsById>
) {
  if (data.assigneeType === 'team') {
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

  if (data.user && !('slug' in data.user)) {
    return data.user;
  }

  const name = data.assigneeName || data.assigneeEmail;
  if (name) {
    return {
      email: data.assigneeEmail,
      id: data.assignee,
      name,
      type: 'user',
    } satisfies Actor;
  }

  return t('an unknown user');
}

function AssignedActivityDetails({activity}: {activity: GroupActivityAssigned}) {
  const {data} = activity;
  let teamIds: string[] | undefined;
  if (data.assigneeType === 'team') {
    teamIds = [data.assignee];
  }
  const teamLookup = useTeamsById({ids: teamIds});

  let assignee: React.ReactNode;
  if (data.assigneeType === 'user' && data.assignee === activity.user?.id) {
    assignee = t('themselves');
  } else {
    assignee = <AssigneePill assignee={getAssignee(data, teamLookup)} />;
  }
  const integrationName = getAssignmentIntegrationName(data.integration);

  if (integrationName) {
    return tct('to [assignee] due to [rule]', {
      assignee,
      rule: integrationName,
    });
  }

  return tct('to [assignee]', {assignee});
}

export function getAssignedActivityItem({
  activity,
}: {
  activity: GroupActivityAssigned;
}): CompactGroupActivityItem {
  const integrationName = getAssignmentIntegrationName(activity.data.integration);
  let subtext: React.ReactNode = null;

  if (integrationName && activity.data.rule) {
    subtext = (
      <Text variant="inherit" monospace wordBreak="break-all">
        {activity.data.rule}
      </Text>
    );
  }

  return {
    title: t('Issue assigned'),
    details: <AssignedActivityDetails activity={activity} />,
    subtext,
  };
}
