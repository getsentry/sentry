import React from 'react';
import {mount} from 'enzyme';
import OrganizationStats from 'app/views/organizationStats';

describe('OrganizationStats', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      method: 'GET',
      body: [TestStubs.Project()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats/',
      method: 'GET',
      body: [],
    });
  });

  it('renders', function(done) {
    let wrapper = mount(
      <OrganizationStats params={{orgId: 'org-slug'}} location={TestStubs.location()} />,
      TestStubs.routerContext()
    );

    window.setImmediate(() => {
      wrapper.update();
      expect(wrapper).toMatchSnapshot();
      done();
    });
  });
});
