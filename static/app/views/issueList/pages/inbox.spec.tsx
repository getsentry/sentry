import {
  AutofixRepoPRStateFixture,
  ExplorerAutofixResponseFixture,
  ExplorerAutofixStateFixture,
} from 'sentry-fixture/autofix';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ProgressState} from 'sentry/types/group';

import InboxPage from './inbox';

describe('InboxPage', () => {
  const organization = OrganizationFixture({
    features: ['issue-stream-progress-ui'],
  });
  const seerOrganization = OrganizationFixture({
    features: ['issue-stream-progress-ui', 'gen-ai-features'],
  });
  const project = ProjectFixture({
    id: '1',
    slug: 'project-slug',
    environments: ['production'],
  });
  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/issues/inbox/',
      query: {
        project: project.id,
        environment: 'production',
        statsPeriod: '7d',
      },
    },
  };
  const assignedUser = UserFixture({
    id: '10',
    name: 'Jane Doe',
    avatar: {
      avatarType: 'upload',
      avatarUrl: 'https://example.com/avatar.jpg',
      avatarUuid: '123',
    },
  });
  const fixProposedGroup = GroupFixture({
    id: '101',
    shortId: 'PROJECT-101',
    project,
    culprit: 'src/fixProposed.ts',
    firstSeen: '2026-07-18T12:00:00Z',
    hasSeen: false,
    lastSeen: '2026-07-19T12:00:00Z',
    level: 'error',
    assignedTo: {id: '10', name: 'Jane Doe', type: 'user'},
    metadata: {
      type: 'TypeError',
      title: 'Fix proposed issue',
      value: 'Fix proposed message',
    },
    derivedData: {
      progress: ProgressState.FIX_PROPOSED,
      status: 'open',
      viewCount: 1,
      hasOpenFixPr: true,
      isAssigned: true,
      hasRootCause: true,
      lastProgressedAt: null,
    },
  });
  const diagnosedGroup = GroupFixture({
    id: '102',
    shortId: 'PROJECT-102',
    project,
    hasSeen: true,
    metadata: {
      type: 'Error',
      title: 'Diagnosed issue',
      value: 'Diagnosed message',
    },
    derivedData: {
      progress: ProgressState.DIAGNOSED,
      status: 'open',
      viewCount: 0,
      hasOpenFixPr: false,
      isAssigned: false,
      hasRootCause: true,
      lastProgressedAt: null,
    },
  });
  const assignedGroup = GroupFixture({
    id: '103',
    shortId: 'PROJECT-103',
    project,
    hasSeen: true,
    metadata: {
      type: 'Error',
      title: 'Assigned issue',
      value: 'Assigned message',
    },
    derivedData: {
      progress: ProgressState.ASSIGNED,
      status: 'open',
      viewCount: 0,
      hasOpenFixPr: false,
      isAssigned: true,
      hasRootCause: false,
      lastProgressedAt: null,
    },
  });

  beforeEach(() => {
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [Number(project.id)],
      environments: ['production'],
      datetime: {period: '7d', start: null, end: null, utc: false},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [MemberFixture({id: assignedUser.id, user: assignedUser})],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  function mockSection(
    query: string,
    body: unknown,
    statusCode = 200,
    total = Array.isArray(body) ? body.length : 0
  ) {
    return MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      match: [MockApiClient.matchQuery({query})],
      body,
      headers: {'X-Hits': String(total)},
      statusCode,
    });
  }

  function mockSuccessfulSections() {
    return [
      mockSection('issue.progress:fix_proposed assigned:me', [fixProposedGroup], 200, 2),
      mockSection('issue.progress:diagnosed assigned:me', [diagnosedGroup], 200, 2),
      mockSection('issue.progress:assigned assigned:me', [assignedGroup], 200, 12),
    ];
  }

  function mockIssuePreview() {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/`,
      body: fixProposedGroup,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/events/recommended/`,
      body: EventFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/external-issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
  }

  function mockAutofixResponse(body: ReturnType<typeof ExplorerAutofixResponseFixture>) {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/autofix/`,
      body,
    });
  }

  async function openFixProposedPreview() {
    const preview = screen.getByRole('complementary', {
      name: 'Issue preview',
    });
    const issueLink = await within(
      screen.getByRole('region', {name: 'Fix Proposed'})
    ).findByRole('link', {name: /Fix proposed issue/});

    await userEvent.click(issueLink);

    return preview;
  }

  it('loads and renders the three progress sections with filtered issue metadata', async () => {
    const requests = mockSuccessfulSections();

    render(<InboxPage />, {organization, initialRouterConfig});

    expect(screen.getByLabelText('Loading Fix Proposed issues')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading Diagnosed issues')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading Assigned issues')).toBeInTheDocument();

    expect(await screen.findByText('Fix proposed issue')).toBeInTheDocument();
    expect(await screen.findByText('Diagnosed issue')).toBeInTheDocument();
    const assignedIssue = await screen.findByText('Assigned issue');
    expect(assignedIssue).not.toBeVisible();
    expect(screen.getByRole('heading', {name: 'Inbox', level: 1})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Issues', level: 2})).toBeInTheDocument();

    for (const [index, query] of [
      'issue.progress:fix_proposed assigned:me',
      'issue.progress:diagnosed assigned:me',
      'issue.progress:assigned assigned:me',
    ].entries()) {
      await waitFor(() =>
        expect(requests[index]).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            method: 'GET',
            query: expect.objectContaining({
              project: [1],
              environment: ['production'],
              statsPeriod: '7d',
              query,
              sort: 'progress',
              limit: 5,
              expand: ['owners', 'derivedData'],
            }),
          })
        )
      );
      expect(requests[index]).toHaveBeenCalledTimes(1);
    }

    const fixSection = screen.getByRole('region', {name: 'Fix Proposed'});
    const diagnosedSection = screen.getByRole('region', {name: 'Diagnosed'});
    const assignedSection = screen.getByRole('region', {name: 'Assigned'});
    expect(
      within(fixSection).getByRole('heading', {
        name: 'Fix Proposed',
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      within(fixSection).getByRole('heading', {
        name: 'Fix proposed issue',
        level: 4,
      })
    ).toBeInTheDocument();
    expect(within(fixSection).getByText('2')).toBeInTheDocument();
    expect(within(diagnosedSection).getByText('2')).toBeInTheDocument();
    expect(within(assignedSection).getByText('12')).toBeInTheDocument();
    expect(within(fixSection).getByText('Fix proposed message')).toBeInTheDocument();
    expect(within(fixSection).getByText('PROJECT-101')).toBeInTheDocument();
    expect(within(fixSection).getByTitle('Jane Doe')).toBeInTheDocument();
    expect(within(fixSection).getByRole('img', {name: 'Jane Doe'})).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg?s=120'
    );
    expect(within(fixSection).getByLabelText('Unread issue')).toBeInTheDocument();
    expect(within(fixSection).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(fixSection.querySelectorAll('time')).toHaveLength(2);
  });

  it('expands and collapses progress sections', async () => {
    mockSuccessfulSections();

    render(<InboxPage />, {organization, initialRouterConfig});

    const fixProposedButton = screen.getByRole('button', {
      name: 'Fix Proposed',
    });
    const assignedButton = screen.getByRole('button', {name: 'Assigned'});
    const fixProposedIssue = await screen.findByText('Fix proposed issue');
    const assignedIssue = screen.getByText('Assigned issue');

    expect(fixProposedButton).toHaveAttribute('aria-expanded', 'true');
    expect(fixProposedIssue).toBeVisible();
    expect(assignedButton).toHaveAttribute('aria-expanded', 'false');
    expect(assignedIssue).not.toBeVisible();

    await userEvent.click(fixProposedButton);
    await userEvent.click(assignedButton);

    expect(fixProposedButton).toHaveAttribute('aria-expanded', 'false');
    expect(fixProposedIssue).not.toBeVisible();
    expect(assignedButton).toHaveAttribute('aria-expanded', 'true');
    expect(assignedIssue).toBeVisible();
  });

  it('filters sections by the selected assignee', async () => {
    mockSuccessfulSections();
    const myTeamsRequests = [
      mockSection('issue.progress:fix_proposed assigned:my_teams', [fixProposedGroup]),
      mockSection('issue.progress:diagnosed assigned:my_teams', [diagnosedGroup]),
      mockSection('issue.progress:assigned assigned:my_teams', [assignedGroup]),
    ];

    const {router} = render(<InboxPage />, {
      organization,
      initialRouterConfig,
    });

    const meFilter = screen.getByRole('radio', {name: 'Me'});
    const myTeamsFilter = screen.getByRole('radio', {name: 'My Teams'});
    expect(meFilter).toBeChecked();
    expect(myTeamsFilter).not.toBeChecked();
    expect(await screen.findByText('Fix proposed issue')).toBeInTheDocument();

    await userEvent.click(myTeamsFilter);

    expect(myTeamsFilter).toBeChecked();
    expect(router.location.query.assignment).toBe('my_teams');
    for (const request of myTeamsRequests) {
      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    }
  });

  it('loads and appends the next page of a section', async () => {
    const nextFixProposedGroup = GroupFixture({
      id: '104',
      shortId: 'PROJECT-104',
      project,
      metadata: {
        type: 'TypeError',
        title: 'Another fix proposed issue',
        value: 'Another fix proposed message',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      match: [
        MockApiClient.matchQuery({
          query: 'issue.progress:fix_proposed assigned:me',
        }),
      ],
      body: [fixProposedGroup],
      headers: {
        'X-Hits': '2',
        Link: '<http://localhost/?cursor=0:5:0>; rel="next"; results="true"; cursor="0:5:0"',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      match: [
        MockApiClient.matchQuery({
          query: 'issue.progress:fix_proposed assigned:me',
          cursor: '0:5:0',
        }),
      ],
      body: [nextFixProposedGroup],
      headers: {'X-Hits': '2'},
      asyncDelay: 100,
    });
    mockSection('issue.progress:diagnosed assigned:me', [diagnosedGroup]);
    mockSection('issue.progress:assigned assigned:me', [assignedGroup]);

    render(<InboxPage />, {organization, initialRouterConfig});

    const fixSection = screen.getByRole('region', {name: 'Fix Proposed'});
    expect(await within(fixSection).findByText('Fix proposed issue')).toBeInTheDocument();
    const loadMoreButton = within(fixSection).getByRole('button', {
      name: 'Show 5 more',
    });

    await userEvent.click(loadMoreButton);

    expect(loadMoreButton).toHaveAttribute('aria-busy', 'true');
    expect(
      await within(fixSection).findByText('Another fix proposed issue')
    ).toBeInTheDocument();
    expect(within(fixSection).getByText('Fix proposed issue')).toBeInTheDocument();
    expect(
      within(fixSection).queryByRole('button', {name: 'Show 5 more'})
    ).not.toBeInTheDocument();
  });

  it('stores selection in the URL, renders the embedded preview, and clears it', async () => {
    mockSuccessfulSections();
    mockIssuePreview();

    const {router} = render(<InboxPage />, {
      organization,
      initialRouterConfig,
    });
    const preview = screen.getByRole('complementary', {
      name: 'Issue preview',
    });
    expect(
      within(preview).queryByRole('button', {name: 'Open Issue'})
    ).not.toBeInTheDocument();

    const fixSection = screen.getByRole('region', {name: 'Fix Proposed'});
    const issueLink = await within(fixSection).findByRole('link', {
      name: /Fix proposed issue/,
    });
    await userEvent.click(issueLink);

    expect(router.location.query.preview).toBe(fixProposedGroup.id);
    expect(issueLink).toHaveAttribute('aria-current', 'true');
    expect(
      await within(preview).findByRole('heading', {
        name: 'Fix proposed issue',
      })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: '7D', expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'Last 30 days'}));

    expect(router.location.query.preview).toBeUndefined();
    expect(
      within(preview).queryByRole('heading', {name: 'Fix proposed issue'})
    ).not.toBeInTheDocument();

    const updatedIssueLink = within(
      screen.getByRole('region', {name: 'Fix Proposed'})
    ).getByRole('link', {name: /Fix proposed issue/});
    await userEvent.click(updatedIssueLink);
    await userEvent.click(await screen.findByRole('button', {name: 'Back to inbox'}));
    expect(router.location.query.preview).toBeUndefined();
  });

  it('starts finding the root cause in Autofix when there is no Autofix state', async () => {
    mockSuccessfulSections();
    mockIssuePreview();
    mockAutofixResponse(ExplorerAutofixResponseFixture({autofix: null}));
    const startAutofixRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/autofix/`,
      method: 'POST',
      body: {run_id: 42},
      asyncDelay: 100,
    });

    render(<InboxPage />, {
      organization: seerOrganization,
      initialRouterConfig,
    });

    const preview = await openFixProposedPreview();

    const seerButton = await within(preview).findByRole('button', {
      name: 'Find Root Cause',
    });
    await userEvent.click(seerButton);

    expect(within(preview).getByRole('tab', {name: 'Autofix'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(within(preview).getByRole('button', {name: 'Find Root Cause'})).toBeDisabled();
    await waitFor(() =>
      expect(startAutofixRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {step: 'root_cause', referrer: 'api.web'},
          method: 'POST',
          query: {mode: 'explorer'},
        })
      )
    );
  });

  it('starts making a plan in Autofix when the root cause is complete', async () => {
    mockSuccessfulSections();
    mockIssuePreview();
    mockAutofixResponse(ExplorerAutofixResponseFixture());
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/coding-agents/',
      body: {integrations: []},
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/repos/',
      body: [],
    });
    const startAutofixRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/autofix/`,
      method: 'POST',
      body: {run_id: 42},
      asyncDelay: 100,
    });

    render(<InboxPage />, {
      organization: seerOrganization,
      initialRouterConfig,
    });

    const preview = await openFixProposedPreview();
    const seerButton = await within(preview).findByRole('button', {
      name: 'Make a Plan',
    });

    // After starting the step, the refetch will see a processing state
    mockAutofixResponse(
      ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({status: 'processing'}),
      })
    );

    await userEvent.click(seerButton);

    expect(within(preview).getByRole('tab', {name: 'Autofix'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await waitFor(() =>
      expect(within(preview).getByRole('button', {name: 'Make a Plan'})).toBeDisabled()
    );
    await waitFor(() =>
      expect(startAutofixRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {step: 'solution', referrer: 'api.web', run_id: 42},
          method: 'POST',
          query: {mode: 'explorer'},
        })
      )
    );
  });

  it('links to a completed Autofix pull request while polling', async () => {
    mockSuccessfulSections();
    mockIssuePreview();
    mockAutofixResponse(
      ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          queued_feedback: [{text: 'Please revise the fix'}],
          repo_pr_states: {
            'org/repository': AutofixRepoPRStateFixture(),
          },
        }),
      })
    );

    render(<InboxPage />, {
      organization: seerOrganization,
      initialRouterConfig,
    });

    const preview = await openFixProposedPreview();
    expect(
      await within(preview).findByRole('button', {
        name: 'View org/repository#10',
      })
    ).toHaveAttribute('href', 'https://github.com/org/repository/pull/10');
  });

  it('retries a failed Autofix pull request', async () => {
    mockSuccessfulSections();
    mockIssuePreview();
    mockAutofixResponse(
      ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          repo_pr_states: {
            'org/repository': AutofixRepoPRStateFixture({
              pr_creation_error: 'Unable to create PR',
              pr_creation_status: 'error',
              pr_id: null,
              pr_number: null,
              pr_url: null,
            }),
          },
        }),
      })
    );
    const retryPullRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/autofix/`,
      method: 'POST',
      body: {},
      asyncDelay: 100,
    });

    render(<InboxPage />, {
      organization: seerOrganization,
      initialRouterConfig,
    });

    const preview = await openFixProposedPreview();
    const retryButton = await within(preview).findByRole('button', {
      name: 'Retry PR in org/repository',
    });

    await userEvent.hover(retryButton);
    expect(await screen.findByText('Unable to create PR')).toBeInTheDocument();

    // After retrying, the refetch will see a processing state.
    mockAutofixResponse(
      ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          status: 'processing',
          repo_pr_states: {
            'org/repository': AutofixRepoPRStateFixture({
              pr_creation_error: 'Unable to create PR',
              pr_creation_status: 'error',
              pr_id: null,
              pr_number: null,
              pr_url: null,
            }),
          },
        }),
      })
    );

    await userEvent.click(retryButton);

    expect(within(preview).getByRole('tab', {name: 'Autofix'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await waitFor(() => expect(retryButton).toBeDisabled());
    await waitFor(() =>
      expect(retryPullRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            step: 'open_pr',
            run_id: 42,
            repo_name: 'org/repository',
            referrer: 'api.web',
          },
          method: 'POST',
          query: {mode: 'explorer'},
        })
      )
    );
  });

  it('retains issue actions when Seer Autofix is unavailable', async () => {
    mockSuccessfulSections();
    mockIssuePreview();

    render(<InboxPage />, {organization, initialRouterConfig});

    const preview = screen.getByRole('complementary', {
      name: 'Issue preview',
    });
    const issueLink = await within(
      screen.getByRole('region', {name: 'Fix Proposed'})
    ).findByRole('link', {name: /Fix proposed issue/});
    await userEvent.click(issueLink);

    expect(
      await within(preview).findByRole('button', {name: 'Resolve'})
    ).toBeInTheDocument();
    expect(within(preview).getByRole('button', {name: 'Archive'})).toBeInTheDocument();
    expect(
      within(preview).queryByRole('button', {name: 'Find Root Cause'})
    ).not.toBeInTheDocument();
  });

  it('does not render without the progress UI feature', () => {
    render(<InboxPage />, {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig,
    });

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });
});
