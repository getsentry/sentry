import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import ProjectsStore from 'app/stores/projectsStore';
import OrganizationProjectsViewContainer from 'app/views/settings/organization/projects/organizationProjectsView';

describe('OrganizationProjectsView', function() {
  let org;
  let getMock;
  let putMock;
  beforeEach(function() {
    let project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);
    org = TestStubs.Organization();

    getMock = Client.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [[[], 1]],
    });

    putMock = Client.addMockResponse({
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

      expect(getMock).toHaveBeenCalledTimes(1);

      expect(putMock).toHaveBeenCalledTimes(0);

      wrapper.find('.icon-star-outline').simulate('click');
      expect(wrapper.find('.icon-star-solid')).toBeTruthy();
      expect(putMock).toHaveBeenCalledTimes(1);
    });
  });
});
