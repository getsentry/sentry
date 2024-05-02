import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';

describe('Related Issues View', function () {
  let relatedIssuesMock: jest.Mock;
  let issuesMock: jest.Mock;
  const router = RouterFixture();

  const organization = OrganizationFixture();
  const orgSlug = organization.slug;
  const groupId = '12345678';
  const group1 = '15';
  const group2 = '20';
  // query=issue.id:[15,20] -> query=issue.id%3A%5B15%2C20%5D
  const orgIssuesEndpoint = `/organizations/${orgSlug}/issues/?query=issue.id%3A%5B${group1}%2C${group2}%5D`;

  const params = {groupId: groupId};
  const errorType = 'RuntimeError';
  const noData = {
    data: [
      {
        type: 'same_root_cause',
        data: [],
      },
      {
        type: 'trace_connected',
        data: [],
      },
    ],
  };
  const onlySameRootData = {
    data: [
      {
        type: 'same_root_cause',
        data: [group1, group2],
      },
      {
        type: 'trace_connected',
        data: [],
      },
    ],
  };
  const onlyTraceConnectedData = {
    data: [
      {
        type: 'same_root_cause',
        data: [],
      },
      {
        type: 'trace_connected',
        data: [group1, group2],
        meta: {
          event_id: 'abcd',
          trace_id: '1234',
        },
      },
    ],
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
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders with no data', async function () {
    relatedIssuesMock = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      body: noData,
    });
    render(
      <GroupRelatedIssues
        params={params}
        location={router.location}
        router={router}
        routeParams={router.params}
        routes={router.routes}
        route={{}}
      />
    );

    expect(
      await screen.findByText('No same-root-cause related issues were found.')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('No trace-connected related issues were found.')
    ).toBeInTheDocument();

    expect(relatedIssuesMock).toHaveBeenCalled();
  });

  it('renders with same root issues', async function () {
    relatedIssuesMock = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      body: onlySameRootData,
    });
    issuesMock = MockApiClient.addMockResponse({
      url: orgIssuesEndpoint,
      body: issuesData,
    });

    render(
      <GroupRelatedIssues
        params={params}
        location={router.location}
        router={router}
        routeParams={router.params}
        routes={router.routes}
        route={{}}
      />
    );

    // Wait for the issues showing up on the table
    expect(await screen.findByText(`EARTH-${group1}`)).toBeInTheDocument();
    expect(await screen.findByText(`EARTH-${group2}`)).toBeInTheDocument();

    expect(relatedIssuesMock).toHaveBeenCalled();
    expect(issuesMock).toHaveBeenCalled();
    expect(
      await screen.findByText('No trace-connected related issues were found.')
    ).toBeInTheDocument();
    const linkButton = screen.getByRole('button', {name: /open in issues/i});
    expect(linkButton).toHaveAttribute(
      'href',
      // Opening in Issues needs to include the group we are currently viewing
      `/organizations/org-slug/issues/?query=issue.id:[${groupId},${group1},${group2}]`
    );
  });

  it('renders with trace connected issues', async function () {
    relatedIssuesMock = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      body: onlyTraceConnectedData,
    });
    issuesMock = MockApiClient.addMockResponse({
      url: orgIssuesEndpoint,
      body: issuesData,
    });
    render(
      <GroupRelatedIssues
        params={params}
        location={router.location}
        router={router}
        routeParams={router.params}
        routes={router.routes}
        route={{}}
      />
    );

    // Wait for the issues showing up on the table
    expect(await screen.findByText(`EARTH-${group1}`)).toBeInTheDocument();
    expect(await screen.findByText(`EARTH-${group2}`)).toBeInTheDocument();

    expect(relatedIssuesMock).toHaveBeenCalled();
    expect(issuesMock).toHaveBeenCalled();
    expect(
      await screen.findByText('No same-root-cause related issues were found.')
    ).toBeInTheDocument();
    const linkElement = screen.getByRole('link', {name: /this trace/i});
    expect(linkElement).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/trace/1234/?node=error-abcd'
    );
    const linkButton = screen.getByRole('button', {name: /open in issues/i});
    // The Issue search supports using `trace` as a parameter
    expect(linkButton).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/?query=trace:1234`
    );
  });
});
