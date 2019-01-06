import React from 'react';

import {shallow, mount} from 'enzyme';
import App from 'app/views/app';
import ProjectTeams from 'app/views/settings/project/projectTeams';
import * as modals from 'app/actionCreators/modal';

jest.unmock('app/actionCreators/modal');

describe('ProjectTeams', function() {
  let org;
  let project;
  let team;
  let team2 = {
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

  it('renders', function() {
    let wrapper = shallow(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('can remove a team from project', async function() {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team, team2],
    });

    let endpoint = `/projects/${org.slug}/${project.slug}/teams/${team.slug}/`;
    let mock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'DELETE',
      statusCode: 200,
    });

    let endpoint2 = `/projects/${org.slug}/${project.slug}/teams/${team2.slug}/`;
    let mock2 = MockApiClient.addMockResponse({
      url: endpoint2,
      method: 'DELETE',
      statusCode: 200,
    });

    let wrapper = mount(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />,
      TestStubs.routerContext()
    );

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

  it('can associate a team with project', function() {
    let endpoint = `/projects/${org.slug}/${project.slug}/teams/${team2.slug}/`;
    let mock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 200,
    });

    let wrapper = mount(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        organization={org}
      />,
      TestStubs.routerContext()
    );

    expect(mock).not.toHaveBeenCalled();

    // open dropdown
    wrapper.find('DropdownButton').simulate('click');

    // click a team
    let el = wrapper.find('AutoCompleteItem').first();
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
      url: '/organizations/',
      body: [org],
    });

    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: {},
    });
    let addTeamToProject = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/new-team/`,
      method: 'POST',
    });
    let createTeam = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'POST',
      body: {slug: 'new-team'},
    });

    let wrapper = mount(
      <App params={{orgId: org.slug}}>
        <ProjectTeams
          params={{orgId: org.slug, projectId: project.slug}}
          project={project}
          organization={org}
        />
      </App>,
      TestStubs.routerContext()
    );

    // open dropdown
    wrapper.find('DropdownButton').simulate('click');

    // Click "Create Team" inside of dropdown
    wrapper.find('StyledCreateTeamLink').simulate('click');

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
