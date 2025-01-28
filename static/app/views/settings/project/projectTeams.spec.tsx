import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import ProjectTeams from 'sentry/views/settings/project/projectTeams';

describe('ProjectTeams', function () {
  let org: Organization;
  let project: Project;

  const team1WithAdmin = TeamFixture({
    access: ['team:read', 'team:write', 'team:admin'],
  });
  const team2WithAdmin = TeamFixture({
    id: '2',
    slug: 'team-slug-2',
    name: 'Team Name 2',
    hasAccess: true,
    access: ['team:read', 'team:write', 'team:admin'],
  });
  const team3NoAdmin = TeamFixture({
    id: '3',
    slug: 'team-slug-3',
    name: 'Team Name 3',
    hasAccess: true,
    access: ['team:read'],
  });

  beforeEach(function () {
    const initialData = initializeOrg();
    org = initialData.organization;
    project = {
      ...initialData.project,
      access: ['project:admin', 'project:write', 'project:admin'],
    };

    TeamStore.loadInitialData([team1WithAdmin, team2WithAdmin]);

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team1WithAdmin],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [team1WithAdmin, team2WithAdmin],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('can remove a team from project', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team1WithAdmin, team2WithAdmin],
    });

    const endpoint1 = `/projects/${org.slug}/${project.slug}/teams/${team1WithAdmin.slug}/`;
    const mock1 = MockApiClient.addMockResponse({
      url: endpoint1,
      method: 'DELETE',
      statusCode: 200,
    });

    const endpoint2 = `/projects/${org.slug}/${project.slug}/teams/${team2WithAdmin.slug}/`;
    const mock2 = MockApiClient.addMockResponse({
      url: endpoint2,
      method: 'DELETE',
      statusCode: 200,
    });

    render(<ProjectTeams organization={org} project={project} />);

    expect(await screen.findByText('Project Teams for project-slug')).toBeInTheDocument();

    expect(mock1).not.toHaveBeenCalled();

    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]!);

    renderGlobalModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Remove Team'));
    await waitFor(() => {
      expect(mock1).toHaveBeenCalledWith(
        endpoint1,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
    expect(screen.queryByText('#team-slug')).not.toBeInTheDocument();

    // Remove second team
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]!);
    await userEvent.click(screen.getByText('Remove Team'));
    await waitFor(() => {
      expect(mock2).toHaveBeenCalledWith(
        endpoint2,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  it('cannot remove a team without admin scopes', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team1WithAdmin, team2WithAdmin, team3NoAdmin],
    });

    const endpoint1 = `/projects/${org.slug}/${project.slug}/teams/${team1WithAdmin.slug}/`;
    const mock1 = MockApiClient.addMockResponse({
      url: endpoint1,
      method: 'DELETE',
      statusCode: 200,
    });

    const endpoint3 = `/projects/${org.slug}/${project.slug}/teams/${team3NoAdmin.slug}/`;
    const mock3 = MockApiClient.addMockResponse({
      url: endpoint3,
      method: 'DELETE',
      statusCode: 200,
    });

    render(<ProjectTeams organization={org} project={project} />);

    expect(await screen.findByText('Project Teams for project-slug')).toBeInTheDocument();

    // Remove first team
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]!);
    renderGlobalModal();
    await userEvent.click(screen.getByText('Remove Team'));
    await waitFor(() => {
      expect(mock1).toHaveBeenCalledWith(
        endpoint1,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
    expect(screen.queryByText('#team-slug')).not.toBeInTheDocument();

    // Remove third team, but button should be disabled
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[1]!);
    expect(mock3).not.toHaveBeenCalled();
  });

  it('removes team from project when project team is not in org list', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team1WithAdmin, team2WithAdmin],
    });

    const endpoint1 = `/projects/${org.slug}/${project.slug}/teams/${team1WithAdmin.slug}/`;
    const mock1 = MockApiClient.addMockResponse({
      url: endpoint1,
      method: 'DELETE',
    });

    const endpoint2 = `/projects/${org.slug}/${project.slug}/teams/${team2WithAdmin.slug}/`;
    const mock2 = MockApiClient.addMockResponse({
      url: endpoint2,
      method: 'DELETE',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [team3NoAdmin],
    });

    render(<ProjectTeams organization={org} project={project} />);

    expect(await screen.findByText('Project Teams for project-slug')).toBeInTheDocument();

    expect(mock1).not.toHaveBeenCalled();

    // Remove first team
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]!);
    renderGlobalModal();
    await userEvent.click(screen.getByText('Remove Team'));
    await waitFor(() => {
      expect(mock1).toHaveBeenCalledWith(
        endpoint1,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
    expect(screen.queryByText('#team-slug')).not.toBeInTheDocument();

    // Remove second team
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]!);

    // Modal opens because this is the last team in project
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click confirm
    await userEvent.click(screen.getByText('Remove Team'));

    await waitFor(() => {
      expect(mock2).toHaveBeenCalledWith(
        endpoint2,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  it('can associate a team with project', async function () {
    const endpoint = `/projects/${org.slug}/${project.slug}/teams/${team2WithAdmin.slug}/`;
    const mock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 200,
    });

    render(<ProjectTeams organization={org} project={project} />);

    expect(await screen.findByText('Project Teams for project-slug')).toBeInTheDocument();

    expect(mock).not.toHaveBeenCalled();

    // Add a team
    await userEvent.click(screen.getAllByRole('button', {name: 'Add Team'})[1]!);
    await userEvent.click(screen.getByText('#team-slug-2'));

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('creates a new team adds it to current project using the "create team modal" in dropdown', async function () {
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
      body: TeamFixture({slug: 'new-team'}),
    });

    render(<ProjectTeams project={project} organization={org} />);

    expect(await screen.findByText('Project Teams for project-slug')).toBeInTheDocument();

    // Add new team
    await userEvent.click(screen.getAllByRole('button', {name: 'Add Team'})[1]!);

    // XXX(epurkhiser): Create Team should really be a button
    await userEvent.click(screen.getByRole('link', {name: 'Create Team'}));

    renderGlobalModal();
    await screen.findByRole('dialog');

    await userEvent.type(screen.getByRole('textbox', {name: 'Team Name'}), 'new-team');
    await userEvent.click(screen.getByRole('button', {name: 'Create Team'}));

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
