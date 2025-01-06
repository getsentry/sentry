import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationTeamProjects from 'sentry/views/settings/organizationTeams/teamProjects';

describe('OrganizationTeamProjects', function () {
  let getMock!: jest.Mock;
  let putMock!: jest.Mock;
  let postMock!: jest.Mock;
  let deleteMock!: jest.Mock;

  const team = TeamFixture({slug: 'team-slug'});
  const project = ProjectFixture({
    teams: [team],
    access: ['project:read', 'project:write', 'project:admin'],
  });
  const project2 = ProjectFixture({
    id: '3',
    slug: 'project-slug-2',
    name: 'Project Name 2',
    access: ['project:read', 'project:write', 'project:admin'],
  });

  const {router, routerProps, organization} = initializeOrg({
    organization: OrganizationFixture({slug: 'org-slug'}),
    projects: [project, project2],
    router: {params: {teamId: team.slug}},
  });

  beforeEach(function () {
    getMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project, project2],
    });

    putMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
      body: project,
    });

    postMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/projects/org-slug/${project2.slug}/teams/${team.slug}/`,
      body: {...project2, teams: [team]},
      status: 201,
    });

    deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: `/projects/org-slug/${project2.slug}/teams/${team.slug}/`,
      body: {...project2, teams: []},
      status: 204,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('should fetch linked and unlinked projects', async function () {
    render(<OrganizationTeamProjects {...routerProps} team={team} />, {
      router,
      organization,
    });

    expect(await screen.findByText('project-slug')).toBeInTheDocument();

    expect(getMock).toHaveBeenCalledTimes(2);

    expect(getMock.mock.calls[0][1].query.query).toBe('team:team-slug');
    expect(getMock.mock.calls[1][1].query.query).toBe('!team:team-slug');
  });

  it('should allow bookmarking', async function () {
    render(<OrganizationTeamProjects {...routerProps} team={team} />, {
      router,
      organization,
    });

    const stars = await screen.findAllByRole('button', {name: 'Bookmark'});
    expect(stars).toHaveLength(2);

    await userEvent.click(stars[0]!);
    expect(
      screen.getByRole('button', {name: 'Remove Bookmark', pressed: true})
    ).toBeInTheDocument();

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        data: {isBookmarked: true},
      })
    );
  });

  it('should allow adding and removing projects', async function () {
    render(<OrganizationTeamProjects {...routerProps} team={team} />, {
      router,
      organization,
    });

    expect(getMock).toHaveBeenCalledTimes(2);

    await userEvent.click(await screen.findByText('Add Project'));
    await userEvent.click(screen.getByRole('option', {name: 'project-slug-2'}));

    expect(postMock).toHaveBeenCalledTimes(1);

    // find second project's remove button
    const removeButtons = await screen.findAllByRole('button', {name: 'Remove'});
    await userEvent.click(removeButtons[1]!);

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('handles filtering unlinked projects', async function () {
    render(<OrganizationTeamProjects {...routerProps} team={team} />, {
      router,
      organization,
    });

    expect(getMock).toHaveBeenCalledTimes(2);

    await userEvent.click(await screen.findByText('Add Project'));

    await userEvent.type(screen.getByRole('textbox'), 'a');

    expect(getMock).toHaveBeenCalledTimes(3);
    expect(getMock).toHaveBeenCalledWith(
      '/organizations/org-slug/projects/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: '!team:team-slug a',
        }),
      })
    );
  });
});
