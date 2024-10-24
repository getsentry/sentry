import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {SimilarIssuesDrawer} from 'sentry/views/issueDetails/groupSimilarIssues/similarIssuesDrawer';

describe('SimilarIssuesDrawer', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture({features: ['similarity-view']});
  const group = GroupFixture();
  let mockSimilarIssues: jest.Mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    mockSimilarIssues = MockApiClient.addMockResponse({
      url: `/organizations/${organization.id}/issues/${group.id}/similar/?limit=50`,
      body: [[group, {'exception:stacktrace:pairs': 0.375}]],
      method: 'GET',
    });
  });

  it('renders the content as expected', async function () {
    render(<SimilarIssuesDrawer group={group} project={project} />, {organization});

    expect(
      await screen.findByRole('heading', {name: 'Similar Issues'})
    ).toBeInTheDocument();
    expect(screen.getByText('Issues with a similar stack trace')).toBeInTheDocument();
    expect(mockSimilarIssues).toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Close Drawer'})).toBeInTheDocument();
  });
});
