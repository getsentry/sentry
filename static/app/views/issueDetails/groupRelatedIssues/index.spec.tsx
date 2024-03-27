// import {GroupsFixture} from 'sentry-fixture/groups';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';

describe('Related Issues View', function () {
  let relatedIssuesMock: jest.Mock<any, any, any>;
  let issuesInfoMock: jest.Mock<any, any, any>;

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

  // const mockData = {
  //   groups: GroupsFixture().map(issue => [issue]),
  // };

  const router = RouterFixture();

  beforeEach(function () {
    relatedIssuesMock = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/related-issues/`,
      body: {same_root_cause: [15]},
    });
    issuesInfoMock = MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/issues/`,
      body: [
        {
          id: '15',
          shortId: 'EARTH-7',
          title: 'RuntimeError: Invalid device: A949AE01EBB07300D62AE0178F0944DD21F8C98C',
          level: 'error',
          status: 'unresolved',
          statusDetails: {},
          substatus: 'ongoing',
          platform: 'other',
          project: {id: '3', name: 'Earth', slug: 'earth', platform: null},
          type: 'error',
          metadata: {
            value: 'Invalid device: A949AE01EBB07300D62AE0178F0944DD21F8C98C',
            type: 'RuntimeError',
            filename: 'example.py',
            function: 'crash',
            display_title_with_tree_label: false,
            in_app_frame_mix: 'in-app-only',
            sdk: {name: 'sentry.python', name_normalized: 'sentry.python'},
            initial_priority: 75,
          },
          hasSeen: true,
          issueType: 'error',
          issueCategory: 'error',
          isUnhandled: false,
          count: '1',
          userCount: 1,
          firstSeen: '2024-03-15T20:15:30Z',
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
      />,
      {context: routerContext}
    );

    await waitFor(() => screen.findByText('Related Issues'));

    expect(relatedIssuesMock).toHaveBeenCalled();
    expect(issuesInfoMock).toHaveBeenCalled();
  });
});
