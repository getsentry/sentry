import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';

import ManageDashboards from 'app/views/dashboardsV2/manage';

describe('Dashboards > Detail', function () {
  const mockUnauthorizedOrg = TestStubs.Organization({
    features: ['global-views', 'dashboards-basic', 'dashboards-edit', 'discover-query'],
  });

  const mockAuthorizedOrg = TestStubs.Organization({
    features: [
      'global-views',
      'dashboards-basic',
      'dashboards-edit',
      'discover-query',
      'dashboards-manage',
    ],
  });
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/create/',
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
  });
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('denies access on missing feature', function () {
    const wrapper = mountWithTheme(
      <ManageDashboards
        organization={mockUnauthorizedOrg}
        location={{query: {}}}
        router={{}}
      />
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
      />
    );

    const content = wrapper.find('DocumentTitle');
    expect(content.text()).toContain('You need at least one project to use this view');
  });

  it('creates new dashboard', async function () {
    const org = TestStubs.Organization({
      features: [
        'global-views',
        'dashboards-basic',
        'dashboards-edit',
        'discover-query',
        'dashboards-manage',
      ],
      projects: [TestStubs.Project()],
    });
    const wrapper = mountWithTheme(
      <ManageDashboards organization={org} location={{query: {}}} router={{}} />
    );
    await tick();
    wrapper.find('PageHeader').find('Button').simulate('click');
    await tick();
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/dashboards/',
      state: {
        dashboardState: 'create',
        modifiedDashboard: {
          createdBy: undefined,
          dateCreated: '',
          id: '',
          title: 'Untitled dashboard',
          widgets: [],
        },
      },
    });
  });
});
