import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import OrganizationProjectsContainer from 'app/views/settings/organizationProjects';

describe('OrganizationProjects', function() {
  let org;
  let project;
  let projectsGetMock;
  let statsGetMock;
  let projectsPutMock;
  let routerContext = TestStubs.routerContext();

  beforeEach(function() {
    project = TestStubs.Project();
    org = TestStubs.Organization();

    projectsGetMock = Client.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    statsGetMock = Client.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [[[], 1]],
    });

    projectsPutMock = Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
    });
  });

  afterEach(function() {
    Client.clearMockResponses();
  });

  it('Should render the projects in the store', function() {
    let wrapper = mount(
      <OrganizationProjectsContainer params={{orgId: org.slug}} />,
      routerContext
    );
    expect(wrapper).toMatchSnapshot();

    expect(wrapper.find('.project-name').text()).toBe('Project Name');

    expect(projectsGetMock).toHaveBeenCalledTimes(1);

    expect(statsGetMock).toHaveBeenCalledTimes(1);

    expect(projectsPutMock).toHaveBeenCalledTimes(0);

    wrapper.find('.icon-star-outline').simulate('click');
    expect(wrapper.find('.icon-star-solid')).toBeTruthy();
    expect(projectsPutMock).toHaveBeenCalledTimes(1);
  });

  it('should search organization projects', async function() {
    let searchMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/?query=${project.slug}`,
      body: [],
    });
    let wrapper = mount(
      <OrganizationProjectsContainer location={{}} params={{orgId: org.slug}} />,
      routerContext
    );

    expect(searchMock).not.toHaveBeenCalled();

    wrapper.find('Input').simulate('change', {target: {value: `${project.slug}`}});

    expect(wrapper.state('searchQuery')).toBe(`${project.slug}`);
    expect(searchMock).toHaveBeenCalled();
    expect(searchMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/projects/?query=${project.slug}`,
      expect.objectContaining({
        method: 'GET',
      })
    );

    wrapper.find('PanelHeader form').simulate('submit');
    expect(routerContext.context.router.push).toHaveBeenCalledTimes(1);
  });
});
