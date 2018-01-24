import React from 'react';
import PropTypes from 'prop-types';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import ProjectsStore from 'app/stores/projectsStore';
import OrganizationProjectsViewContainer from 'app/views/settings/organization/projects/organizationProjectsView';

describe('OrganizationProjectsView', function() {
  let sandbox;
  let org;
  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    let project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);
    org = TestStubs.Organization();

    Client.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [[[], 1]],
    });
    Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
    });
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    it('Should render the projects in the store', function() {
      let wrapper = mount(
        <OrganizationProjectsViewContainer params={{orgId: org.slug}} />,
        {
          context: {
            organization: org,
            location: TestStubs.location(),
            router: TestStubs.router(),
          },
          childContextTypes: {
            organization: PropTypes.object,
            location: PropTypes.object,
            router: PropTypes.object,
          },
        }
      );
      expect(wrapper).toMatchSnapshot();

      expect(wrapper.find('.project-name').text()).toBe('Project Name');

      expect(
        Client.findMockResponse('/projects/org-slug/project-slug/', {method: 'PUT'})[0]
          .callCount
      ).toBe(0);

      wrapper.find('.icon-star-outline').simulate('click');
      expect(wrapper.find('.icon-star-solid')).toBeTruthy();
      expect(
        Client.findMockResponse('/projects/org-slug/project-slug/', {method: 'PUT'})[0]
          .callCount
      ).toBe(1);
    });
  });
});
