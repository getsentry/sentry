import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import App from 'app/views/app';
import ProjectTeams from 'app/views/settings/project/projectTeams';
import * as modals from 'app/actionCreators/modal';

jest.unmock('app/actionCreators/modal');

describe('ProjectTeams', function() {
  let org;
  let project;
  let team;
  const team2 = {
    id: '2',
    slug: 'team-slug-2',
    name: 'Team Name 2',
    hasAccess: true,
  };

  beforeEach(function() {
    jest.spyOn(modals, 'openCreateTeamModal');
    org = TestStubs.Organization();
    project = TestStubs.ProjectDetails();
    team = TestStubs.Team();

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [team, team2],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
    modals.openCreateTeamModal.mockRestore();
  });

  it('renders', async function() {
    const wrapper = mountWithTheme(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />,
      TestStubs.routerContext()
    );
    // Wait for team list to fetch.
    await wrapper.update();

    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });

  it('can remove a team from project', async function() {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team, team2],
    });

    const endpoint = `/projects/${org.slug}/${project.slug}/teams/${team.slug}/`;
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

    const wrapper = mountWithTheme(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />,
      TestStubs.routerContext()
    );
    // Wait for team list to fetch.
    await wrapper.update();

    expect(mock).not.toHaveBeenCalled();

    // Click "Remove"
    wrapper
      .find('PanelBody Button')
      .first()
      .simulate('click');

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    await tick();

    // Remove second team
    wrapper
      .update()
      .find('PanelBody Button')
      .first()
      .simulate('click');

    // Modal opens because this is the last team in project
    // Click confirm
    wrapper.find('ModalDialog Button[priority="primary"]').simulate('click');

    expect(mock2).toHaveBeenCalledWith(
      endpoint2,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('removes team from project when project team is not in org list', async function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team, team2],
    });

    const endpoint = `/projects/${org.slug}/${project.slug}/teams/${team.slug}/`;
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

    const wrapper = mountWithTheme(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />,
      TestStubs.routerContext()
    );
    // Wait for team list to fetch.
    await wrapper.update();

    expect(mock).not.toHaveBeenCalled();

    // Click "Remove"
    wrapper
      .find('PanelBody Button')
      .first()
      .simulate('click');

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    await tick();

    // Remove second team
    wrapper
      .update()
      .find('PanelBody Button')
      .first()
      .simulate('click');

    // Modal opens because this is the last team in project
    // Click confirm
    wrapper.find('ModalDialog Button[priority="primary"]').simulate('click');

    expect(mock2).toHaveBeenCalledWith(
      endpoint2,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('can associate a team with project', async function() {
    const endpoint = `/projects/${org.slug}/${project.slug}/teams/${team2.slug}/`;
    const mock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 200,
    });

    const wrapper = mountWithTheme(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />,
      TestStubs.routerContext()
    );
    // Wait for team list to fetch.
    await wrapper.update();

    expect(mock).not.toHaveBeenCalled();

    // open dropdown
    wrapper.find('DropdownButton').simulate('click');

    // click a team
    const el = wrapper.find('AutoCompleteItem').first();
    el.simulate('click');

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('creates a new team adds it to current project using the "create team modal" in dropdown', async function() {
    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/assistant/?v2',
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

    const wrapper = mountWithTheme(
      <App params={{orgId: org.slug}}>
        <ProjectTeams
          params={{orgId: org.slug, projectId: project.slug}}
          project={project}
          organization={org}
        />
      </App>,
      TestStubs.routerContext()
    );
    // Wait for team list to fetch.
    await wrapper.update();

    // Open the dropdown
    wrapper.find('TeamSelect DropdownButton').simulate('click');

    // Click "Create Team" inside of dropdown
    wrapper.find('TeamSelect StyledCreateTeamLink').simulate('click');

    // action creator to open "create team modal" is called
    expect(modals.openCreateTeamModal).toHaveBeenCalledWith(
      expect.objectContaining({
        project: expect.objectContaining({
          slug: project.slug,
        }),
        organization: expect.objectContaining({
          slug: org.slug,
        }),
      })
    );

    // Two ticks are required
    await tick();
    await tick();
    wrapper.update();

    wrapper.find('input[name="slug"]').simulate('change', {target: {value: 'new-team'}});
    wrapper.find('[data-test-id="create-team-form"] form').simulate('submit');
    expect(createTeam).toHaveBeenCalledTimes(1);
    expect(createTeam).toHaveBeenCalledWith(
      '/organizations/org-slug/teams/',
      expect.objectContaining({
        data: {slug: 'new-team'},
      })
    );

    await tick();

    expect(addTeamToProject).toHaveBeenCalledTimes(1);
    expect(addTeamToProject).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/teams/new-team/',
      expect.anything()
    );
  });
});
