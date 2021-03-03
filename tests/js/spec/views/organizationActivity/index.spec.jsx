import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import OrganizationActivity from 'app/views/organizationActivity';

describe('OrganizationActivity', function () {
  const {router, organization, routerContext} = initializeOrg();
  let params = {};

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/activity/',
      body: [
        TestStubs.ActivityFeed(),
        TestStubs.ActivityFeed({
          id: '49',
          data: {},
          type: 'set_public',
        }),
      ],
    });
    params = {
      ...router,
      params: {
        orgId: organization.slug,
      },
    };
  });

  it('renders', function () {
    const wrapper = mountWithTheme(<OrganizationActivity {...params} />, routerContext);

    expect(wrapper.find('ActivityItem')).toHaveLength(2);
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/activity/',
      body: [],
    });
    const wrapper = mountWithTheme(<OrganizationActivity {...params} />, routerContext);

    expect(wrapper.find('ActivityItem')).toHaveLength(0);
    expect(wrapper.find('EmptyStateWarning')).toHaveLength(1);
  });

  it('renders not found', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/activity/',
      body: [],
      statusCode: 404,
    });
    const wrapper = mountWithTheme(<OrganizationActivity {...params} />, routerContext);

    expect(wrapper.find('ActivityItem')).toHaveLength(0);
    expect(wrapper.find('EmptyStateWarning')).toHaveLength(1);
  });
});
