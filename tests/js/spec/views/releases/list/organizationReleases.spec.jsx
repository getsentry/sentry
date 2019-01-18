import React from 'react';
import {mount} from 'enzyme';

import OrganizationReleases from 'app/views/releases/list/organizationReleases';

describe('OrganizationReleases', function() {
  let props;
  let wrapper;

  beforeEach(function() {
    const organization = TestStubs.Organization({
      projects: [TestStubs.Project()],
      features: ['sentry10', 'global-views'],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [TestStubs.Commit({version: 'abc'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: TestStubs.Environments(),
    });

    props = {
      organization,
      params: {orgId: organization.slug},
      location: {query: {per_page: 0, query: 'derp'}},
    };

    wrapper = mount(
      <OrganizationReleases {...props} />,
      TestStubs.routerContext([{organization}])
    );
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders', function() {
    expect(wrapper).toMatchSnapshot();
  });
});
