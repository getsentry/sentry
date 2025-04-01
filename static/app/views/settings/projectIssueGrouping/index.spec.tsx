import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
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

  it('shows derived grouping enhancements only for superusers', async () => {
    // Mock the API response
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/grouping-configs/`,
      body: [],
    });

    // First render with a non-superuser
    const {rerender} = render(
      <ProjectIssueGrouping
        organization={organization}
        project={project}
        {...RouteComponentPropsFixture()}
      />
    );

    // Verify the section is not visible for non-superuser
    expect(await screen.findByText('Issue Grouping')).toBeInTheDocument();
    expect(screen.queryByText(/Derived Grouping Enhancements/)).not.toBeInTheDocument();

    // Re-render with a superuser
    ConfigStore.set('user', UserFixture({isSuperuser: true, isStaff: true}));
    const orgWithSuperUser = {...organization, user: {isSuperuser: true}};
    rerender(
      <ProjectIssueGrouping
        organization={orgWithSuperUser}
        project={project}
        {...RouteComponentPropsFixture()}
      />
    );

    // Verify the section is visible for superuser
    expect(screen.getByText(/Derived Grouping Enhancements/)).toBeInTheDocument();
  });
});
