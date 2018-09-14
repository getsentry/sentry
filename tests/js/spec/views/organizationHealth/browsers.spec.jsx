import React from 'react';
import {mount} from 'enzyme';

import OrganizationHealthBrowsers from 'app/views/organizationHealth/browsers';

jest.mock('app/views/organizationHealth/util/withHealth');
jest.mock('app/utils/withLatestContext');

describe('OrganizationHealthBrowsers', function() {
  const org = TestStubs.Organization();
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/health/top/',
    body: (url, opts) => {
      return TestStubs.HealthTop(opts.query);
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/health/graph/',
    body: (url, opts) => {
      return TestStubs.HealthGraph(opts.query);
    },
  });

  it('renders with PieChart, and EventTableChart', async function() {
    let wrapper = mount(
      <OrganizationHealthBrowsers organization={org} />,
      TestStubs.routerContext()
    );
    await tick();
    wrapper.update();
    expect(wrapper.find('PieChart')).toHaveLength(2);
    expect(wrapper.find('EventsTableChart')).toHaveLength(1);
  });
});
