import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';
import {
  AutofixRootCauseArtifactFixture,
  ExplorerAutofixBlockFixture,
  ExplorerAutofixResponseFixture,
  ExplorerAutofixStateFixture,
} from 'sentry-fixture/autofix';
import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {EventFixture} from 'sentry-fixture/event';
import {EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';
import {FrameFixture} from 'sentry-fixture/frame';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture, ProjectFixture} from 'sentry-fixture/project';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {clearIndicators} from 'sentry/actionCreators/indicator';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {EntryType} from 'sentry/types/event';
import {
  GroupActivityType,
  GroupStatus,
  ProgressState,
  type Group,
} from 'sentry/types/group';
import type {LinkedPullRequest} from 'sentry/types/integrations';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {IssuePreview} from './issuePreview';

describe('IssuePreview', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '1'});
  const group = GroupFixture({id: '101', project, hasSeen: true});
  const linkedPullRequest = {
    ...PullRequestFixture({
      id: '10',
      externalUrl: 'https://github.com/example/repo-name/pull/10',
    }),
    attribution: null,
    checksStatus: null,
    dateLinked: '2026-07-20T12:00:00Z',
    reviewStatus: null,
    status: 'open',
  } satisfies LinkedPullRequest;
  const fixAppliedGroup = GroupFixture({
    ...group,
    derivedData: {
      hasOpenFixPr: false,
      hasRootCause: true,
      isAssigned: true,
      lastProgressedAt: '2026-07-20T12:00:00Z',
      progress: ProgressState.FIX_APPLIED,
      status: 'open',
      viewCount: 1,
    },
  });

  function mockFixAppliedPreview(getGroup: () => Group = () => fixAppliedGroup) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: getGroup,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({autofix: null}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '10',
              externalUrl: 'https://github.com/org/repository/pull/10',
            }),
            attribution: {id: 'seer', type: 'seer'},
            checksStatus: null,
            dateLinked: '2026-07-20T12:00:00Z',
            reviewStatus: null,
            status: 'merged',
          },
        ],
      },
    });
  }

  beforeEach(() => {
    localStorage.clear();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: DetailedProjectFixture(project),
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/1/committers/`,
      body: {committers: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: []},
    });
    clearIndicators();
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/summarize/`,
      method: 'POST',
      body: {
        headline: 'Test summary',
        whatsWrong: null,
        possibleCause: null,
        trace: null,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({autofix: null}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: EventFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: AutofixSetupFixture({}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {hasSupportedScmIntegration: true},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      body: {},
    });
  });

  it('uses saved stack trace collapse preferences when AI features are hidden', async () => {
    const summaryRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/summarize/`,
      method: 'POST',
      body: {
        headline: 'A cached summary',
        whatsWrong: null,
        possibleCause: null,
        trace: null,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: EventStacktraceExceptionFixture(),
    });

    localStorage.setItem('issue-details-fold-section-collapse:exception', 'true');
    render(<IssuePreview groupId={group.id} />, {
      organization: OrganizationFixture({hideAiFeatures: true}),
    });

    const stackTrace = await screen.findByRole('region', {name: 'Stack Trace'});
    expect(within(stackTrace).queryByText('doThing')).not.toBeInTheDocument();
    expect(summaryRequest).not.toHaveBeenCalled();
    await userEvent.click(
      within(stackTrace).getByRole('button', {name: 'View Stack Trace Section'})
    );
    expect(within(stackTrace).getByText('an error occurred')).toBeVisible();
    expect(within(stackTrace).getByText('doThing')).toBeVisible();
    expect(localStorage.getItem('issue-details-fold-section-collapse:exception')).toBe(
      'false'
    );
    await userEvent.click(
      within(stackTrace).getByRole('button', {name: 'Collapse Stack Trace Section'})
    );
    expect(within(stackTrace).queryByText('doThing')).not.toBeInTheDocument();
    expect(localStorage.getItem('issue-details-fold-section-collapse:exception')).toBe(
      'true'
    );
  });

  describe('issue summary', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
        body: EventStacktraceExceptionFixture(),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
        body: AutofixSetupFixture({billing: {hasAutofixQuota: false}}),
      });
    });

    it('keeps telemetry and actions available when summary generation fails', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/summarize/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Unable to generate summary'},
      });

      render(<IssuePreview groupId={group.id} />, {organization});

      const stackTrace = await screen.findByRole('region', {name: 'Stack Trace'});
      expect(within(stackTrace).getByText('doThing')).toBeVisible();
      expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
    });

    it('waits for the summary before showing the body while keeping actions available', async () => {
      const response = Promise.withResolvers<void>();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/summarize/`,
        method: 'POST',
        asyncDelay: response.promise,
        body: {
          headline: 'Requests time out',
          whatsWrong: null,
          possibleCause: null,
          trace: null,
        },
      });

      render(<IssuePreview groupId={group.id} />, {organization});

      expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
      expect(screen.queryByRole('region', {name: 'Stack Trace'})).not.toBeInTheDocument();
      expect(screen.queryByRole('region', {name: 'Summary'})).not.toBeInTheDocument();

      response.resolve();
      const summary = await screen.findByRole('region', {name: 'Summary'});
      expect(within(summary).getByText('Requests time out')).toBeVisible();
      expect(screen.getByRole('region', {name: 'Stack Trace'})).toBeVisible();
    });

    it('renders and copies summary context without Seer quota', async () => {
      const writeText = jest.fn((_text: string) => Promise.resolve());
      Object.assign(navigator, {
        clipboard: {writeText},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/summarize/`,
        method: 'POST',
        body: {
          headline: 'Requests time out',
          whatsWrong: 'The connection pool is exhausted.',
          possibleCause: 'The retry handler opens connections outside the managed pool.',
          trace: 'The request failed while acquiring a connection.',
        },
      });

      render(<IssuePreview groupId={group.id} />, {organization});

      const summary = await screen.findByRole('region', {name: 'Summary'});
      expect(
        within(summary).getByText(
          'The connection pool is exhausted. The retry handler opens connections outside the managed pool.'
        )
      ).toBeVisible();
      expect(
        within(summary).getByText('The request failed while acquiring a connection.')
      ).toBeVisible();
      await userEvent.click(screen.getByRole('button', {name: 'Copy as Markdown'}));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining(
          '## Summary\n\nThe connection pool is exhausted. The retry handler opens connections outside the managed pool.'
        )
      );
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining(
          '## In the trace\n\nThe request failed while acquiring a connection.'
        )
      );
      await userEvent.click(
        screen.getByRole('button', {name: 'More issue context options'})
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Open in ChatGPT'})
      );
      expect(testableWindowLocation.assign).toHaveBeenCalledWith(
        `codex://new?prompt=${encodeURIComponent(
          `Fix Sentry issue ${group.shortId}: ${group.permalink}\n\nUse the Sentry MCP to fetch the issue details.\n\nSummary: The connection pool is exhausted. The retry handler opens connections outside the managed pool.`
        )}`
      );
    });
  });

  it('keeps frames expanded when historical RCA metadata has no Seer content to show', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: {...group, derivedData: fixAppliedGroup.derivedData},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: EventStacktraceExceptionFixture(),
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    const stackTrace = await screen.findByRole('region', {name: 'Stack Trace'});
    expect(within(stackTrace).getByTestId('core-stacktrace-frame-context')).toBeVisible();
  });

  it('starts the stack trace collapsed with Seer analysis and allows manual expansion', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: EventStacktraceExceptionFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {integrations: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      body: [],
    });

    localStorage.setItem('issue-details-fold-section-collapse:exception', 'false');
    render(<IssuePreview groupId={group.id} />, {organization});

    const rootCause = await screen.findByRole('region', {name: 'Root Cause'});
    expect(
      within(rootCause).getByText('The issue was caused by an unexpected value.')
    ).toBeVisible();
    expect(screen.getByRole('region', {name: 'Issue Timeline'})).not.toContainElement(
      rootCause
    );
    const stackTrace = await screen.findByRole('region', {name: 'Stack Trace'});
    await userEvent.click(
      within(stackTrace).getByRole('button', {name: 'View Stack Trace Section'})
    );
    expect(within(stackTrace).getByText('doThing')).toBeVisible();
    await userEvent.click(
      within(stackTrace).getByRole('button', {name: 'Display options'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'Raw Stack Trace'}));
    expect(within(stackTrace).getByText(/Error: an error occurred/)).toBeVisible();
    await userEvent.click(
      within(stackTrace).getByRole('button', {name: 'Collapse Stack Trace Section'})
    );
    expect(localStorage.getItem('issue-details-fold-section-collapse:exception')).toBe(
      'false'
    );
  });

  it('collapses the stack trace when Seer analysis arrives after the preview', async () => {
    const autofixResponse = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: AutofixSetupFixture({billing: {hasAutofixQuota: false}}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: EventStacktraceExceptionFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture(),
      asyncDelay: autofixResponse.promise,
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    const stackTrace = await screen.findByRole('region', {name: 'Stack Trace'});
    expect(within(stackTrace).getByText('doThing')).toBeVisible();

    autofixResponse.resolve();
    expect(
      await screen.findByText('The issue was caused by an unexpected value.')
    ).toBeVisible();
    const updatedStackTrace = screen.getByRole('region', {name: 'Stack Trace'});
    expect(
      within(updatedStackTrace).getByRole('button', {name: 'View Stack Trace Section'})
    ).toBeVisible();
    await userEvent.click(
      within(updatedStackTrace).getByRole('button', {name: 'View Stack Trace Section'})
    );
    expect(within(updatedStackTrace).getByText('doThing')).toBeVisible();
  });

  it('shows Resolve and Archive without waiting for Seer setup when AI is hidden', async () => {
    const setup = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {integration: {ok: false}, billing: null, seerReposLinked: false},
      asyncDelay: setup.promise,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });

    render(<IssuePreview groupId={group.id} />, {
      organization: OrganizationFixture({hideAiFeatures: true}),
    });

    expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
    expect(
      screen.queryByRole('button', {name: 'Find Root Cause'})
    ).not.toBeInTheDocument();

    setup.resolve();
    expect(
      await screen.findByRole('heading', {name: 'Issue Timeline'})
    ).toBeInTheDocument();
  });

  it('links to an open pull request alongside the Seer action', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({autofix: null}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '10',
              externalUrl: 'https://github.com/example/repo-name/pull/10',
            }),
            attribution: null,
            checksStatus: null,
            dateLinked: '2026-07-20T12:00:00Z',
            reviewStatus: null,
            status: 'open',
          },
        ],
      },
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(await screen.findByRole('button', {name: 'View PR'})).toHaveAttribute(
      'href',
      'https://github.com/example/repo-name/pull/10'
    );
    expect(screen.getByRole('button', {name: 'Find Root Cause'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Resolve'})).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', {name: 'Issue Timeline'})).getByRole('list', {
        name: 'Other linked pull requests',
      })
    ).toBeVisible();
  });

  it('embeds PR cards alongside Seer results without duplicating linked PR activity', async () => {
    const seerPullRequest = {
      ...linkedPullRequest,
      title: 'Fix the null lookup',
      dateLinked: '2024-01-01T00:01:00Z',
      status: 'merged',
    } satisfies LinkedPullRequest;
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: GroupFixture({
        ...group,
        activity: [
          ActivityFeedFixture({
            id: 'pr-merged',
            type: GroupActivityType.PULL_REQUEST_MERGED,
            dateCreated: '2024-01-01T00:02:00Z',
            data: {pullRequest: seerPullRequest},
          }),
          ActivityFeedFixture({
            id: 'seer-reference',
            type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
            dateCreated: '2024-01-01T00:01:00Z',
            data: {pullRequest: seerPullRequest},
          }),
          ActivityFeedFixture({
            id: 'seer-ready',
            type: GroupActivityType.SEER_PR_READY_FOR_REVIEW,
            dateCreated: '2024-01-01T00:01:00Z',
            data: {
              run_id: 42,
              pull_requests: [
                {
                  provider: 'github',
                  repo_name: seerPullRequest.repository.name,
                  pull_request: {pr_number: 10, pr_url: seerPullRequest.externalUrl},
                },
              ],
            },
          }),
          ActivityFeedFixture({
            id: 'seer-created',
            type: GroupActivityType.SEER_PR_CREATED,
            dateCreated: '2024-01-01T00:01:00Z',
            data: {
              run_id: 42,
              pull_requests: [
                {
                  provider: 'github',
                  repo_name: seerPullRequest.repository.name,
                  pull_request: {pr_number: 10, pr_url: seerPullRequest.externalUrl},
                },
              ],
            },
          }),
        ],
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          blocks: [
            ExplorerAutofixBlockFixture({
              artifacts: [],
              message: {
                role: 'assistant',
                content: 'Code changes complete',
                metadata: {step: 'code_changes'},
              },
            }),
          ],
        }),
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: [seerPullRequest]},
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    const timeline = await screen.findByTestId('activity-timeline');
    const pullRequestCard = screen.getByRole('link', {name: /Fix the null lookup$/});
    expect(timeline).toContainElement(pullRequestCard);
    expect(pullRequestCard).toHaveAttribute('href', seerPullRequest.externalUrl);
    expect(within(timeline).getByRole('region', {name: 'Code Changes'})).toBeVisible();
    expect(within(timeline).getByText('Referenced in pull request')).toAppearBefore(
      pullRequestCard
    );
  });

  it('labels and links current PRs alongside Seer actions', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          coding_agents: {
            'agent-1': {
              id: 'agent-1',
              name: 'Cursor',
              provider: 'cursor_background_agent',
              started_at: '2026-08-17T12:00:00Z',
              status: 'completed',
              results: [
                {
                  description: 'Fixed',
                  repo_full_name: 'example/repo-name',
                  repo_provider: 'github',
                  pr_number: 11,
                  pr_url: 'https://github.com/example/repo-name/pull/11',
                },
              ],
            },
          },
        }),
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        latestRegressionAt: '2026-08-16T12:00:00Z',
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '9',
              dateCreated: '2026-08-15T12:00:00Z',
              externalUrl: 'https://github.com/example/repo-name/pull/9',
            }),
            attribution: null,
            checksStatus: null,
            dateLinked: '2026-08-15T12:00:00Z',
            reviewStatus: null,
            status: 'open',
          },
          {
            ...PullRequestFixture({
              id: '10',
              dateCreated: '2026-08-16T12:00:00Z',
              externalUrl: 'https://github.com/example/repo-name/pull/10',
            }),
            attribution: null,
            checksStatus: null,
            dateLinked: '2026-08-16T12:00:00Z',
            reviewStatus: null,
            status: 'open',
          },
          {
            ...PullRequestFixture({
              id: '11',
              dateCreated: '2026-08-17T12:00:00Z',
              externalUrl: 'https://github.com/example/repo-name/pull/11',
            }),
            attribution: {id: 'seer', type: 'seer'},
            checksStatus: null,
            dateLinked: '2026-08-17T12:00:00Z',
            reviewStatus: null,
            status: 'open',
          },
        ],
      },
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(await screen.findByRole('button', {name: 'View PR #11'})).toHaveAttribute(
      'href',
      'https://github.com/example/repo-name/pull/11'
    );
    expect(screen.getByRole('button', {name: 'View PR #10'})).toHaveAttribute(
      'href',
      'https://github.com/example/repo-name/pull/10'
    );
    expect(screen.queryByRole('button', {name: 'View PR #9'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Restart Autofix'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();
  });

  it('offers a retry when Seer produced no code changes', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          blocks: [
            ExplorerAutofixBlockFixture(),
            ExplorerAutofixBlockFixture({
              id: 'code-changes',
              artifacts: [],
              message: {
                content: "Seer couldn't apply the fix automatically.",
                metadata: {step: 'code_changes'},
                role: 'assistant',
              },
            }),
          ],
        }),
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });

    const {router} = render(<IssuePreview groupId={group.id} />, {organization});

    expect(screen.queryByRole('button', {name: 'Create PR'})).not.toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Add context & retry'})
    );

    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/issues/${group.id}/`
    );
    expect(router.location.query).toEqual({
      referrer: 'inbox',
      seerDrawer: 'true',
      seerDrawerAction: 'retry_code_changes',
    });
  });

  describe('failed pull request', () => {
    function mockFailedPullRequest(featureId: string | null) {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
        body: ExplorerAutofixResponseFixture({
          autofix: ExplorerAutofixStateFixture({
            feature_id: featureId,
            repo_pr_states: {
              'org/repo': {
                repo_name: 'org/repo',
                pr_number: null,
                pr_url: null,
                branch_name: null,
                commit_sha: null,
                pr_creation_error: 'Push failed',
                pr_creation_status: 'error',
                pr_id: null,
                title: null,
              },
            },
          }),
        }),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
        body: {pullRequests: []},
      });
    }

    it('offers Retry PR on a step-based run', async () => {
      mockFailedPullRequest(null);

      render(<IssuePreview groupId={group.id} />, {organization});

      expect(
        await screen.findByRole('button', {name: 'Retry PR in org/repo'})
      ).toBeInTheDocument();
    });

    it('does not offer Retry PR on a single run', async () => {
      mockFailedPullRequest('autofix_single_run');

      render(<IssuePreview groupId={group.id} />, {organization});

      expect(await screen.findByText('Resolve')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Retry PR in org/repo'})
      ).not.toBeInTheDocument();
    });
  });

  it('offers to restart Seer when the linked PR is closed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          blocks: [
            ExplorerAutofixBlockFixture(),
            ExplorerAutofixBlockFixture({
              id: 'solution',
              message: {
                content: 'Plan complete',
                metadata: {step: 'solution'},
                role: 'assistant',
              },
            }),
            ExplorerAutofixBlockFixture({
              id: 'code-changes',
              message: {
                content: 'Code changes complete',
                metadata: {step: 'code_changes'},
                role: 'assistant',
              },
            }),
            ExplorerAutofixBlockFixture({
              id: 'completed',
              message: {
                content: 'Autofix complete',
                metadata: {step: 'completed'},
                role: 'assistant',
              },
            }),
          ],
        }),
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '10',
              externalUrl: 'https://github.com/example/repo-name/pull/10',
            }),
            attribution: {id: 'seer', type: 'seer'},
            checksStatus: null,
            dateLinked: '2026-07-20T12:00:00Z',
            reviewStatus: null,
            status: 'closed',
          },
        ],
      },
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(
      await screen.findByRole('button', {name: 'Restart Autofix'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();
  });

  describe('issue actions', () => {
    const organizationWithoutAi = OrganizationFixture({hideAiFeatures: true});

    describe('Copy as Markdown', () => {
      beforeEach(() => {
        Object.assign(navigator, {
          clipboard: {writeText: jest.fn().mockResolvedValue(undefined)},
        });
      });

      it('copies the issue and the selected thread stacktrace', async () => {
        const eventRequest = MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
          body: EventFixture({
            entries: [
              {
                type: EntryType.THREADS,
                data: {
                  values: [
                    {
                      id: 1,
                      name: 'worker',
                      crashed: false,
                      stacktrace: {
                        frames: [
                          FrameFixture({
                            function: 'processTask',
                            filename: 'src/worker.ts',
                            lineNo: 12,
                            inApp: true,
                          }),
                        ],
                      },
                    },
                    {
                      id: 2,
                      name: 'main',
                      crashed: true,
                      stacktrace: {
                        frames: [
                          FrameFixture({
                            function: 'handleRequest',
                            filename: 'src/handler.ts',
                            lineNo: 42,
                            inApp: true,
                          }),
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          }),
        });

        render(<IssuePreview groupId={group.id} />, {
          organization: organizationWithoutAi,
          initialRouterConfig: {
            location: {
              pathname: `/organizations/${organization.slug}/issues/inbox/`,
              query: {statsPeriod: '24h', environment: 'production'},
            },
          },
        });

        const copyButton = await screen.findByRole('button', {
          name: 'Copy as Markdown',
        });
        await waitFor(() => expect(copyButton).toBeEnabled());
        await userEvent.click(copyButton);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining(`**Short ID:** ${group.shortId}`)
        );
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('## Thread: main (crashed)')
        );
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('handleRequest in src/handler.ts [Line 42]')
        );
        expect(
          await screen.findByText('Copied issue to clipboard as Markdown')
        ).toBeInTheDocument();

        await userEvent.click(
          await screen.findByRole('button', {name: 'Thread #2: main'})
        );
        await userEvent.click(screen.getByRole('option', {name: /#1.*worker/}));
        await userEvent.click(copyButton);

        expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
          expect.stringContaining('## Thread: worker')
        );
        expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
          expect.stringContaining('processTask in src/worker.ts [Line 12]')
        );
        expect(eventRequest).toHaveBeenCalledTimes(1);
        expect(eventRequest).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            query: {collapse: ['fullRelease'], llmFormat: 'markdown'},
          })
        );
      });

      it('copies existing Seer analysis without quota using the client formatter', async () => {
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
          body: AutofixSetupFixture({billing: {hasAutofixQuota: false}}),
        });
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/`,
          body: GroupFixture({
            ...group,
            derivedData: {
              ...fixAppliedGroup.derivedData!,
              progress: ProgressState.DIAGNOSED,
            },
          }),
        });
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
          body: ExplorerAutofixResponseFixture({
            formatted: {content: '# Existing Seer analysis', format: 'markdown'},
          }),
        });

        render(<IssuePreview groupId={group.id} />, {organization});

        const actions = await screen.findByRole('group', {name: 'Issue actions'});
        const copyButton = within(actions).getByRole('button', {
          name: 'Copy as Markdown',
        });
        await waitFor(() => expect(copyButton).toBeEnabled());
        await userEvent.click(copyButton);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('The issue was caused by an unexpected value.')
        );
      });

      it('copies existing Seer analysis without quota using the server formatter', async () => {
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
          body: AutofixSetupFixture({billing: {hasAutofixQuota: false}}),
        });
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/`,
          body: GroupFixture({
            ...group,
            derivedData: {
              ...fixAppliedGroup.derivedData!,
              progress: ProgressState.DIAGNOSED,
            },
          }),
        });
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
          body: ExplorerAutofixResponseFixture({
            formatted: {content: '# Existing Seer analysis', format: 'markdown'},
          }),
        });
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
          body: EventFixture({
            formatted: {content: '# Recommended event', format: 'markdown'},
          }),
        });

        render(<IssuePreview groupId={group.id} />, {organization});

        const actions = await screen.findByRole('group', {name: 'Issue actions'});
        const copyButton = within(actions).getByRole('button', {
          name: 'Copy as Markdown',
        });
        await waitFor(() => expect(copyButton).toBeEnabled());
        await userEvent.click(copyButton);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('# Recommended event')
        );
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('# Existing Seer analysis')
        );
      });

      it('copies issue information when the recommended event cannot be loaded', async () => {
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
          statusCode: 404,
        });

        render(<IssuePreview groupId={group.id} />, {
          organization: organizationWithoutAi,
        });

        const copyButton = await screen.findByRole('button', {name: 'Copy as Markdown'});
        await waitFor(() => expect(copyButton).toBeEnabled());
        await userEvent.click(copyButton);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining(`# ${group.title}`)
        );
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining(`**Short ID:** ${group.shortId}`)
        );
      });

      it('disables Copy without loading an event while reprocessing', async () => {
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/`,
          body: GroupFixture({
            ...group,
            status: GroupStatus.REPROCESSING,
            statusDetails: {info: null, pendingEvents: 1},
          }),
        });
        const eventRequest = MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
          body: EventFixture(),
        });

        render(<IssuePreview groupId={group.id} />, {
          organization: organizationWithoutAi,
        });

        expect(
          await screen.findByRole('button', {name: 'Copy as Markdown'})
        ).toBeDisabled();
        expect(eventRequest).not.toHaveBeenCalled();
        expect(
          screen.getByRole('button', {name: 'More issue context options'})
        ).toBeDisabled();
      });
    });
  });

  it('keeps Resolve and Archive available while PRs load', async () => {
    const pullRequests = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: [linkedPullRequest]},
      asyncDelay: pullRequests.promise,
    });

    render(<IssuePreview groupId={group.id} />, {
      organization: OrganizationFixture({hideAiFeatures: true}),
    });

    expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();

    pullRequests.resolve();
    expect(await screen.findByRole('button', {name: 'View PR'})).toHaveAttribute(
      'href',
      linkedPullRequest.externalUrl
    );
  });

  it('shows a human-linked draft PR with Resolve and Archive without Seer quota', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: GroupFixture({
        ...group,
        derivedData: {
          ...fixAppliedGroup.derivedData!,
          progress: ProgressState.FIX_PROPOSED,
          hasOpenFixPr: true,
          hasRootCause: false,
        },
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: AutofixSetupFixture({billing: {hasAutofixQuota: false}}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: [{...linkedPullRequest, status: 'draft'}]},
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(await screen.findByRole('button', {name: 'View PR'})).toHaveAttribute(
      'href',
      linkedPullRequest.externalUrl
    );
    expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
    expect(
      screen.queryByRole('button', {name: 'Find Root Cause'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy as Markdown'})
    ).not.toBeInTheDocument();
  });

  it('requires connected repositories before offering Seer on a proposed fix', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: AutofixSetupFixture({seerReposLinked: false}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: GroupFixture({
        ...group,
        derivedData: {
          ...fixAppliedGroup.derivedData!,
          progress: ProgressState.FIX_PROPOSED,
          hasOpenFixPr: true,
          hasRootCause: false,
        },
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [linkedPullRequest],
      },
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(await screen.findByRole('button', {name: 'View PR'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Resolve'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Archive'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Find Root Cause'})
    ).not.toBeInTheDocument();
  });

  it('keeps matched Seer analysis readable without quota and disables rerunning it', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: {
        ...GroupFixture({
          ...group,
          derivedData: {
            ...fixAppliedGroup.derivedData!,
            progress: ProgressState.DIAGNOSED,
          },
        }),
        activity: [
          {
            ...ActivityFeedFixture({
              type: GroupActivityType.SEER_RCA_COMPLETED,
              dateCreated: '2024-01-01T00:01:00Z',
            }),
            data: {run_id: '42'},
          },
        ],
      },
    });
    const description = 'The user lookup returned an unexpected null value.';
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: AutofixSetupFixture({billing: {hasAutofixQuota: false}}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          blocks: [
            ExplorerAutofixBlockFixture({
              artifacts: [
                AutofixRootCauseArtifactFixture({
                  data: {
                    one_line_description: description,
                    five_whys: [],
                    reproduction_steps: [],
                  },
                }),
              ],
            }),
          ],
        }),
      }),
    });
    render(<IssuePreview groupId={group.id} />, {organization});

    expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
    expect(await screen.findByText(description)).toBeVisible();
    const rootCause = within(
      screen.getByRole('region', {name: 'Issue Timeline'})
    ).getByRole('region', {name: 'Root Cause'});
    expect(screen.getAllByRole('region', {name: 'Root Cause'})).toHaveLength(1);
    expect(within(rootCause).getByRole('button', {name: 'Re-run step'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(
      within(rootCause).getByRole('button', {name: 'Copy as Markdown'})
    ).toBeEnabled();
    expect(screen.queryByRole('button', {name: 'Make a Plan'})).not.toBeInTheDocument();
  });

  it('resolves an assigned issue alongside Seer and can undo it', async () => {
    const unresolvedGroup = GroupFixture({
      ...fixAppliedGroup,
      derivedData: {...fixAppliedGroup.derivedData!, progress: ProgressState.ASSIGNED},
    });
    const resolvedGroup = GroupFixture({
      ...unresolvedGroup,
      status: GroupStatus.RESOLVED,
      statusDetails: {},
      substatus: null,
    });
    let currentGroup = unresolvedGroup;
    mockFixAppliedPreview(() => currentGroup);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: true, reason: null},
        billing: {hasAutofixQuota: true},
        seerReposLinked: true,
      },
    });
    const resolveRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: () => currentGroup,
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    const resolveButton = await screen.findByRole('button', {name: 'Resolve'});
    expect(resolveButton).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Issue'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${group.id}/?referrer=inbox`
    );
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Find Root Cause'})
    ).toBeInTheDocument();

    currentGroup = resolvedGroup;
    await userEvent.click(resolveButton);

    expect(resolveRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );
    const unresolveButton = await screen.findByRole('button', {name: 'Unresolve'});
    currentGroup = unresolvedGroup;
    await userEvent.click(unresolveButton);

    expect(await screen.findByRole('button', {name: 'Resolve'})).toBeInTheDocument();
    expect(resolveRequest).toHaveBeenLastCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'unresolved', statusDetails: {}, substatus: 'ongoing'},
      })
    );
  });

  it('resolves a diagnosed issue alongside Seer and can undo it', async () => {
    const unresolvedGroup = GroupFixture({
      ...fixAppliedGroup,
      derivedData: {...fixAppliedGroup.derivedData!, progress: ProgressState.DIAGNOSED},
    });
    const resolvedGroup = GroupFixture({
      ...unresolvedGroup,
      status: GroupStatus.RESOLVED,
      statusDetails: {},
      substatus: null,
    });
    let currentGroup = unresolvedGroup;
    mockFixAppliedPreview(() => currentGroup);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: true, reason: null},
        billing: {hasAutofixQuota: true},
        seerReposLinked: true,
      },
    });
    const resolveRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: () => currentGroup,
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    const resolveButton = await screen.findByRole('button', {name: 'Resolve'});
    expect(resolveButton).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Issue'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${group.id}/?referrer=inbox`
    );
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Find Root Cause'})
    ).toBeInTheDocument();

    currentGroup = resolvedGroup;
    await userEvent.click(resolveButton);

    expect(resolveRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );
    const unresolveButton = await screen.findByRole('button', {name: 'Unresolve'});
    currentGroup = unresolvedGroup;
    await userEvent.click(unresolveButton);

    expect(await screen.findByRole('button', {name: 'Resolve'})).toBeInTheDocument();
    expect(resolveRequest).toHaveBeenLastCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'unresolved', statusDetails: {}, substatus: 'ongoing'},
      })
    );
  });

  it('resolves an issue with a proposed fix alongside Seer and can undo it', async () => {
    const unresolvedGroup = GroupFixture({
      ...fixAppliedGroup,
      derivedData: {
        ...fixAppliedGroup.derivedData!,
        progress: ProgressState.FIX_PROPOSED,
      },
    });
    const resolvedGroup = GroupFixture({
      ...unresolvedGroup,
      status: GroupStatus.RESOLVED,
      statusDetails: {},
      substatus: null,
    });
    let currentGroup = unresolvedGroup;
    mockFixAppliedPreview(() => currentGroup);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: true, reason: null},
        billing: {hasAutofixQuota: true},
        seerReposLinked: true,
      },
    });
    const resolveRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: () => currentGroup,
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    const resolveButton = await screen.findByRole('button', {name: 'Resolve'});
    expect(resolveButton).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Issue'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${group.id}/?referrer=inbox`
    );
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Find Root Cause'})
    ).toBeInTheDocument();

    currentGroup = resolvedGroup;
    await userEvent.click(resolveButton);

    expect(resolveRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );
    const unresolveButton = await screen.findByRole('button', {name: 'Unresolve'});
    currentGroup = unresolvedGroup;
    await userEvent.click(unresolveButton);

    expect(await screen.findByRole('button', {name: 'Resolve'})).toBeInTheDocument();
    expect(resolveRequest).toHaveBeenLastCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'unresolved', statusDetails: {}, substatus: 'ongoing'},
      })
    );
  });

  it('resolves an issue with an applied fix alongside Seer and can undo it', async () => {
    const unresolvedGroup = GroupFixture({
      ...fixAppliedGroup,
      derivedData: {...fixAppliedGroup.derivedData!, progress: ProgressState.FIX_APPLIED},
    });
    const resolvedGroup = GroupFixture({
      ...unresolvedGroup,
      status: GroupStatus.RESOLVED,
      statusDetails: {},
      substatus: null,
    });
    let currentGroup = unresolvedGroup;
    mockFixAppliedPreview(() => currentGroup);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: true, reason: null},
        billing: {hasAutofixQuota: true},
        seerReposLinked: true,
      },
    });
    const resolveRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: () => currentGroup,
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    const resolveButton = await screen.findByRole('button', {name: 'Resolve'});
    expect(resolveButton).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Issue'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${group.id}/?referrer=inbox`
    );
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Find Root Cause'})
    ).not.toBeInTheDocument();

    currentGroup = resolvedGroup;
    await userEvent.click(resolveButton);

    expect(resolveRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );
    const unresolveButton = await screen.findByRole('button', {name: 'Unresolve'});
    currentGroup = unresolvedGroup;
    await userEvent.click(unresolveButton);

    expect(await screen.findByRole('button', {name: 'Resolve'})).toBeInTheDocument();
    expect(resolveRequest).toHaveBeenLastCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'unresolved', statusDetails: {}, substatus: 'ongoing'},
      })
    );
  });

  it('keeps Resolve available while Seer is processing', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({status: 'processing'}),
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    const resolveRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: GroupFixture({...group, status: GroupStatus.RESOLVED, statusDetails: {}}),
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(await screen.findByRole('button', {name: 'Make a Plan'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'More resolve options'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));
    expect(resolveRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );
  });

  it('disables Resolve while the issue is reprocessing', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: GroupFixture({
        ...group,
        status: GroupStatus.REPROCESSING,
        statusDetails: {info: null, pendingEvents: 1},
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({autofix: null}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(await screen.findByRole('button', {name: 'Resolve'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('button', {name: 'More resolve options'})).toBeDisabled();
  });

  it('does not report success when resolving a diagnosed issue fails', async () => {
    mockFixAppliedPreview(() =>
      GroupFixture({
        ...fixAppliedGroup,
        derivedData: {...fixAppliedGroup.derivedData!, progress: ProgressState.DIAGNOSED},
      })
    );
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      statusCode: 500,
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

    expect(
      await screen.findByText('Unable to update events. Please try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Issue resolved')).not.toBeInTheDocument();
  });

  it('does not report success when resolving an issue with an applied fix fails', async () => {
    mockFixAppliedPreview(() =>
      GroupFixture({
        ...fixAppliedGroup,
        derivedData: {
          ...fixAppliedGroup.derivedData!,
          progress: ProgressState.FIX_APPLIED,
        },
      })
    );
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      statusCode: 500,
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

    expect(
      await screen.findByText('Unable to update events. Please try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Issue resolved')).not.toBeInTheDocument();
  });
});
