import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';

describe('Related Issues View', function () {
  const organization = OrganizationFixture({features: ['global-views']});
  const groupId = '12345678';
  const group = GroupFixture({id: groupId});
  const router = RouterFixture({
    params: {groupId: group.id},
  });
  const orgSlug = organization.slug;
  const group1 = '15';
  const group2 = '20';
  // query=issue.id:[15,20] -> query=issue.id%3A%5B15%2C20%5D
  const orgIssuesEndpoint = `/organizations/${orgSlug}/issues/?query=issue.id%3A%5B${group1}%2C${group2}%5D`;

  const errorType = 'RuntimeError';
  const onlySameRootData = {
    type: 'same_root_cause',
    data: [group1, group2],
  };
  const onlyTraceConnectedData = {
    type: 'trace_connected',
    data: [group1, group2],
    meta: {
      event_id: 'abcd',
      trace_id: '1234',
    },
  };
  const issuesData = [
    {
      id: group1,
      shortId: `EARTH-${group1}`,
      project: {id: '3', name: 'Earth', slug: 'earth', platform: null},
      type: 'error',
      metadata: {
        type: errorType,
      },
      issueCategory: 'error',
      lastSeen: '2024-03-15T20:15:30Z',
    },
    {
      id: group2,
      shortId: `EARTH-${group2}`,
      project: {id: '3', name: 'Earth', slug: 'earth', platform: null},
      type: 'error',
      metadata: {
        type: errorType,
      },
      issueCategory: 'error',
      lastSeen: '2024-03-16T20:15:30Z',
    },
  ];

  beforeEach(function () {
    // GroupList calls this but we don't need it for this test
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/users/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders with same root issues', async function () {
    const sameRootIssuesMock = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'same_root_cause',
        }),
      ],
      body: onlySameRootData,
    });
    MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'trace_connected',
        }),
      ],
      body: [],
    });
    const issuesMock = MockApiClient.addMockResponse({
      url: orgIssuesEndpoint,
      body: issuesData,
    });

    render(<GroupRelatedIssues group={group} />, {router, organization});

    // Wait for the issues showing up on the table
    expect(await screen.findByText(`EARTH-${group1}`)).toBeInTheDocument();
    expect(await screen.findByText(`EARTH-${group2}`)).toBeInTheDocument();

    expect(sameRootIssuesMock).toHaveBeenCalled();
    expect(issuesMock).toHaveBeenCalled();
    const linkButton = screen.getByRole('button', {name: /open in issues/i});
    expect(linkButton).toHaveAttribute(
      'href',
      // Opening in Issues needs to include the group we are currently viewing
      `/organizations/org-slug/issues/?project=-1&query=${encodeURIComponent(`issue.id:[${groupId},${group1},${group2}]`)}`
    );
  });

  it('renders with trace connected issues', async function () {
    MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'same_root_cause',
        }),
      ],
      body: [],
    });
    const traceIssuesMock = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'trace_connected',
        }),
      ],
      body: onlyTraceConnectedData,
    });
    const issuesMock = MockApiClient.addMockResponse({
      url: orgIssuesEndpoint,
      body: issuesData,
    });
    render(<GroupRelatedIssues group={group} />, {router, organization});

    // Wait for the issues showing up on the table
    expect(await screen.findByText(`EARTH-${group1}`)).toBeInTheDocument();
    expect(await screen.findByText(`EARTH-${group2}`)).toBeInTheDocument();

    expect(traceIssuesMock).toHaveBeenCalled();
    expect(issuesMock).toHaveBeenCalled();
    const linkElement = screen.getByRole('link', {name: /this trace/i});
    expect(linkElement).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/trace/1234/?node=error-abcd'
    );
    const linkButton = screen.getByRole('button', {name: /open in issues/i});
    // The Issue search supports using `trace` as a parameter
    expect(linkButton).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/?project=-1&query=${encodeURIComponent('trace:1234')}`
    );
  });

  it('sets project id when global views is disabled', async function () {
    MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'same_root_cause',
          project: group.project.id,
        }),
      ],
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'trace_connected',
          project: group.project.id,
        }),
      ],
      body: onlyTraceConnectedData,
    });
    MockApiClient.addMockResponse({
      url: orgIssuesEndpoint,
      body: issuesData,
    });
    const noGlobalViewsOrganization = OrganizationFixture({features: []});
    render(<GroupRelatedIssues group={group} />, {
      router,
      organization: noGlobalViewsOrganization,
    });
    expect(await screen.findByText(`EARTH-${group1}`)).toBeInTheDocument();
    const linkButton = screen.getByRole('button', {name: /open in issues/i});
    expect(linkButton).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/?project=${group.project.id}&query=${encodeURIComponent('trace:1234')}`
    );
  });
});
