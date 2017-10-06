import React from 'react';
import {shallow} from 'enzyme';

import ProjectAlertSettings from 'app/views/projectAlertSettings';

describe('ProjectAlertSettings', function() {
  beforeEach(function() {
    this.org = TestStubs.Organization();
    this.project = TestStubs.Project();

    MockApiClient.addMockResponse({
      url: `/projects/${this.org.slug}/${this.project.slug}/`,
      method: 'GET',
      body: this.project
    });
    MockApiClient.addMockResponse({
      url: `/projects/${this.org.slug}/${this.project.slug}/plugins/`,
      method: 'GET',
      body: []
    });
  });

  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(
        <ProjectAlertSettings
          params={{orgId: this.org.slug, projectId: this.project.slug}}
          organization={this.org}
        />,
        {
          context: {
            router: TestStubs.router()
          }
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
