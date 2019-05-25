import React from 'react';

import {shallow} from 'enzyme';
import {ProjectUserFeedback} from 'app/views/userFeedback/projectUserFeedback';

describe('projectUserFeedback', function() {
  beforeEach(function() {
    const pageLinks =
      '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/user-reports/',
      body: [TestStubs.UserFeedback()],
      headers: {Link: pageLinks},
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders', function() {
    const params = {
      api: new MockApiClient(),
      location: {query: {}},
      setProjectNavSection: jest.fn(),
      params: {
        orgId: 'org-slug',
        projectId: 'project-slug',
      },
    };
    const wrapper = shallow(
      <ProjectUserFeedback {...params} organization={TestStubs.Organization()} />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });
});
