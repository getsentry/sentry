import React from 'react';
import {mount} from 'enzyme';

import ProjectAlertRules from 'app/views/projectAlertRules';

describe('projectAlertRules', function() {
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/projects/org1/project1/rules/',
      body: [TestStubs.ProjectAlertRule()],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders', function() {
    const routes = [];

    const wrapper = mount(
      <ProjectAlertRules
        routes={routes}
        params={{orgId: 'org1', projectId: 'project1'}}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });
});
