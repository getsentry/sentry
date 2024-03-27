import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';

describe('Related Issues View', function () {
  let relatedIssuesMock: jest.Mock;
  let issuesInfoMock: jest.Mock;
  const router = RouterFixture();

  const organization = OrganizationFixture();
  const orgSlug = organization.slug;
  const groupId = '12345678';
  const relatedGroup = '15';
  const orgIssuesEndpoint = `/organizations/${orgSlug}/issues/?query=issue.id%3A${relatedGroup}`;
  // XXX: Later I need to figure out why the component receives the orgId as a slug
  const params = {orgId: orgSlug, groupId: groupId};
  const errorType = 'RuntimeError';

  beforeEach(function () {
    // GroupList calls this but we don't need it for this test
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/users/`,
      body: {},
    });
    relatedIssuesMock = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      body: {same_root_cause: [relatedGroup]},
    });
    issuesInfoMock = MockApiClient.addMockResponse({
      url: orgIssuesEndpoint,
      body: [
        {
          id: relatedGroup,
          project: {id: '3', name: 'Earth', slug: 'earth', platform: null},
          type: 'error',
          metadata: {
            type: errorType,
          },
          issueCategory: 'error',
          lastSeen: '2024-03-15T20:15:30Z',
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

    // The issue that should show up on the table
    await waitFor(() => screen.findByText(errorType));

    expect(relatedIssuesMock).toHaveBeenCalled();
    expect(issuesInfoMock).toHaveBeenCalled();
  });
});
