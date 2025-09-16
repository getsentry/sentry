import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {SimilarIssuesDrawer} from 'sentry/views/issueDetails/groupSimilarIssues/similarIssuesDrawer';

describe('SimilarIssuesDrawer', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({features: ['similarity-view']});
  const group = GroupFixture();
  const router = RouterFixture({
    params: {groupId: group.id},
  });
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
      url: `/issues/${group.id}/related-issues/`,
      body: {data: [], type: 'same_root_cause'},
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
      router,
      deprecatedRouterMocks: true,
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
