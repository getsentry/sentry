import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectIssueGrouping from 'sentry/views/settings/projectIssueGrouping';

describe('projectIssueGrouping', () => {
  const {organization, projects} = initializeOrg();
  const project = projects[0]!;

  it('renders successfully', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/grouping-configs/`,
      body: [],
    });

    render(
      <ProjectIssueGrouping
        organization={organization}
        project={project}
        {...RouteComponentPropsFixture()}
      />
    );

    expect(request).toHaveBeenCalled();
    expect(await screen.findByText('Issue Grouping')).toBeInTheDocument();
  });

  it('renders error', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/grouping-configs/`,
      body: {
        detail: 'Internal Error',
      },
      statusCode: 500,
    });

    render(
      <ProjectIssueGrouping
        organization={organization}
        project={project}
        {...RouteComponentPropsFixture()}
      />
    );

    expect(request).toHaveBeenCalled();
    expect(
      await screen.findByText('Failed to load grouping configs')
    ).toBeInTheDocument();
  });
});
