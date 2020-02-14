import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ReleasesV2List from 'app/views/releasesV2/list/';

// waiting for api to be finished
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('ReleasesV2List', function() {
  const {organization, routerContext, router} = initializeOrg({
    organization: {features: ['releases-v2']},
  });
  const props = {
    router,
    organization,
    selection: {projects: [2]},
    params: {orgId: organization.slug},
    location: {query: {query: 'derp'}},
  };
  let wrapper, endpointMock;

  beforeEach(function() {
    endpointMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [TestStubs.Release({version: 'abc'}), TestStubs.Release({version: 'def'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    wrapper = mountWithTheme(<ReleasesV2List {...props} />, routerContext);
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders list', function() {
    const items = wrapper.find('StyledPanelItem');

    expect(items).toHaveLength(20);
    // expect(items.at(0).text()).toContain('First');
    // expect(items.at(1).text()).toContain('Second');
  });

  it('displays empty state', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    expect(wrapper.find('StyledPanelItem')).toHaveLength(0);
    expect(wrapper.text()).toContain('There are no releases.');
  });

  it('searches for a release', async function() {
    const input = wrapper.find('input');

    expect(endpointMock).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({query: {per_page: 50, query: 'derp'}})
    );

    expect(input.prop('value')).toBe('derp');

    input.simulate('change', {target: {value: 'a'}}).simulate('submit');

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/releases-v2/',
      query: {
        query: 'a',
      },
    });
  });

  // TODO(releasesv2): test toggle 24h/14d charts
});
