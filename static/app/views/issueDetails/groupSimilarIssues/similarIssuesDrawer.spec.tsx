import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  waitFor,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {SimilarIssuesDrawer} from 'sentry/views/issueDetails/groupSimilarIssues/similarIssuesDrawer';

describe('SimilarIssuesDrawer', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({features: ['similarity-view']});
  const group = GroupFixture();
  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/${group.id}/similar/`,
    },
    route: '/organizations/:orgId/issues/:groupId/similar/',
  };
  let mockSimilarIssues: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    mockSimilarIssues = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/similar/?limit=50`,
      body: [[group, {'exception:stacktrace:pairs': 0.375}]],
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: {features: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'same_root_cause',
        }),
      ],
      body: {data: [], type: 'same_root_cause'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'trace_connected',
        }),
      ],
      body: {data: [], type: 'trace_connected'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/latest/`,
      body: {},
    });
  });

  it('renders the content as expected', async () => {
    render(<SimilarIssuesDrawer group={group} project={project} />, {
      organization,
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('heading', {name: 'Similar Issues'})
    ).toBeInTheDocument();

    expect(screen.getByText('Issues with a similar stack trace')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockSimilarIssues).toHaveBeenCalled();
    });
    expect(screen.getByRole('button', {name: 'Close Drawer'})).toBeInTheDocument();
  });
});
