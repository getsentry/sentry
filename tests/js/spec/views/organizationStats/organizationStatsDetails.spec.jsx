import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import OrganizationStats from 'app/views/organizationStats/organizationStatsDetails';

describe('OrganizationStats', function() {
  it('renders', function() {
    const organization = TestStubs.Organization();
    const props = {
      statsLoading: false,
      projectsLoading: false,
      orgTotal: {},
      orgStats: [],
      projectTotals: [],
      projectMap: {},
      organization,
    };

    const wrapper = mountWithTheme(
      <OrganizationStats {...props} />,
      TestStubs.routerContext([{organization}])
    );

    expect(wrapper.find('PageHeading').text()).toBe('Organization Stats');
    expect(wrapper.find('Panel[className="bar-chart"]').exists()).toBe(true);
    expect(wrapper.find('ProjectTable').exists()).toBe(true);
    expect(wrapper.find('Alert[data-test-id="performance-usage"]').exists()).toBe(false);
  });

  it('renders alert for performance feature', function() {
    const organization = TestStubs.Organization({features: ['performance-view']});
    const props = {
      statsLoading: false,
      projectsLoading: false,
      orgTotal: {},
      orgStats: [],
      projectTotals: [],
      projectMap: {},
      organization,
    };

    const wrapper = mountWithTheme(
      <OrganizationStats {...props} />,
      TestStubs.routerContext([{organization}])
    );

    expect(wrapper.find('PageHeading').text()).toBe('Organization Stats');
    expect(wrapper.find('Panel[className="bar-chart"]').exists()).toBe(true);
    expect(wrapper.find('ProjectTable').exists()).toBe(true);
    expect(wrapper.find('Alert[data-test-id="performance-usage"]').exists()).toBe(true);
  });
});
