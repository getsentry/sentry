import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import ProjectTeams from 'sentry/views/settings/project/projectTeams';

describe('ProjectTeams', function () {
  let org;
  let project;

  const team1 = TestStubs.Team();
  const team2 = TestStubs.Team({
    id: '2',
    slug: 'team-slug-2',
    name: 'Team Name 2',
    hasAccess: true,
  });

  beforeEach(function () {
    org = TestStubs.Organization();
    project = TestStubs.ProjectDetails();

    TeamStore.loadInitialData([team1, team2]);

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team1],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [team1, team2],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    const {container} = render(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />
    );

    expect(container).toSnapshot();
  });

  it('can remove a team from project', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team1, team2],
    });

    const endpoint = `/projects/${org.slug}/${project.slug}/teams/${team1.slug}/`;
    const mock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'DELETE',
      statusCode: 200,
    });

    const endpoint2 = `/projects/${org.slug}/${project.slug}/teams/${team2.slug}/`;
    const mock2 = MockApiClient.addMockResponse({
      url: endpoint2,
      method: 'DELETE',
      statusCode: 200,
    });

    render(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />
    );

    expect(mock).not.toHaveBeenCalled();

    userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]);

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    // Wait for row to be removed
    await waitForElementToBeRemoved(() => screen.queryByText('#team-slug'));

    // Remove second team
    userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]);

    // Modal opens because this is the last team in project
    renderGlobalModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    userEvent.click(screen.getByTestId('confirm-button'));

    expect(mock2).toHaveBeenCalledWith(
      endpoint2,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('removes team from project when project team is not in org list', async function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team1, team2],
    });

    const endpoint = `/projects/${org.slug}/${project.slug}/teams/${team1.slug}/`;
    const mock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'DELETE',
    });

    const endpoint2 = `/projects/${org.slug}/${project.slug}/teams/${team2.slug}/`;
    const mock2 = MockApiClient.addMockResponse({
      url: endpoint2,
      method: 'DELETE',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [
        TestStubs.Team({
          id: '3',
          slug: 'team-slug-3',
          name: 'Team Name 3',
          hasAccess: true,
        }),
      ],
    });

    render(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />
    );

    expect(mock).not.toHaveBeenCalled();

    // Click "Remove"
    userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]);

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    await waitForElementToBeRemoved(() => screen.queryByText('#team-slug'));

    // Remove second team
    userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]);

    // Modal opens because this is the last team in project
    renderGlobalModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click confirm
    userEvent.click(screen.getByTestId('confirm-button'));

    expect(mock2).toHaveBeenCalledWith(
      endpoint2,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('can associate a team with project', function () {
    const endpoint = `/projects/${org.slug}/${project.slug}/teams/${team2.slug}/`;
    const mock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 200,
    });

    render(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />
    );

    expect(mock).not.toHaveBeenCalled();

    // Add a team
    userEvent.click(screen.getAllByRole('button', {name: 'Add Team'})[1]);
    userEvent.click(screen.getByText('#team-slug-2'));

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('creates a new team adds it to current project using the "create team modal" in dropdown', async function () {
    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [org],
    });
    const addTeamToProject = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/new-team/`,
      method: 'POST',
    });
    const createTeam = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'POST',
      body: {slug: 'new-team'},
    });

    render(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        project={project}
        organization={org}
      />
    );

    // Add new team
    userEvent.click(screen.getAllByRole('button', {name: 'Add Team'})[1]);

    // XXX(epurkhiser): Create Team should really be a button
    userEvent.click(screen.getByRole('link', {name: 'Create Team'}));

    renderGlobalModal();
    await screen.findByRole('dialog');

    userEvent.type(screen.getByRole('textbox', {name: 'Team Name'}), 'new-team');
    userEvent.click(screen.getByRole('button', {name: 'Create Team'}));

    await waitFor(() => expect(createTeam).toHaveBeenCalledTimes(1));

    expect(createTeam).toHaveBeenCalledWith(
      '/organizations/org-slug/teams/',
      expect.objectContaining({
        data: {slug: 'new-team'},
      })
    );

    expect(addTeamToProject).toHaveBeenCalledTimes(1);
    expect(addTeamToProject).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/teams/new-team/',
      expect.anything()
    );
  });
});
