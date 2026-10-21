import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';
import {ExplorerAutofixBlockFixture} from 'sentry-fixture/autofix';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';

import type {AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {GroupActivityType} from 'sentry/types/group';

import {getAutofixTimelineItems} from './autofixTimeline';

describe('getAutofixTimelineItems', () => {
  const runId = 42;
  const section: AutofixSection = {
    artifacts: [],
    blocks: [ExplorerAutofixBlockFixture()],
    status: 'completed',
    step: 'root_cause',
  };
  const completed = ActivityFeedFixture({
    id: 'completed',
    type: GroupActivityType.SEER_RCA_COMPLETED,
    data: {run_id: runId},
    dateCreated: '2024-01-01T00:01:00Z',
  });
  const started = ActivityFeedFixture({
    id: 'started',
    type: GroupActivityType.SEER_RCA_STARTED,
    data: {run_id: runId},
    dateCreated: '2023-12-31T23:59:00Z',
  });

  it('matches the result run even when another run has newer activity', () => {
    const newer = ActivityFeedFixture({
      ...completed,
      type: GroupActivityType.SEER_RCA_COMPLETED,
      id: 'newer',
      data: {run_id: 99},
    });
    expect(getAutofixTimelineItems([newer, completed], runId, [section])).toEqual([
      {type: 'activity', activity: newer},
      {type: 'activity', activity: completed, section},
    ]);
  });

  it('does not attach stale results to a completed retry', () => {
    const retry = {...started, id: 'retry', dateCreated: '2024-01-01T00:02:00Z'};
    const retryCompleted = {
      ...completed,
      id: 'retry-completed',
      dateCreated: '2024-01-01T00:03:00Z',
    };
    expect(
      getAutofixTimelineItems([retryCompleted, retry, completed, started], runId, [
        section,
      ]).some(item => item.section)
    ).toBe(false);
  });

  it('waits for the completion event belonging to newer result blocks', () => {
    expect(
      getAutofixTimelineItems([completed], runId, [
        {
          ...section,
          blocks: [ExplorerAutofixBlockFixture({timestamp: '2024-01-01T00:02:00Z'})],
        },
      ]).some(item => item.section)
    ).toBe(false);
  });

  it('attaches cumulative code changes to the latest PR iteration', () => {
    const iterationStarted = ActivityFeedFixture({
      id: 'iteration-started',
      type: GroupActivityType.SEER_ITERATION_STARTED,
      data: {run_id: runId},
      dateCreated: '2024-01-01T00:02:00Z',
    });
    const iterationCompleted = ActivityFeedFixture({
      id: 'iteration-completed',
      type: GroupActivityType.SEER_ITERATION_COMPLETED,
      data: {},
      dateCreated: '2024-01-01T00:03:00Z',
    });
    const codeChanges = {
      ...section,
      step: 'code_changes',
      blocks: [
        ExplorerAutofixBlockFixture({
          message: {
            role: 'assistant',
            content: 'Original fix',
            metadata: {step: 'code_changes'},
          },
        }),
        ExplorerAutofixBlockFixture({
          timestamp: '2024-01-01T00:02:30Z',
          message: {
            role: 'assistant',
            content: 'Updated',
            metadata: {step: 'pr_iteration'},
          },
        }),
      ],
    };
    const codingCompleted = ActivityFeedFixture({
      id: 'coding-completed',
      type: GroupActivityType.SEER_CODING_COMPLETED,
      data: {run_id: runId},
      dateCreated: completed.dateCreated,
    });

    expect(
      getAutofixTimelineItems(
        [iterationCompleted, iterationStarted, codingCompleted],
        runId,
        [codeChanges]
      )
    ).toContainEqual({
      type: 'activity',
      activity: iterationCompleted,
      section: codeChanges,
    });
  });

  it('keeps coding results on the PR creation entry after the PR is marked ready', () => {
    const pullRequest = PullRequestFixture();
    const prCreated = ActivityFeedFixture({
      id: 'pr-created',
      type: GroupActivityType.SEER_PR_CREATED,
      dateCreated: completed.dateCreated,
      data: {
        run_id: runId,
        pull_requests: [
          {
            provider: 'github',
            repo_name: 'org/repo',
            pull_request: {
              pr_number: 123,
              pr_url: pullRequest.externalUrl,
            },
          },
        ],
      },
    });
    const reference = ActivityFeedFixture({
      id: 'pr-reference',
      type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
      data: {pullRequest},
      dateCreated: completed.dateCreated,
    });
    const ready = ActivityFeedFixture({
      id: 'pr-ready',
      type: GroupActivityType.SEER_PR_READY_FOR_REVIEW,
      data: {run_id: runId},
      dateCreated: '2024-01-01T00:02:00Z',
    });
    const codeChanges = {
      ...section,
      step: 'code_changes',
      blocks: [
        ExplorerAutofixBlockFixture({
          message: {
            role: 'assistant',
            content: 'Fix',
            metadata: {step: 'code_changes'},
          },
        }),
      ],
    };

    expect(
      getAutofixTimelineItems([ready, prCreated, reference], runId, [codeChanges])
    ).toEqual([
      {type: 'activity', activity: ready},
      {
        type: 'activity',
        activity: reference,
        actorActivity: prCreated,
        section: codeChanges,
      },
    ]);
  });
});
