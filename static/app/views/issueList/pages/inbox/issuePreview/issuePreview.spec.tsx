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
import {GroupStatus, ProgressState, type Group} from 'sentry/types/group';
import type {LinkedPullRequest} from 'sentry/types/integrations';

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

  it('shows the recommended stack trace when AI features are hidden', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: EventStacktraceExceptionFixture(),
    });

    localStorage.setItem('issue-details-fold-section-collapse:exception', 'true');
    render(<IssuePreview groupId={group.id} />, {
      organization: OrganizationFixture({hideAiFeatures: true}),
    });

    const stackTrace = await screen.findByRole('region', {name: 'Stack Trace'});
    expect(within(stackTrace).getByText('an error occurred')).toBeVisible();
    expect(within(stackTrace).getByText('doThing')).toBeVisible();
  });

  it('shows the recommended stack trace alongside Seer analysis', async () => {
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

    render(<IssuePreview groupId={group.id} />, {organization});

    const rootCause = await screen.findByRole('region', {name: 'Root Cause'});
    expect(
      within(rootCause).getByText('The issue was caused by an unexpected value.')
    ).toBeVisible();
    const stackTrace = await screen.findByRole('region', {name: 'Stack Trace'});
    expect(within(stackTrace).getByText('doThing')).toBeVisible();
    await userEvent.click(
      within(stackTrace).getByRole('button', {name: 'Display options'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'Raw Stack Trace'}));
    expect(within(stackTrace).getByText(/Error: an error occurred/)).toBeVisible();
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
    expect(await screen.findByRole('heading', {name: 'Activity'})).toBeInTheDocument();
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
        MockApiClient.addMockResponse({
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

  it('keeps previous Seer analysis readable without quota and disables rerunning it', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: GroupFixture({
        ...group,
        derivedData: {...fixAppliedGroup.derivedData!, progress: ProgressState.DIAGNOSED},
      }),
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
    const rootCause = screen.getByRole('region', {name: 'Root Cause'});
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
