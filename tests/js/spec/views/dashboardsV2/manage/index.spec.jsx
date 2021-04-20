import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ManageDashboards from 'app/views/dashboardsV2/manage';

describe('Dashboards > Detail', function () {
  const mockUnauthorizedOrg = TestStubs.Organization({
    features: [],
  });

  const mockAuthorizedOrg = TestStubs.Organization({
    features: ['dashboards-manage'],
  });
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
  });
  it('denies access on missing feature', function () {
    const wrapper = mountWithTheme(
      <ManageDashboards
        organization={mockUnauthorizedOrg}
        location={{query: {}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );

    const content = wrapper.find('PageContent');
    expect(content.text()).toContain("You don't have access to this feature");
  });

  it('denies access on no projects', function () {
    const wrapper = mountWithTheme(
      <ManageDashboards
        organization={mockAuthorizedOrg}
        location={{query: {}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );

    const content = wrapper.find('SentryDocumentTitle');
    expect(content.text()).toContain('You need at least one project to use this view');
  });
});
