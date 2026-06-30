import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
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

function AssignmentLead({children}: {children: React.ReactNode}) {
  return (
    <Flex
      as="span"
      display="inline-flex"
      align="center"
      wrap="wrap"
      gap="xs"
      maxWidth="100%"
      minWidth={0}
    >
      {children}
    </Flex>
  );
}

function AssignmentTitleText({children}: {children: React.ReactNode}) {
  return (
    <Text as="span" bold density="comfortable">
      {children}
    </Text>
  );
}

function AssignmentDetailText({children}: {children: React.ReactNode}) {
  return (
    <Text as="span" variant="muted" bold={false} density="comfortable">
      {children}
    </Text>
  );
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

function AssignedActivityTitle({activity, author}: GetAssignedActivityItemParams) {
  const {teams} = useTeamsById();
  const {data} = activity;
  const assignedToSelf =
    data.assigneeType === 'user' && data.assignee === activity.user?.id;
  const assignee = assignedToSelf ? (
    <AssignmentDetailText>{t('themselves')}</AssignmentDetailText>
  ) : (
    <AssigneePill assignee={getAssignedAssignee(activity, teams)} />
  );
  const integrationName = getAssignmentIntegrationName(data.integration);

  if (integrationName) {
    return (
      <AssignmentLead>
        <AssignmentTitleText>{t('Assigned')}</AssignmentTitleText>
        <AssignmentDetailText>{t('to')}</AssignmentDetailText>
        {assignee}
        <AssignmentDetailText>{t('due to')}</AssignmentDetailText>
        <RuleSource>{integrationName}</RuleSource>
      </AssignmentLead>
    );
  }

  return (
    <AssignmentLead>
      <AssignmentTitleText>{t('Assigned')}</AssignmentTitleText>
      <AssignmentDetailText>{t('to')}</AssignmentDetailText>
      {assignee}
      {assignedToSelf ? null : <AssignmentDetailText>{t('by')}</AssignmentDetailText>}
      {assignedToSelf ? null : <AssignmentDetailText>{author}</AssignmentDetailText>}
    </AssignmentLead>
  );
}

export function getAssignedActivityItem({
  activity,
  author,
}: GetAssignedActivityItemParams): CompactGroupActivityItem {
  const integrationName = getAssignmentIntegrationName(activity.data.integration);

  return {
    title: <AssignedActivityTitle activity={activity} author={author} />,
    subtext:
      integrationName && activity.data.rule ? (
        <RuleText>{activity.data.rule}</RuleText>
      ) : null,
  };
}
