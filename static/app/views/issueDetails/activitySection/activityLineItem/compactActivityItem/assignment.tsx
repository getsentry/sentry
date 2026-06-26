import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {GroupActivityAssigned} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {AssigneePill} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips';

import type {CompactGroupActivityItem} from './types';

interface GetAssignedActivityItemParams {
  activity: GroupActivityAssigned;
  author: string;
  teams: Team[];
}

function isTeam(value: Team | User): value is Team {
  return 'slug' in value;
}

function getAssignedAssignee(activity: GroupActivityAssigned, teams: Team[]) {
  const {data} = activity;

  if (data.assigneeType === 'team') {
    return teams.find(({id}) => id === data.assignee) ?? '<unknown-team>';
  }

  if (data.assignee === activity.user?.id) {
    return t('themselves');
  }

  if (data.user && !isTeam(data.user)) {
    return data.user;
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

function AssignmentPrefix({children}: {children: React.ReactNode}) {
  return (
    <Flex
      as="span"
      display="inline-flex"
      align="center"
      gap="xs"
      maxWidth="100%"
      minWidth={0}
      whiteSpace="nowrap"
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

export function getAssignedActivityItem({
  activity,
  teams,
  author,
}: GetAssignedActivityItemParams): CompactGroupActivityItem {
  const {data} = activity;
  const assignedToSelf = data.assignee === activity.user?.id;
  const assignee = assignedToSelf ? (
    t('themselves')
  ) : (
    <AssigneePill assignee={getAssignedAssignee(activity, teams)} />
  );
  const integrationName: Record<
    NonNullable<GroupActivityAssigned['data']['integration']>,
    string
  > = {
    msteams: t('Microsoft Teams'),
    slack: t('Slack'),
    projectOwnership: t('Ownership Rule'),
    codeowners: t('Codeowners Rule'),
    suspectCommitter: t('Suspect Commit'),
  };

  if (data.integration && integrationName[data.integration]) {
    return {
      title: (
        <AssignmentLead>
          <AssignmentPrefix>
            <AssignmentTitleText>{t('Assigned')}</AssignmentTitleText>
            <AssignmentDetailText>
              {tct('to [assignee] due to', {assignee})}
            </AssignmentDetailText>
          </AssignmentPrefix>
          <RuleSource>{integrationName[data.integration]}</RuleSource>
        </AssignmentLead>
      ),
      subtext: data.rule ? <RuleText>{data.rule}</RuleText> : null,
    };
  }

  return {
    title: (
      <AssignmentLead>
        <AssignmentPrefix>
          <AssignmentTitleText>{t('Assigned')}</AssignmentTitleText>
          <AssignmentDetailText>
            {assignedToSelf
              ? tct('to [assignee]', {assignee})
              : tct('to [assignee] by', {assignee})}
          </AssignmentDetailText>
        </AssignmentPrefix>
        {assignedToSelf ? null : author}
      </AssignmentLead>
    ),
  };
}
