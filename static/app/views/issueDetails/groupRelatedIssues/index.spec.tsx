import {GroupsFixture} from 'sentry-fixture/groups';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';

describe('Related Issues View', function () {
  let related_issues_mock;
  let issues_info_mock;

  const organization = OrganizationFixture({features: ['related-issues']});
  const orgSlug = organization.slug;
  const groupId = '12345678';
  // XXX: Later I need to figure out why the component receives the orgId as a slug
  const params = {orgId: orgSlug, groupId: groupId};

  const routerContext = RouterContextFixture([
    {
      router: {
        ...RouterFixture(),
        params: {orgId: orgSlug, projectId: 'project-slug', groupId: groupId},
      },
    },
  ]);

  const mockData = {
    groups: GroupsFixture().map(issue => [issue]),
  };

  const router = RouterFixture();

  beforeEach(function () {
    related_issues_mock = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      body: mockData.groups,
    });
    issues_info_mock = MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/issues/`,
      body: mockData.groups,
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
      />,
      {context: routerContext}
    );

    await waitFor(() => screen.findByText('Related Issues'));

    expect(related_issues_mock).toHaveBeenCalled();
    expect(issues_info_mock).toHaveBeenCalled();
  });
});
