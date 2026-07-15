import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType, IssueCategory, PriorityLevel} from 'sentry/types/group';
import type {Commit, PullRequest, Repository} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import {useUser} from 'sentry/utils/useUser';
import {ActivityLine} from 'sentry/views/issueDetails/activitySection/activityLineItem';
import {
  ActivityLineNote,
  isActivityNote,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';

const user = {
  id: '1',
  name: 'David Cramer',
  email: 'david@example.com',
  username: 'dcramer',
  avatarUrl: null,
  isActive: true,
} as unknown as NonNullable<GroupActivity['user']>;

const repository: Repository = {
  dateCreated: '2025-01-01T00:00:00Z',
  externalId: 'example/repository',
  externalSlug: 'example/repository',
  id: '1',
  integrationId: '1',
  name: 'example/repository',
  provider: {id: 'integrations:github', name: 'GitHub'},
  status: RepositoryStatus.ACTIVE,
  url: 'https://github.com/example/repository',
};

const pullRequest: PullRequest = {
  dateCreated: '2025-01-01T00:00:00Z',
  externalUrl: 'https://github.com/example/repository/pull/1234',
  id: '1234',
  message: null,
  repository,
  title: 'Fix example issue',
};

const commit: Commit = {
  dateCreated: '2025-01-01T00:00:00Z',
  id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
  message: 'Fix example issue',
  pullRequest,
  releases: [],
  repository,
};

const commitOnly = {...commit, pullRequest: null};
const releasedCommit = {
  ...commitOnly,
  releases: [release('backend@1.2.3', '2025-01-02T00:00:00Z')],
};
const multiReleaseCommit = {
  ...releasedCommit,
  releases: [
    ...releasedCommit.releases,
    release('frontend@1.2.3', '2025-01-03T00:00:00Z'),
    release('worker@1.2.3', '2025-01-04T00:00:00Z'),
  ],
};

const group = {
  activity: [],
  issueCategory: IssueCategory.ERROR,
  project: {id: '1', slug: 'example-project'},
} as unknown as Group;

const resolutionActivities = [
  activity(GroupActivityType.SET_RESOLVED),
  activity(GroupActivityType.SET_RESOLVED, {
    integration_id: 408,
    provider: 'Jira Server',
    provider_key: 'jira_server',
  }),
  activity(GroupActivityType.SET_RESOLVED_BY_AGE, {age: 168}),
  activity(GroupActivityType.SET_RESOLVED_IN_RELEASE, {version: 'backend@1.2.3'}),
  activity(GroupActivityType.SET_RESOLVED_IN_RELEASE, {
    version: 'backend@1.2.3',
    commit,
  }),
  activity(GroupActivityType.SET_RESOLVED_IN_RELEASE, {
    version: 'backend@1.2.3',
    commit: commitOnly,
  }),
  activity(GroupActivityType.SET_RESOLVED_IN_RELEASE, {
    version: 'backend@1.2.3',
    integration_id: 408,
    provider: 'Jira Server',
    provider_key: 'jira_server',
  }),
  activity(GroupActivityType.SET_RESOLVED_IN_RELEASE, {
    current_release_version: 'backend@1.0.0',
  }),
  activity(GroupActivityType.SET_RESOLVED_IN_RELEASE),
  activity(GroupActivityType.SET_RESOLVED_IN_COMMIT, {commit: commitOnly}),
  activity(GroupActivityType.SET_RESOLVED_IN_COMMIT, {commit: releasedCommit}),
  activity(GroupActivityType.SET_RESOLVED_IN_COMMIT, {commit: multiReleaseCommit}),
  activity(GroupActivityType.SET_UNRESOLVED),
  activity(GroupActivityType.SET_UNRESOLVED, {
    integration_id: 408,
    provider: 'Jira Server',
    provider_key: 'jira_server',
  }),
  activity(GroupActivityType.SET_REGRESSION, {
    version: 'backend@2.0.0',
    resolved_in_version: 'backend@1.2.3',
    follows_semver: true,
  }),
  activity(GroupActivityType.SET_REGRESSION, {
    version: 'backend@2.0.0',
    resolved_in_version: 'backend@1.2.3',
    follows_semver: false,
  }),
];

const archivedActivities = [
  activity(GroupActivityType.SET_IGNORED),
  activity(GroupActivityType.SET_IGNORED, {ignoreDuration: 10}),
  activity(GroupActivityType.SET_IGNORED, {ignoreCount: 50}),
  activity(GroupActivityType.SET_IGNORED, {
    ignoreCount: 50,
    ignoreWindow: 10,
  }),
  activity(GroupActivityType.SET_IGNORED, {ignoreUserCount: 50}),
  activity(GroupActivityType.SET_IGNORED, {
    ignoreUserCount: 50,
    ignoreUserWindow: 10,
  }),
  activity(GroupActivityType.SET_IGNORED, {ignoreUntil: '2027-01-01T00:00:00Z'}),
  activity(GroupActivityType.SET_IGNORED, {ignoreUntilEscalating: true}),
];

const assignmentActivities = [
  activity(GroupActivityType.ASSIGNED, {
    assignee: user.id,
    assigneeType: 'user',
  }),
  activity(GroupActivityType.ASSIGNED, {
    assignee: '2',
    assigneeType: 'user',
    assigneeName: 'Jane Doe',
  }),
  activity(GroupActivityType.ASSIGNED, {
    assignee: '2',
    assigneeType: 'team',
    assigneeName: 'frontend',
  }),
  activity(GroupActivityType.ASSIGNED, {
    assignee: '2',
    assigneeType: 'user',
    assigneeName: 'Jane Doe',
    integration: 'projectOwnership',
    rule: 'path:src/** #frontend',
  }),
  activity(GroupActivityType.UNASSIGNED),
];

const expiredSnooze = {
  count: null,
  until: null,
  user_count: null,
  user_window: null,
  window: null,
};

const priorityActivities = [
  activity(GroupActivityType.FIRST_SEEN, {priority: PriorityLevel.HIGH}),
  activity(GroupActivityType.MARK_REVIEWED),
  activity(GroupActivityType.AUTO_SET_ONGOING, {after_days: 7}),
  activity(GroupActivityType.SET_PRIORITY, {
    priority: PriorityLevel.LOW,
    reason: 'manual',
  }),
  activity(GroupActivityType.SET_PRIORITY, {
    priority: PriorityLevel.MEDIUM,
    reason: 'ongoing',
  }),
  activity(GroupActivityType.SET_PRIORITY, {
    priority: PriorityLevel.HIGH,
    reason: 'escalating',
  }),
  activity(GroupActivityType.SET_UNRESOLVED, {forecast: 4470}),
  activity(GroupActivityType.SET_ESCALATING, {forecast: 4470}),
  activity(GroupActivityType.SET_ESCALATING, {
    expired_snooze: {...expiredSnooze, count: 50, window: 10},
  }),
  activity(GroupActivityType.SET_ESCALATING, {
    expired_snooze: {...expiredSnooze, count: 50},
  }),
  activity(GroupActivityType.SET_ESCALATING, {
    expired_snooze: {...expiredSnooze, user_count: 50, user_window: 10},
  }),
  activity(GroupActivityType.SET_ESCALATING, {
    expired_snooze: {...expiredSnooze, user_count: 50},
  }),
  activity(GroupActivityType.SET_ESCALATING, {
    expired_snooze: {
      ...expiredSnooze,
      until: new Date('2027-01-01T00:00:00Z'),
    },
  }),
];

const sourceControlActivities = [
  activity(GroupActivityType.REFERENCED_IN_COMMIT, {commit}),
  activity(GroupActivityType.REFERENCED_IN_COMMIT, {commit: commitOnly}),
  activity(GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST, {pullRequest}),
  activity(GroupActivityType.PULL_REQUEST_CLOSED, {pullRequest}),
  activity(GroupActivityType.PULL_REQUEST_REOPENED, {pullRequest}),
  activity(GroupActivityType.PULL_REQUEST_MERGED, {pullRequest}),
  activity(GroupActivityType.PULL_REQUEST_UNLINKED, {pullRequest}),
];

const issueActivities = [
  activity(GroupActivityType.SET_PUBLIC),
  activity(GroupActivityType.SET_PRIVATE),
  activity(GroupActivityType.CREATE_ISSUE, {
    location: 'https://github.com/example/repository/issues/1234',
    provider: 'GitHub',
    title: '#1234',
  }),
  activity(GroupActivityType.CREATE_ISSUE, {
    location: 'https://github.com/example/repository/issues/5678',
    provider: 'GitHub',
    title: '#5678',
    new: false,
  }),
  activity(GroupActivityType.MERGE, {issues: [{id: '2'}, {id: '3'}]}),
  activity(GroupActivityType.UNMERGE_SOURCE, {
    fingerprints: ['one', 'two'],
    destination: {id: '2', shortId: 'EXAMPLE-2'},
  }),
  activity(GroupActivityType.UNMERGE_DESTINATION, {
    fingerprints: ['one'],
    source: {id: '3', shortId: 'EXAMPLE-3'},
  }),
  activity(GroupActivityType.REPROCESS, {
    eventCount: 25,
    newGroupId: 2,
    oldGroupId: 1,
  }),
  activity(GroupActivityType.DELETED_ATTACHMENT),
];

const note = activity(GroupActivityType.NOTE, {
  text: 'This started after the latest deploy.',
});

const seerPullRequest = {
  provider: 'GitHub',
  pull_request: {
    pr_number: 1234,
    pr_url: 'https://github.com/example/repository/pull/1234',
  },
  repo_name: 'example/repository',
};

const seerActivities = [
  seerActivity(GroupActivityType.SEER_RCA_STARTED),
  seerActivity(GroupActivityType.SEER_RCA_COMPLETED),
  seerActivity(GroupActivityType.SEER_SOLUTION_STARTED),
  seerActivity(GroupActivityType.SEER_SOLUTION_COMPLETED),
  seerActivity(GroupActivityType.SEER_CODING_STARTED),
  seerActivity(GroupActivityType.SEER_CODING_COMPLETED),
  seerActivity(GroupActivityType.SEER_PR_CREATED, {
    pull_requests: [seerPullRequest],
  }),
  seerActivity(GroupActivityType.SEER_ITERATION_STARTED),
  seerActivity(GroupActivityType.SEER_ITERATION_COMPLETED, {
    pull_requests: [seerPullRequest],
  }),
];

export default Storybook.story('Issue Activity', story => {
  story('Resolution', () => <ActivityExamples items={resolutionActivities} />);
  story('Archived', () => <ActivityExamples items={archivedActivities} />);
  story('Assignment', () => <ActivityExamples items={assignmentActivities} />);
  story('Priority and escalation', () => <ActivityExamples items={priorityActivities} />);
  story('Source control', () => <ActivityExamples items={sourceControlActivities} />);
  story('Issue changes', () => <ActivityExamples items={issueActivities} />);
  story('Comments', () => <CommentExample />);
  story('Seer', () => <ActivityExamples items={seerActivities} />);
});

function activity(
  type: GroupActivityType,
  data: Record<string, unknown> = {},
  actor: GroupActivity['user'] = user
): GroupActivity {
  return {
    data,
    dateCreated: '2025-01-01T00:00:00Z',
    id: type,
    type,
    user: actor,
  } as GroupActivity;
}

function seerActivity(type: GroupActivityType, data: Record<string, unknown> = {}) {
  return activity(type, data, null);
}

function release(version: string, dateReleased: string) {
  return {dateReleased, version} as unknown as Commit['releases'][number];
}

function ActivityExamples({items}: {items: GroupActivity[]}) {
  return (
    <ActivityList gap="md">
      {items.map((item, index) =>
        isActivityNote(item) ? (
          <ActivityLineNote
            key={`${item.id}-${index}`}
            activity={item}
            group={group}
            inputVariant="compact"
            onDelete={async () => {}}
          />
        ) : (
          <ActivityLine
            key={`${item.id}-${index}`}
            group={group}
            item={item}
            timestampUnitStyle="short"
          />
        )
      )}
    </ActivityList>
  );
}

function CommentExample() {
  const activeUser = useUser();

  if (!isActivityNote(note)) {
    return null;
  }

  return (
    <ActivityList gap="md">
      <ActivityLineNote
        activity={{...note, user: activeUser}}
        group={group}
        inputVariant="full"
        onDelete={async () => {}}
      />
    </ActivityList>
  );
}

const ActivityList = styled(Stack)`
  position: relative;
  container-name: activity-list;
  container-type: inline-size;

  &::before {
    content: '';
    position: absolute;
    left: 10.5px;
    top: 11px;
    bottom: 0;
    border-left: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
  }
`;
