import {
  AutofixRepoPRStateFixture,
  ExplorerAutofixBlockFixture,
  ExplorerAutofixResponseFixture,
  ExplorerAutofixStateFixture,
} from 'sentry-fixture/autofix';
import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ProgressState} from 'sentry/types/group';
import {useMedia} from 'sentry/utils/useMedia';
import {INBOX_AUTOFIX_CATEGORY_FILTER} from 'sentry/views/issueList/queries/inbox';

import InboxPage from './inbox';

jest.mock('sentry/utils/useMedia');

describe('InboxPage', () => {
  const organization = OrganizationFixture({
    features: ['issue-stream-progress-ui', 'gen-ai-features', 'seat-based-seer-enabled'],
  });
  const seerOrganization = organization;
  const aiOnlyOrganization = OrganizationFixture({
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
    count: '2600',
    userCount: 11,
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
      lastProgressedAt: '2026-07-20T12:00:00Z',
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
    jest.mocked(useMedia).mockReturnValue(false);
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [MemberFixture({id: assignedUser.id, user: assignedUser})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    localStorage.removeItem('inbox-split-size');
  });

  function mockSection(
    query: string,
    body: unknown,
    statusCode = 200,
    total = Array.isArray(body) ? body.length : 0,
    asyncDelay?: number
  ) {
    return MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      match: [
        MockApiClient.matchQuery({query: `${query}${INBOX_AUTOFIX_CATEGORY_FILTER}`}),
      ],
      body,
      headers: {'X-Hits': String(total)},
      statusCode,
      asyncDelay,
    });
  }

  function mockSuccessfulSections() {
    return [
      mockSection(
        'issue.progress:fix_proposed is:unresolved assigned_or_suggested:me',
        [fixProposedGroup],
        200,
        2
      ),
      mockSection(
        'issue.progress:diagnosed is:unresolved assigned_or_suggested:me',
        [diagnosedGroup],
        200,
        2
      ),
      mockSection(
        'issue.progress:assigned is:unresolved assigned_or_suggested:me',
        [assignedGroup],
        200,
        12
      ),
      mockSection('issue.progress:identified is:unresolved assigned_or_suggested:me', []),
      mockSection(
        'issue.progress:fix_applied is:unresolved assigned_or_suggested:me',
        []
      ),
    ];
  }

  function mockIssuePreview({
    group = fixProposedGroup,
    markSeenResponse = {...fixProposedGroup, hasSeen: true},
    markSeenStatusCode = 200,
  }: {
    group?: typeof fixProposedGroup;
    markSeenResponse?: typeof fixProposedGroup;
    markSeenStatusCode?: number;
  } = {}) {
    let previewHasSeen = group.hasSeen;
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: () => ({...group, hasSeen: previewHasSeen}),
    });
    const markSeenRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      method: 'PUT',
      body: () => {
        if (markSeenStatusCode < 400) {
          previewHasSeen = markSeenResponse.hasSeen;
        }
        return markSeenResponse;
      },
      statusCode: markSeenStatusCode,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });
    mockAutofixResponse(ExplorerAutofixResponseFixture({autofix: null}));
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/autofix/`,
      body: ExplorerAutofixResponseFixture({autofix: null}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/external-issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });

    return markSeenRequest;
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
    mockIssuePreview();

    render(<InboxPage />, {organization: seerOrganization, initialRouterConfig});

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
      'issue.progress:fix_proposed is:unresolved assigned_or_suggested:me',
      'issue.progress:diagnosed is:unresolved assigned_or_suggested:me',
      'issue.progress:assigned is:unresolved assigned_or_suggested:me',
      'issue.progress:identified is:unresolved assigned_or_suggested:me',
      'issue.progress:fix_applied is:unresolved assigned_or_suggested:me',
    ].entries()) {
      await waitFor(() =>
        expect(requests[index]).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            method: 'GET',
            query: {
              query: `${query}${INBOX_AUTOFIX_CATEGORY_FILTER}`,
              sort: 'progress',
              limit: 10,
              collapse: ['stats', 'unhandled'],
              expand: ['derivedData', 'owners'],
            },
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
    expect(within(fixSection).queryByText('PROJECT-101')).not.toBeInTheDocument();
    expect(within(fixSection).getByTitle('Jane Doe')).toBeInTheDocument();
    expect(within(fixSection).getByRole('img', {name: 'Jane Doe'})).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg?s=120'
    );
    expect(within(fixSection).getByLabelText('Unread issue')).toBeInTheDocument();
    expect(within(fixSection).queryByRole('checkbox')).not.toBeInTheDocument();
    const lastProgressedTime = fixSection.querySelector('time');
    expect(lastProgressedTime).toHaveAttribute('datetime', '2026-07-20T12:00:00.000Z');
    await userEvent.hover(lastProgressedTime!);
    const progressStatus = await screen.findByText('Fix Proposed', {selector: 'strong'});
    expect(progressStatus.parentElement).toHaveTextContent('Changed to Fix Proposed');
    expect(screen.queryByRole('button', {name: '7D'})).not.toBeInTheDocument();
  });

  it('shows up to two pull request badges only in pull request sections', async () => {
    mockSuccessfulSections();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/`,
      body: fixProposedGroup,
    });
    const diagnosedPullRequests = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${diagnosedGroup.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    const assignedPullRequests = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${assignedGroup.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '10',
              externalUrl: 'https://github.com/org/repository/pull/10',
            }),
            attribution: null,
            checksStatus: null,
            dateLinked: '2026-07-20T12:00:00Z',
            reviewStatus: null,
            status: 'open',
          },
          {
            ...PullRequestFixture({
              id: '11',
              externalUrl: 'https://github.com/org/repository/pull/11',
            }),
            attribution: null,
            checksStatus: null,
            dateLinked: '2026-07-20T12:00:00Z',
            reviewStatus: null,
            status: 'merged',
          },
          {
            ...PullRequestFixture({
              id: '12',
              externalUrl: 'https://github.com/org/repository/pull/12',
            }),
            attribution: null,
            checksStatus: null,
            dateLinked: '2026-07-20T12:00:00Z',
            reviewStatus: null,
            status: 'closed',
          },
        ],
      },
    });

    render(<InboxPage />, {organization: seerOrganization, initialRouterConfig});

    const fixSection = screen.getByRole('region', {name: 'Fix Proposed'});
    expect(
      await within(fixSection).findByRole('link', {name: 'Pull request #10, Open'})
    ).toHaveAttribute('href', 'https://github.com/org/repository/pull/10');
    expect(
      within(fixSection).getByRole('link', {name: 'Pull request #11, Merged'})
    ).toHaveAttribute('href', 'https://github.com/org/repository/pull/11');
    expect(
      within(fixSection).queryByRole('link', {name: 'Pull request #12, Closed'})
    ).not.toBeInTheDocument();
    expect(diagnosedPullRequests).not.toHaveBeenCalled();
    expect(assignedPullRequests).not.toHaveBeenCalled();
  });

  it('shows suggested owners on inbox cards', async () => {
    const suggestedOwner = UserFixture({id: '11', name: 'John Smith'});
    const groupWithSuggestedOwner = GroupFixture({
      ...diagnosedGroup,
      owners: [
        {
          type: 'seerSuggested',
          owner: `user:${suggestedOwner.id}`,
          date_added: '',
        },
      ],
    });
    mockSection('issue.progress:fix_proposed is:unresolved assigned_or_suggested:me', []);
    mockSection('issue.progress:diagnosed is:unresolved assigned_or_suggested:me', [
      groupWithSuggestedOwner,
    ]);
    mockSection('issue.progress:assigned is:unresolved assigned_or_suggested:me', []);
    mockSection('issue.progress:identified is:unresolved assigned_or_suggested:me', []);
    mockSection('issue.progress:fix_applied is:unresolved assigned_or_suggested:me', []);
    const suggestedOwnerRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      match: [MockApiClient.matchQuery({query: `user.id:${suggestedOwner.id}`})],
      body: [MemberFixture({id: suggestedOwner.id, user: suggestedOwner})],
    });
    mockIssuePreview({group: groupWithSuggestedOwner});

    render(<InboxPage />, {organization: seerOrganization, initialRouterConfig});

    const issueCard = await screen.findByRole('link', {name: /Diagnosed issue/});
    expect(
      await within(issueCard).findByTestId('suggested-avatar-stack')
    ).toHaveTextContent('JS');
    expect(suggestedOwnerRequest).toHaveBeenCalledTimes(1);
  });

  it('restores the persisted Inbox pane width', () => {
    localStorage.setItem('inbox-split-size', '550');
    mockSuccessfulSections();

    render(<InboxPage />, {organization, initialRouterConfig});

    expect(screen.getByRole('region', {name: 'Issue inbox'})).toHaveStyle({
      width: '550px',
    });
  });

  it('does not render without Autofix access', () => {
    render(<InboxPage />, {
      organization: aiOnlyOrganization,
      initialRouterConfig,
    });

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('shows the Identified section on all assignee tabs', async () => {
    mockSuccessfulSections();
    mockIssuePreview();
    mockSection(
      'issue.progress:fix_proposed is:unresolved assigned_or_suggested:[me,my_teams]',
      [fixProposedGroup]
    );
    mockSection(
      'issue.progress:diagnosed is:unresolved assigned_or_suggested:[me,my_teams]',
      [diagnosedGroup]
    );
    mockSection(
      'issue.progress:assigned is:unresolved assigned_or_suggested:[me,my_teams]',
      [assignedGroup]
    );
    const identifiedMyTeamsRequest = mockSection(
      'issue.progress:identified is:unresolved assigned_or_suggested:[me,my_teams]',
      []
    );
    mockSection(
      'issue.progress:fix_applied is:unresolved assigned_or_suggested:[me,my_teams]',
      []
    );
    mockSection('issue.progress:fix_proposed is:unresolved', [fixProposedGroup]);
    mockSection('issue.progress:diagnosed is:unresolved', [diagnosedGroup]);
    mockSection('issue.progress:assigned is:unresolved', [assignedGroup]);
    const identifiedAllRequest = mockSection(
      'issue.progress:identified is:unresolved',
      []
    );
    mockSection('issue.progress:fix_applied is:unresolved', []);

    render(<InboxPage />, {
      organization: seerOrganization,
      initialRouterConfig,
    });

    // Identified should be visible on the default "Me" tab
    expect(screen.getByRole('region', {name: 'Identified'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'My Teams'}));

    expect(screen.getByRole('region', {name: 'Identified'})).toBeInTheDocument();
    await waitFor(() => expect(identifiedMyTeamsRequest).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('radio', {name: 'All'}));

    expect(screen.getByRole('region', {name: 'Identified'})).toBeInTheDocument();
    await waitFor(() => expect(identifiedAllRequest).toHaveBeenCalledTimes(1));
  });

  it('shows a plus sign when a section count reaches the API cap', async () => {
    mockIssuePreview();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      match: [
        MockApiClient.matchQuery({
          query: `issue.progress:fix_proposed is:unresolved assigned_or_suggested:me${INBOX_AUTOFIX_CATEGORY_FILTER}`,
        }),
      ],
      body: [fixProposedGroup],
      headers: {'X-Hits': '1000', 'X-Max-Hits': '1000'},
    });
    mockSection('issue.progress:diagnosed is:unresolved assigned_or_suggested:me', [
      diagnosedGroup,
    ]);
    mockSection('issue.progress:assigned is:unresolved assigned_or_suggested:me', [
      assignedGroup,
    ]);
    mockSection('issue.progress:identified is:unresolved assigned_or_suggested:me', []);
    mockSection('issue.progress:fix_applied is:unresolved assigned_or_suggested:me', []);

    render(<InboxPage />, {organization: seerOrganization, initialRouterConfig});

    const fixSection = screen.getByRole('region', {name: 'Fix Proposed'});
    expect(await within(fixSection).findByText('1000+')).toBeInTheDocument();
  });

  it('expands and collapses progress sections', async () => {
    mockSuccessfulSections();
    mockIssuePreview();

    render(<InboxPage />, {organization: seerOrganization, initialRouterConfig});

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
    mockIssuePreview();
    const myTeamsRequests = [
      mockSection(
        'issue.progress:fix_proposed is:unresolved assigned_or_suggested:[me,my_teams]',
        [fixProposedGroup]
      ),
      mockSection(
        'issue.progress:diagnosed is:unresolved assigned_or_suggested:[me,my_teams]',
        [diagnosedGroup]
      ),
      mockSection(
        'issue.progress:assigned is:unresolved assigned_or_suggested:[me,my_teams]',
        [assignedGroup]
      ),
      mockSection(
        'issue.progress:identified is:unresolved assigned_or_suggested:[me,my_teams]',
        []
      ),
      mockSection(
        'issue.progress:fix_applied is:unresolved assigned_or_suggested:[me,my_teams]',
        []
      ),
    ];
    const allRequests = [
      mockSection('issue.progress:fix_proposed is:unresolved', [fixProposedGroup]),
      mockSection('issue.progress:diagnosed is:unresolved', [diagnosedGroup]),
      mockSection('issue.progress:assigned is:unresolved', [assignedGroup]),
      mockSection('issue.progress:identified is:unresolved', []),
      mockSection('issue.progress:fix_applied is:unresolved', []),
    ];

    const {router} = render(<InboxPage />, {
      organization: seerOrganization,
      initialRouterConfig,
    });

    const meFilter = screen.getByRole('radio', {name: 'Me'});
    const myTeamsFilter = screen.getByRole('radio', {name: 'My Teams'});
    const allFilter = screen.getByRole('radio', {name: 'All'});
    expect(meFilter).toBeChecked();
    expect(myTeamsFilter).not.toBeChecked();
    expect(allFilter).not.toBeChecked();
    expect(await screen.findByText('Fix proposed issue')).toBeInTheDocument();

    await userEvent.click(myTeamsFilter);

    expect(myTeamsFilter).toBeChecked();
    expect(router.location.query.assignment).toBe('my_teams');
    for (const request of myTeamsRequests) {
      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    }

    await userEvent.click(allFilter);

    expect(allFilter).toBeChecked();
    expect(router.location.query.assignment).toBe('all');
    for (const request of allRequests) {
      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    }
  });

  it('marks an issue as seen and clears its unread indicator when previewed', async () => {
    const sectionRequests = mockSuccessfulSections();
    const markSeenRequest = mockIssuePreview();

    render(<InboxPage />, {organization, initialRouterConfig});

    const fixSection = screen.getByRole('region', {name: 'Fix Proposed'});
    expect(await within(fixSection).findByLabelText('Unread issue')).toBeInTheDocument();

    await openFixProposedPreview();

    await waitFor(() =>
      expect(markSeenRequest).toHaveBeenCalledWith(
        `/organizations/org-slug/issues/${fixProposedGroup.id}/`,
        expect.objectContaining({method: 'PUT', data: {hasSeen: true}})
      )
    );

    await waitFor(() =>
      expect(within(fixSection).queryByLabelText('Unread issue')).not.toBeInTheDocument()
    );
    expect(sectionRequests[0]).toHaveBeenCalledTimes(1);
  });

  it('keeps an issue unread when marking it seen fails', async () => {
    mockSuccessfulSections();
    const markSeenRequest = mockIssuePreview({markSeenStatusCode: 500});

    render(<InboxPage />, {organization, initialRouterConfig});

    const fixSection = screen.getByRole('region', {name: 'Fix Proposed'});
    expect(await within(fixSection).findByLabelText('Unread issue')).toBeInTheDocument();

    await openFixProposedPreview();

    await waitFor(() => expect(markSeenRequest).toHaveBeenCalledTimes(1));
    expect(within(fixSection).getByLabelText('Unread issue')).toBeInTheDocument();
  });

  it('keeps an issue unread when the server does not mark it seen', async () => {
    mockSuccessfulSections();
    const markSeenRequest = mockIssuePreview({
      markSeenResponse: {...fixProposedGroup, hasSeen: false},
    });

    render(<InboxPage />, {organization, initialRouterConfig});

    const fixSection = screen.getByRole('region', {name: 'Fix Proposed'});
    expect(await within(fixSection).findByLabelText('Unread issue')).toBeInTheDocument();

    await openFixProposedPreview();

    await waitFor(() => expect(markSeenRequest).toHaveBeenCalledTimes(1));
    expect(within(fixSection).getByLabelText('Unread issue')).toBeInTheDocument();
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
          query: `issue.progress:fix_proposed is:unresolved assigned_or_suggested:me${INBOX_AUTOFIX_CATEGORY_FILTER}`,
        }),
      ],
      body: [fixProposedGroup],
      headers: {
        'X-Hits': '2',
        Link: '<http://localhost/?cursor=0:10:0>; rel="next"; results="true"; cursor="0:10:0"',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      match: [
        MockApiClient.matchQuery({
          query: `issue.progress:fix_proposed is:unresolved assigned_or_suggested:me${INBOX_AUTOFIX_CATEGORY_FILTER}`,
          cursor: '0:10:0',
        }),
      ],
      body: [nextFixProposedGroup],
      headers: {'X-Hits': '2'},
      asyncDelay: 100,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${nextFixProposedGroup.id}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    mockSection('issue.progress:diagnosed is:unresolved assigned_or_suggested:me', [
      diagnosedGroup,
    ]);
    mockSection('issue.progress:assigned is:unresolved assigned_or_suggested:me', [
      assignedGroup,
    ]);
    mockSection('issue.progress:identified is:unresolved assigned_or_suggested:me', []);
    mockSection('issue.progress:fix_applied is:unresolved assigned_or_suggested:me', []);

    render(<InboxPage />, {organization, initialRouterConfig});

    const fixSection = screen.getByRole('region', {name: 'Fix Proposed'});
    expect(await within(fixSection).findByText('Fix proposed issue')).toBeInTheDocument();
    const loadMoreButton = within(fixSection).getByRole('button', {
      name: 'Show 10 more',
    });

    await userEvent.click(loadMoreButton);

    expect(loadMoreButton).toHaveAttribute('aria-busy', 'true');
    expect(
      await within(fixSection).findByText('Another fix proposed issue')
    ).toBeInTheDocument();
    expect(within(fixSection).getByText('Fix proposed issue')).toBeInTheDocument();
    expect(
      within(fixSection).queryByRole('button', {name: 'Show 10 more'})
    ).not.toBeInTheDocument();
  });

  it('prefetches the preview on hover so opening it needs no new request', async () => {
    mockSuccessfulSections();
    mockIssuePreview();
    const groupRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${fixProposedGroup.id}/`,
      body: fixProposedGroup,
    });

    render(<InboxPage />, {organization, initialRouterConfig});

    const issueLink = await within(
      screen.getByRole('region', {name: 'Fix Proposed'})
    ).findByRole('link', {name: /Fix proposed issue/});
    await userEvent.hover(issueLink);

    await waitFor(() => expect(groupRequest).toHaveBeenCalledTimes(1));

    // Reads the warmed cache, which only holds if the query keys match.
    await userEvent.click(issueLink);

    const preview = screen.getByRole('complementary', {name: 'Issue preview'});
    expect(
      await within(preview).findByRole('heading', {name: 'Activity'})
    ).toBeInTheDocument();
    expect(groupRequest).toHaveBeenCalledTimes(1);
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
    expect(within(preview).getByLabelText('11 affected users')).toHaveTextContent(
      '11Users'
    );
    expect(within(preview).getByLabelText('2,600 events')).toHaveTextContent(
      '2.6KEvents'
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Back to inbox'}));
    expect(router.location.query.preview).toBeUndefined();
    expect(
      within(preview).queryByRole('heading', {name: 'Fix proposed issue'})
    ).not.toBeInTheDocument();
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

    expect(within(preview).queryByRole('tab', {name: 'Autofix'})).not.toBeInTheDocument();
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
    await within(preview).findByRole('button', {name: 'Make a Plan'});

    // After starting the step, the refetch will see a processing state
    mockAutofixResponse(
      ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({status: 'processing'}),
      })
    );

    await userEvent.click(within(preview).getByRole('button', {name: 'Make a Plan'}));

    expect(within(preview).queryByRole('tab', {name: 'Autofix'})).not.toBeInTheDocument();
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

  it('offers to create a PR when code changes are complete', async () => {
    mockSuccessfulSections();
    mockIssuePreview();
    mockAutofixResponse(
      ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          blocks: [
            ExplorerAutofixBlockFixture({
              message: {
                content: 'Code changes complete',
                metadata: {step: 'code_changes'},
                role: 'assistant',
              },
            }),
          ],
        }),
      })
    );

    render(<InboxPage />, {
      organization: seerOrganization,
      initialRouterConfig,
    });

    const preview = await openFixProposedPreview();
    expect(
      await within(preview).findByRole('button', {name: 'Create PR'})
    ).toBeInTheDocument();
  });

  it('labels a coding agent pull request like a Seer one', async () => {
    // A delegated agent's PR arrives under coding_agents rather than repo_pr_states.
    mockSuccessfulSections();
    mockIssuePreview();
    mockAutofixResponse(
      ExplorerAutofixResponseFixture({
        autofix: ExplorerAutofixStateFixture({
          coding_agents: {
            'agent-1': {
              id: 'agent-1',
              name: 'Cursor',
              provider: 'cursor_background_agent',
              started_at: '2024-01-01T00:00:00Z',
              status: 'completed',
              results: [
                {
                  description: 'Fixed',
                  repo_full_name: 'org/repository',
                  repo_provider: 'github',
                  pr_number: 649,
                  pr_url: 'https://github.com/org/repository/pull/649',
                },
              ],
            },
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
        name: 'View org/repository#649',
      })
    ).toHaveAttribute('href', 'https://github.com/org/repository/pull/649');
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

    expect(within(preview).queryByRole('tab', {name: 'Autofix'})).not.toBeInTheDocument();
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

  it('does not render without the progress UI feature', () => {
    render(<InboxPage />, {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig,
    });

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  describe('on desktop', () => {
    beforeEach(() => {
      jest.mocked(useMedia).mockImplementation(query => query.startsWith('(min-width:'));
    });

    it('auto-selects the first issue', async () => {
      mockSuccessfulSections();
      mockIssuePreview();

      const {router, unmount} = render(<InboxPage />, {
        organization,
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(router.location.query.preview).toBe(fixProposedGroup.id);
      });
      expect(router.location.query).toEqual({
        project: project.id,
        environment: 'production',
        statsPeriod: '7d',
        preview: fixProposedGroup.id,
      });
      expect(
        within(screen.getByRole('region', {name: 'Fix Proposed'})).getByRole('link', {
          name: /Fix proposed issue/,
        })
      ).toHaveAttribute('aria-current', 'true');
      unmount();
    });

    it('follows section order even when a later section resolves first', async () => {
      // Diagnosed resolves immediately, Fix Proposed only after a delay. Both
      // have issues, so taking whichever result arrives first would select the
      // Diagnosed issue; section priority must win instead.
      mockSection(
        'issue.progress:fix_proposed is:unresolved assigned_or_suggested:me',
        [fixProposedGroup],
        200,
        1,
        100
      );
      mockSection('issue.progress:diagnosed is:unresolved assigned_or_suggested:me', [
        diagnosedGroup,
      ]);
      mockSection('issue.progress:assigned is:unresolved assigned_or_suggested:me', [
        assignedGroup,
      ]);
      mockSection('issue.progress:identified is:unresolved assigned_or_suggested:me', []);
      mockSection(
        'issue.progress:fix_applied is:unresolved assigned_or_suggested:me',
        []
      );
      mockIssuePreview();

      const {router} = render(<InboxPage />, {
        organization: seerOrganization,
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(router.location.query.preview).toBe(fixProposedGroup.id);
      });
    });
  });
});
