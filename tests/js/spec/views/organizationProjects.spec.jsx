import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import OrganizationProjectsViewContainer from 'app/views/settings/organization/projects/organizationProjectsView';

describe('OrganizationProjectsView', function() {
  let org;
  let project;
  let projectsGetMock;
  let statsGetMock;
  let projectsPutMock;

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

  describe('render()', function() {
    it('Should render the projects in the store', function() {
      let wrapper = mount(
        <OrganizationProjectsViewContainer params={{orgId: org.slug}} />,
        TestStubs.routerOrganizationContext()
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
  });
});
