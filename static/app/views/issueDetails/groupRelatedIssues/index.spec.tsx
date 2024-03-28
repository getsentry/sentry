import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';

describe('Related Issues View', function () {
  let relatedIssuesMock: jest.Mock;
  let issuesInfoMock: jest.Mock;
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

  beforeEach(function () {
    // GroupList calls this but we don't need it for this test
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/users/`,
      body: {},
    });
    relatedIssuesMock = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      body: {same_root_cause: [group1, group2]},
    });
    issuesInfoMock = MockApiClient.addMockResponse({
      url: orgIssuesEndpoint,
      body: [
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
      ],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders with mocked data', async function () {
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
    expect(issuesInfoMock).toHaveBeenCalled();
  });
});
