import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {GroupActivityAssigned} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import type {AvatarUser, User} from 'sentry/types/user';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {AssigneePill} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/assigneeChip';
import {getAssignmentIntegrationName} from 'sentry/views/issueDetails/activitySection/assignmentIntegration';

import type {CompactGroupActivityItem} from './types';

interface GetAssignedActivityItemParams {
  activity: GroupActivityAssigned;
  author: string;
}

function isTeam(value: Team | User): value is Team {
  return 'slug' in value;
}

function getAssignedUser(activity: GroupActivityAssigned): AvatarUser | null {
  const {data} = activity;

  if (data.assigneeType !== 'user') {
    return null;
  }

  if (data.user && !isTeam(data.user)) {
    return data.user;
  }

  const email = data.assigneeEmail ?? '';
  const name = data.assigneeName ?? email;

  if (!email && !name) {
    return null;
  }

  return {
    email,
    id: data.assignee,
    ip_address: '',
    name,
    username: email,
  };
}

function getAssignedAssignee(activity: GroupActivityAssigned, teams: Team[]) {
  const {data} = activity;

  if (data.assigneeType === 'team') {
    return teams.find(({id}) => id === data.assignee) ?? '<unknown-team>';
  }

  if (data.assignee === activity.user?.id) {
    return t('themselves');
  }

  const assignedUser = getAssignedUser(activity);
  if (assignedUser) {
    return assignedUser;
  }

  if (data.assigneeType === 'user' && data.assigneeEmail) {
    return data.assigneeEmail;
  }

  return t('an unknown user');
}

function RuleSource({children}: {children: React.ReactNode}) {
  return (
    <Text as="span" variant="muted" bold={false} density="comfortable" wrap="nowrap">
      {children}
    </Text>
  );
}

function RuleText({children}: {children: React.ReactNode}) {
  return (
    <Text
      as="span"
      variant="muted"
      size="sm"
      monospace
      bold={false}
      density="comfortable"
      wordBreak="break-all"
    >
      {children}
    </Text>
  );
}

function AssignedActivityDetails({activity}: {activity: GroupActivityAssigned}) {
  const {teams} = useTeamsById();
  const {data} = activity;
  const assignedToSelf =
    data.assigneeType === 'user' && data.assignee === activity.user?.id;
  const assignee = assignedToSelf ? (
    t('themselves')
  ) : (
    <AssigneePill assignee={getAssignedAssignee(activity, teams)} />
  );
  const integrationName = getAssignmentIntegrationName(data.integration);

  if (integrationName) {
    return tct('to [assignee] due to [rule]', {
      assignee,
      rule: <RuleSource>{integrationName}</RuleSource>,
    });
  }

  return tct('to [assignee]', {assignee});
}

export function getAssignedActivityItem({
  activity,
}: GetAssignedActivityItemParams): CompactGroupActivityItem {
  const integrationName = getAssignmentIntegrationName(activity.data.integration);

  return {
    title: t('Issue assigned'),
    details: <AssignedActivityDetails activity={activity} />,
    subtext:
      integrationName && activity.data.rule ? (
        <RuleText>{activity.data.rule}</RuleText>
      ) : null,
  };
}
