import React from 'react';

import {shallow} from 'enzyme';
import {ProjectUserFeedback} from 'app/views/projectUserFeedback';

describe('projectUserFeedback', function() {
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/user-reports/',
      body: [TestStubs.UserFeedback()],
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
      <ProjectUserFeedback {...params} />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });
});
