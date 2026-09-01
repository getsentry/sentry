import {Fragment} from 'react';
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
import Indicators from 'sentry/components/indicators';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {GroupStatus, ProgressState, type Group} from 'sentry/types/group';

import {IssuePreview} from './issuePreview';

describe('IssuePreview', () => {
  const organization = OrganizationFixture({features: ['gen-ai-features']});
  const project = ProjectFixture({id: '1'});
  const group = GroupFixture({id: '101', project, hasSeen: true});
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

  it('links to an open user pull request and shows the next Autofix step', async () => {
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
  });

  it('labels and links each CTA when multiple pull requests exist', async () => {
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
        pullRequests: [
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
    expect(screen.getByRole('button', {name: 'Restart Autofix'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'View PR'})).not.toBeInTheDocument();
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

  it('resolves a fix applied issue and offers to undo it', async () => {
    let currentGroup = fixAppliedGroup;
    mockFixAppliedPreview(() => currentGroup);
    const resolveRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: (_url: string, options: {data: Pick<Group, 'status'>}) => {
        currentGroup =
          options.data.status === GroupStatus.RESOLVED
            ? resolvedFixAppliedGroup
            : fixAppliedGroup;
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

  it('does not report success when resolving fails', async () => {
    mockFixAppliedPreview();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      statusCode: 500,
    });

    render(
      <Fragment>
        <IssuePreview groupId={group.id} />
        <Indicators />
      </Fragment>,
      {organization}
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

    expect(
      await screen.findByText('Unable to update events. Please try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Issue resolved')).not.toBeInTheDocument();
  });
});
