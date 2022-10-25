import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {TeamProjects as OrganizationTeamProjects} from 'sentry/views/settings/organizationTeams/teamProjects';

describe('OrganizationTeamProjects', function () {
  let team;
  let getMock;
  let putMock;
  let postMock;
  let deleteMock;

  const project = TestStubs.Project({teams: [team]});
  const project2 = TestStubs.Project({
    id: '3',
    slug: 'project-slug-2',
    name: 'Project Name 2',
  });

  const {routerContext, organization} = initializeOrg({
    organization: TestStubs.Organization({slug: 'org-slug'}),
    projects: [project, project2],
  });

  beforeEach(function () {
    team = TestStubs.Team({slug: 'team-slug'});

    getMock = Client.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project, project2],
    });

    putMock = Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
      body: project,
    });

    postMock = Client.addMockResponse({
      method: 'POST',
      url: `/projects/org-slug/${project2.slug}/teams/${team.slug}/`,
      body: {...project2, teams: [team]},
      status: 201,
    });

    deleteMock = Client.addMockResponse({
      method: 'DELETE',
      url: `/projects/org-slug/${project2.slug}/teams/${team.slug}/`,
      body: {...project2, teams: []},
      status: 204,
    });
  });

  afterEach(function () {
    Client.clearMockResponses();
  });

  it('fetches linked and unlinked projects', function () {
    render(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      {context: routerContext}
    );

    expect(getMock).toHaveBeenCalledTimes(2);

    expect(getMock.mock.calls[0][1].query.query).toBe('team:team-slug');
    expect(getMock.mock.calls[1][1].query.query).toBe('!team:team-slug');
  });

  it('Should render', async function () {
    const {container} = render(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      {context: routerContext}
    );

    expect(await screen.findByText('project-slug')).toBeInTheDocument();
    expect(container).toSnapshot();
  });

  it('Should allow bookmarking', async function () {
    render(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      {context: routerContext}
    );

    const stars = await screen.findAllByRole('button', {name: 'Bookmark Project'});
    expect(stars).toHaveLength(2);

    userEvent.click(stars[0]);
    expect(
      screen.getByRole('button', {name: 'Bookmark Project', pressed: true})
    ).toBeInTheDocument();

    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it('Should allow adding and removing projects', async function () {
    render(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      {context: routerContext}
    );

    expect(getMock).toHaveBeenCalledTimes(2);

    userEvent.click(await screen.findByText('Add Project'));
    userEvent.click(screen.getByRole('option', {name: 'project-slug-2'}));

    expect(postMock).toHaveBeenCalledTimes(1);

    // find second project's remove button
    const removeButtons = await screen.findAllByRole('button', {name: 'Remove'});
    userEvent.click(removeButtons[1]);

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('handles filtering unlinked projects', async function () {
    render(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      {context: routerContext}
    );

    expect(getMock).toHaveBeenCalledTimes(2);

    userEvent.click(await screen.findByText('Add Project'));

    userEvent.type(screen.getByRole('textbox'), 'a');

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
