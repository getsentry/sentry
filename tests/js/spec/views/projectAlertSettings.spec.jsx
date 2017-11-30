import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import ProjectAlertSettings from 'app/views/projectAlertSettings';

describe('ProjectAlertSettings', function() {
  let org;
  let project;

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();

    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: [],
    });
  });

  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(
        <ProjectAlertSettings
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
        />,
        {
          context: {
            router: TestStubs.router(),
          },
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
