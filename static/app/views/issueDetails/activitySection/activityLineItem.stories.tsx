import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType, IssueCategory, PriorityLevel} from 'sentry/types/group';
import type {Commit, PullRequest, Repository} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import {useUser} from 'sentry/utils/useUser';
import {ActivityLine} from 'sentry/views/issueDetails/activitySection/activityLineItem';
import {
  collapseSeerActivityPairs,
  type ActivityFeedItem,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityFeedItem';
import {
  ActivityLineNote,
  isActivityNote,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/note';
import {Timeline} from 'sentry/views/issueDetails/activitySection/timeline';

const user = {
  id: '1',
  name: 'David Cramer',
  email: 'david@example.com',
  username: 'dcramer',
  avatarUrl: null,
  isActive: true,
} as unknown as NonNullable<GroupActivity['user']>;

const linearApp = {
  name: 'Linear',
  slug: 'linear',
  uuid: 'linear',
  avatars: [
    {
      avatarType: 'upload',
      avatarUuid: 'bb9d4ae02e0e4e059463f5fd0c6c7305',
      avatarUrl: 'https://sentry.io/sentry-app-avatar/bb9d4ae02e0e4e059463f5fd0c6c7305/',
      color: true,
    },
  ],
} as NonNullable<GroupActivity['sentry_app']>;

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
  sentryAppActivity(
    GroupActivityType.SET_RESOLVED_IN_RELEASE,
    {version: 'backend@1.2.3'},
    linearApp
  ),
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

const legacyResolutionActivities = [
  activity(GroupActivityType.SET_RESOLVED_IN_COMMIT, {commit: commitOnly}),
  activity(GroupActivityType.SET_RESOLVED_IN_COMMIT, {commit: releasedCommit}),
  activity(GroupActivityType.SET_RESOLVED_IN_COMMIT, {commit: multiReleaseCommit}),
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
  activity(GroupActivityType.UNLINK_EXTERNAL_ISSUE, {
    external_issue_key: 'example/repository#1234',
    provider: 'github',
  }),
  activity(GroupActivityType.UNLINK_PLATFORM_EXTERNAL_ISSUE, {
    display_name: 'example#APP-42',
    service_type: 'linear',
    web_url: 'https://linear.app/example/issue/APP-42',
  }),
  activity(GroupActivityType.UNLINK_PLATFORM_EXTERNAL_ISSUE, {
    display_name: 'example#APP-43',
    service_type: 'example',
    web_url: '',
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

const sourceActivities = [
  {...note, id: 'mcp-claude-code', source: 'mcp:claude-code'},
  {...activity(GroupActivityType.SET_RESOLVED), source: 'mcp:cursor'},
  {
    ...activity(GroupActivityType.ASSIGNED, {assignee: user.id, assigneeType: 'user'}),
    source: 'mcp:codex',
  },
  {...activity(GroupActivityType.SET_IGNORED), source: 'mcp:copilot'},
  {...activity(GroupActivityType.SET_UNRESOLVED), source: 'mcp'},
  {...activity(GroupActivityType.SET_RESOLVED), source: 'api'},
  {...activity(GroupActivityType.SET_RESOLVED, {}, null), source: 'api'},
  {
    ...activity(GroupActivityType.SET_RESOLVED_IN_RELEASE, {version: 'frontend@1.0.0'}),
    source: 'sentry-cli',
  },
];

const seerPullRequest = {
  provider: 'GitHub',
  pull_request: {
    pr_number: 1234,
    pr_url: 'https://github.com/example/repository/pull/1234',
  },
  repo_name: 'example/repository',
};

const seerActivities = [
  seerActivity(GroupActivityType.TRIGGER_AUTOFIX),
  seerActivity(GroupActivityType.TRIGGER_AUTOFIX, {referrer: 'slack'}),
  seerActivity(GroupActivityType.TRIGGER_AUTOFIX, {
    referrer: 'issue_summary.post_process_fixability',
  }),
  seerActivity(GroupActivityType.TRIGGER_AUTOFIX, {referrer: 'night_shift'}),
  seerActivity(GroupActivityType.SEER_RCA_STARTED),
  seerActivity(GroupActivityType.SEER_RCA_COMPLETED),
  seerActivity(GroupActivityType.SEER_SOLUTION_STARTED),
  seerActivity(GroupActivityType.SEER_SOLUTION_COMPLETED),
  seerActivity(GroupActivityType.SEER_CODING_STARTED),
  seerActivity(GroupActivityType.SEER_CODING_COMPLETED),
  seerActivity(GroupActivityType.SEER_PR_CREATED, {
    pull_requests: [seerPullRequest],
  }),
  {
    ...seerActivity(GroupActivityType.SEER_PR_CREATED, {
      pull_requests: [seerPullRequest],
    }),
    id: 'seer-pr-created-by-user',
    user,
  },
  seerActivity(GroupActivityType.SEER_PR_READY_FOR_REVIEW, {
    pull_requests: [seerPullRequest],
  }),
  seerActivity(GroupActivityType.SEER_ITERATION_STARTED),
  seerActivity(GroupActivityType.SEER_ITERATION_STARTED, {
    referrer: 'github.pr_comment',
  }),
  seerActivity(GroupActivityType.SEER_ITERATION_STARTED, {
    referrer: 'github.check_suite',
  }),
  seerActivity(GroupActivityType.SEER_ITERATION_COMPLETED, {
    pull_requests: [seerPullRequest],
  }),
];

const collapsedSeerActivities = collapseSeerActivityPairs([
  seerActivityAt(GroupActivityType.SEER_RCA_COMPLETED, '2025-01-01T00:12:00Z', {
    run_id: 1,
  }),
  seerActivityAt(GroupActivityType.SEER_RCA_STARTED, '2025-01-01T00:00:00Z', {
    run_id: 1,
  }),
  seerActivityAt(GroupActivityType.SEER_SOLUTION_COMPLETED, '2025-01-01T00:22:00Z', {
    run_id: 2,
  }),
  seerActivityAt(GroupActivityType.SEER_SOLUTION_STARTED, '2025-01-01T00:12:00Z', {
    run_id: 2,
  }),
  seerActivityAt(GroupActivityType.SEER_CODING_COMPLETED, '2025-01-01T00:30:00Z', {
    run_id: 3,
  }),
  {
    ...seerActivityAt(GroupActivityType.SEER_CODING_STARTED, '2025-01-01T00:22:00Z', {
      run_id: 3,
    }),
    user,
  },
  seerActivityAt(GroupActivityType.SEER_ITERATION_COMPLETED, '2025-01-01T00:37:00Z', {
    pull_requests: [seerPullRequest],
    run_id: 4,
  }),
  {
    ...seerActivityAt(GroupActivityType.SEER_ITERATION_STARTED, '2025-01-01T00:30:00Z', {
      referrer: 'github.check_suite',
      run_id: 4,
    }),
    user,
  },
  seerActivityAt(GroupActivityType.SEER_PR_READY_FOR_REVIEW, '2025-01-01T00:45:00Z', {
    pull_requests: [seerPullRequest],
  }),
]);

export default Storybook.story('Issue Activity', story => {
  story('Resolution', () => <ResolutionExamples />);
  story('Archived', () => <ActivityExamples items={archivedActivities} />);
  story('Assignment', () => <ActivityExamples items={assignmentActivities} />);
  story('Priority and escalation', () => <ActivityExamples items={priorityActivities} />);
  story('Source control', () => <ActivityExamples items={sourceControlActivities} />);
  story('Issue changes', () => <ActivityExamples items={issueActivities} />);
  story('Comments', () => <CommentExample />);
  story('Sources', () => <ActivityExamples items={sourceActivities} />);
  story('Seer', () => <ActivityExamples items={seerActivities} />);
  story('Collapsed Seer', () => <ActivityFeedExamples items={collapsedSeerActivities} />);
});

function ResolutionExamples() {
  return (
    <Stack gap="xl">
      <ActivityExamples items={resolutionActivities} />
      <Stack gap="sm">
        <Text size="sm" variant="muted">
          Legacy activity items
        </Text>
        <ActivityExamples items={legacyResolutionActivities} />
      </Stack>
    </Stack>
  );
}

function activity(
  type: GroupActivityType,
  data: Record<string, unknown> = {},
  actor: GroupActivity['user'] = user
): GroupActivity {
  return {
    ...(type === GroupActivityType.NOTE ? {commentId: type} : {}),
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

function seerActivityAt(
  type: GroupActivityType,
  dateCreated: string,
  data: Record<string, unknown>
) {
  return {...seerActivity(type, data), dateCreated};
}

function sentryAppActivity(
  type: GroupActivityType,
  data: Record<string, unknown>,
  sentryApp: NonNullable<GroupActivity['sentry_app']>
) {
  return {...activity(type, data, null), sentry_app: sentryApp};
}

function release(version: string, dateReleased: string) {
  return {dateReleased, version} as unknown as Commit['releases'][number];
}

function ActivityExamples({items}: {items: GroupActivity[]}) {
  return (
    <ActivityFeedExamples
      items={items.map(item => ({type: 'activity', activity: item}))}
    />
  );
}

function ActivityFeedExamples({items}: {items: ActivityFeedItem[]}) {
  return (
    <Timeline.Container>
      {items.map((item, index) =>
        item.type === 'activity' && isActivityNote(item.activity) ? (
          <ActivityLineNote
            key={`${item.activity.id}-${index}`}
            activity={item.activity}
            inputVariant="compact"
            onDelete={async () => {}}
            onUpdate={async () => {}}
          />
        ) : (
          <ActivityLine
            key={`${item.activity.id}-${index}`}
            group={group}
            item={item}
            timestampUnitStyle="short"
          />
        )
      )}
    </Timeline.Container>
  );
}

function CommentExample() {
  const activeUser = useUser();

  if (!isActivityNote(note)) {
    return null;
  }

  return (
    <Timeline.Container>
      <ActivityLineNote
        activity={{...note, user: activeUser}}
        inputVariant="full"
        onDelete={async () => {}}
        onUpdate={async () => {}}
      />
    </Timeline.Container>
  );
}
