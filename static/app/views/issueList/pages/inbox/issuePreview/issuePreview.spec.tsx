import {
  ExplorerAutofixBlockFixture,
  ExplorerAutofixResponseFixture,
  ExplorerAutofixStateFixture,
} from 'sentry-fixture/autofix';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {clearIndicators} from 'sentry/actionCreators/indicator';
import {ProjectsStore} from 'sentry/stores/projectsStore';
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
  const resolvedFixAppliedGroup = GroupFixture({
    id: group.id,
    project,
    hasSeen: true,
    derivedData: fixAppliedGroup.derivedData,
    status: GroupStatus.RESOLVED,
    statusDetails: {},
    substatus: null,
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
            ...linkedPullRequest,
            externalUrl: 'https://github.com/org/repository/pull/10',
            attribution: {id: 'seer', type: 'seer'},
            status: 'merged',
          },
        ],
      },
    });
  }

  beforeEach(() => {
    clearIndicators();
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
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

  it('keeps Resolve available while PRs load for Seer actions', async () => {
    const pullRequests = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({autofix: null}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {pullRequests: [linkedPullRequest]},
      asyncDelay: pullRequests.promise,
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();

    pullRequests.resolve();
    expect(await screen.findByRole('button', {name: 'View PR'})).toBeInTheDocument();
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
    expect(await screen.findByRole('button', {name: 'View PR'})).toBeInTheDocument();
  });

  it('links to an open pull request alongside the Seer action', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({autofix: null}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [linkedPullRequest],
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
            ...linkedPullRequest,
            id: '9',
            dateCreated: '2026-08-15T12:00:00Z',
            externalUrl: 'https://github.com/example/repo-name/pull/9',
            dateLinked: '2026-08-15T12:00:00Z',
          },
          {
            ...linkedPullRequest,
            dateCreated: '2026-08-16T12:00:00Z',
            dateLinked: '2026-08-16T12:00:00Z',
          },
          {
            ...linkedPullRequest,
            id: '11',
            dateCreated: '2026-08-17T12:00:00Z',
            externalUrl: 'https://github.com/example/repo-name/pull/11',
            attribution: {id: 'seer', type: 'seer'},
            dateLinked: '2026-08-17T12:00:00Z',
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

  it('labels and links current PRs alongside Resolve and Archive', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        latestRegressionAt: '2026-08-16T12:00:00Z',
        pullRequests: [
          {
            ...linkedPullRequest,
            id: '9',
            dateCreated: '2026-08-15T12:00:00Z',
            externalUrl: 'https://github.com/example/repo-name/pull/9',
            dateLinked: '2026-08-15T12:00:00Z',
          },
          {
            ...linkedPullRequest,
            dateCreated: '2026-08-16T12:00:00Z',
            dateLinked: '2026-08-16T12:00:00Z',
          },
          {
            ...linkedPullRequest,
            id: '11',
            dateCreated: '2026-08-17T12:00:00Z',
            externalUrl: 'https://github.com/example/repo-name/pull/11',
            attribution: {id: 'seer', type: 'seer'},
            dateLinked: '2026-08-17T12:00:00Z',
          },
        ],
      },
    });

    render(<IssuePreview groupId={group.id} />, {
      organization: OrganizationFixture({hideAiFeatures: true}),
    });

    expect(await screen.findByRole('button', {name: 'View PR #11'})).toHaveAttribute(
      'href',
      'https://github.com/example/repo-name/pull/11'
    );
    expect(screen.getByRole('button', {name: 'View PR #10'})).toHaveAttribute(
      'href',
      'https://github.com/example/repo-name/pull/10'
    );
    expect(screen.queryByRole('button', {name: 'View PR #9'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Archive'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Restart Autofix'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();
  });

  describe('issue actions', () => {
    const organizationWithoutAi = OrganizationFixture({hideAiFeatures: true});

    it('shows an open PR alongside Resolve and Archive', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
        body: {pullRequests: [linkedPullRequest]},
      });

      render(<IssuePreview groupId={group.id} />, {organization: organizationWithoutAi});

      expect(await screen.findByRole('button', {name: 'View PR'})).toHaveAttribute(
        'href',
        linkedPullRequest.externalUrl
      );
      expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
      expect(
        screen.queryByRole('button', {name: 'Find Root Cause'})
      ).not.toBeInTheDocument();
    });

    it('shows a draft PR alongside Resolve and Archive', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
        body: {pullRequests: [{...linkedPullRequest, status: 'draft'}]},
      });

      render(<IssuePreview groupId={group.id} />, {organization: organizationWithoutAi});

      expect(await screen.findByRole('button', {name: 'View PR'})).toHaveAttribute(
        'href',
        linkedPullRequest.externalUrl
      );
      expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
    });

    it('shows a PR when Seer needs configuration', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/onboarding-check/`,
        body: {isSeerConfigured: false},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/`,
        body: GroupFixture({
          ...group,
          derivedData: {
            ...fixAppliedGroup.derivedData!,
            progress: ProgressState.ASSIGNED,
          },
        }),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
        body: ExplorerAutofixResponseFixture({autofix: null}),
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

    it('keeps closed PRs out of the header', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
        body: {pullRequests: [{...linkedPullRequest, status: 'closed'}]},
      });

      render(<IssuePreview groupId={group.id} />, {organization: organizationWithoutAi});

      expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
      expect(screen.queryByRole('button', {name: /View PR/})).not.toBeInTheDocument();
    });

    it('keeps merged PRs out of the header', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
        body: {pullRequests: [{...linkedPullRequest, status: 'merged'}]},
      });

      render(<IssuePreview groupId={group.id} />, {organization: organizationWithoutAi});

      expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
      expect(screen.queryByRole('button', {name: /View PR/})).not.toBeInTheDocument();
    });

    it('keeps Resolve and Archive available when no PRs are linked', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
        body: {pullRequests: []},
      });

      render(<IssuePreview groupId={group.id} />, {organization: organizationWithoutAi});

      expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
      expect(screen.queryByRole('button', {name: /View PR/})).not.toBeInTheDocument();
    });

    it('keeps Resolve and Archive available when PRs cannot be loaded', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
        statusCode: 500,
      });

      render(<IssuePreview groupId={group.id} />, {organization: organizationWithoutAi});

      expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
      expect(screen.queryByRole('button', {name: /View PR/})).not.toBeInTheDocument();
    });
  });

  it('offers a retry instead of a PR when Autofix produced no code changes', async () => {
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

  it('offers to restart Autofix after PR creation when the linked PR is closed', async () => {
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

  it.each([
    ProgressState.ASSIGNED,
    ProgressState.DIAGNOSED,
    ProgressState.FIX_PROPOSED,
    ProgressState.FIX_APPLIED,
  ])('resolves a %s issue and offers to undo it', async progress => {
    const unresolvedGroup = GroupFixture({
      ...fixAppliedGroup,
      derivedData: {...fixAppliedGroup.derivedData!, progress},
    });
    const resolvedGroup = GroupFixture({
      ...resolvedFixAppliedGroup,
      derivedData: unresolvedGroup.derivedData,
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
      body: (_url: string, options: {data: Pick<Group, 'status'>}) => {
        currentGroup =
          options.data.status === GroupStatus.RESOLVED ? resolvedGroup : unresolvedGroup;
        return currentGroup;
      },
    });

    render(<IssuePreview groupId={group.id} />, {organization});

    const resolveButton = await screen.findByRole('button', {name: 'Resolve'});
    expect(resolveButton).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Issue'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${group.id}/?referrer=inbox`
    );
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();
    if (progress !== ProgressState.FIX_APPLIED) {
      expect(screen.getByRole('button', {name: 'Find Root Cause'})).toBeInTheDocument();
    }

    await userEvent.click(resolveButton);

    expect(resolveRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Unresolve'}));

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

  it.each([ProgressState.DIAGNOSED, ProgressState.FIX_APPLIED])(
    'does not report success when resolving a %s issue fails',
    async progress => {
      mockFixAppliedPreview(() =>
        GroupFixture({
          ...fixAppliedGroup,
          derivedData: {...fixAppliedGroup.derivedData!, progress},
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
    }
  );
});
