import React from 'react';

import {shallow} from 'enzyme';
import {ProjectUserReports} from 'app/views/projectUserReports';

describe('projectUserReports', function() {
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/user-reports/',
      body: [TestStubs.UserReport()],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders', function() {
    const params = {
      location: {query: {}},
      setProjectNavSection: jest.fn(),
      params: {
        orgId: 'org-slug',
        projectId: 'project-slug',
      },
    };
    const wrapper = shallow(
      <ProjectUserReports {...params} />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });
});
