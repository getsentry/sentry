import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import ProjectTeams from 'app/views/settings/project/projectTeams';
import {openCreateTeamModal} from 'app/actionCreators/modal';

jest.unmock('app/actionCreators/modal');
jest.mock('app/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
}));

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
    org = TestStubs.Organization();
    project = TestStubs.ProjectDetails();
    team = TestStubs.Team();

    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team],
    });
    Client.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [team, team2],
    });
  });

  afterEach(function() {
    Client.clearMockResponses();
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
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team, team2],
    });

    let endpoint = `/projects/${org.slug}/${project.slug}/teams/${team.slug}/`;
    let mock = Client.addMockResponse({
      url: endpoint,
      method: 'DELETE',
      statusCode: 200,
    });

    let endpoint2 = `/projects/${org.slug}/${project.slug}/teams/${team2.slug}/`;
    let mock2 = Client.addMockResponse({
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
    let mock = Client.addMockResponse({
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

  it('opens "create team modal" when creating a new team from dropdown', function() {
    let wrapper = mount(
      <ProjectTeams
        params={{orgId: org.slug, projectId: project.slug}}
        project={project}
        organization={org}
      />,
      TestStubs.routerContext()
    );

    // open dropdown
    wrapper.find('DropdownButton').simulate('click');

    // Click "Create Team" inside of dropdown
    wrapper.find('StyledCreateTeamLink').simulate('click');

    // action creator to open "create team modal" is called
    expect(openCreateTeamModal).toHaveBeenCalledWith(
      expect.objectContaining({
        project: expect.objectContaining({
          slug: project.slug,
        }),
        organization: expect.objectContaining({
          slug: org.slug,
        }),
      })
    );
  });
});
