import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'app/api';
import {TeamProjects as OrganizationTeamProjects} from 'app/views/settings/organizationTeams/teamProjects';

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

  it('fetches linked and unlinked projects', async function () {
    mountWithTheme(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      routerContext
    );

    expect(getMock).toHaveBeenCalledTimes(2);

    expect(getMock.mock.calls[0][1].query.query).toBe('team:team-slug');
    expect(getMock.mock.calls[1][1].query.query).toBe('!team:team-slug');
  });

  it('Should render', async function () {
    const wrapper = mountWithTheme(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper).toSnapshot();
    expect(wrapper.find('.project-name').first().text()).toBe('project-slug');
  });

  it('Should allow bookmarking', async function () {
    const wrapper = mountWithTheme(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    const stars = wrapper.find('BookmarkStar');
    expect(stars).toHaveLength(2);
    stars.first().simulate('click');
    expect(wrapper.find('Star').first().prop('isBookmarked')).toBeTruthy();

    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it('Should allow adding and removing projects', async function () {
    const wrapper = mountWithTheme(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    const add = wrapper.find('DropdownButton').first();
    add.simulate('click');

    const el = wrapper.find('AutoCompleteItem').at(1);
    el.simulate('click');

    wrapper.update();

    expect(postMock).toHaveBeenCalledTimes(1);

    await tick();
    wrapper.update();

    // find second project's remove button
    const remove = wrapper.find('PanelBody Button').at(1);
    remove.simulate('click');

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('handles filtering unlinked projects', async function () {
    const wrapper = mountWithTheme(
      <OrganizationTeamProjects
        api={new MockApiClient()}
        organization={organization}
        params={{orgId: 'org-slug', teamId: team.slug}}
        location={{query: {}}}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(getMock).toHaveBeenCalledTimes(2);

    const add = wrapper.find('DropdownButton').first();
    add.simulate('click');

    const input = wrapper.find('StyledInput');
    input.simulate('change', {target: {value: 'a'}});

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
