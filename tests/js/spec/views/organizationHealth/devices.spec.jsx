import React from 'react';
import {mount} from 'enzyme';

import OrganizationHealthDevices from 'app/views/organizationHealth/devices';

jest.mock('app/utils/withLatestContext');

describe('OrganizationHealthDevices', function() {
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
      <OrganizationHealthDevices
        actions={{updateParams: jest.fn(), setSpecifier: jest.fn()}}
        router={TestStubs.router()}
        organization={org}
      />,
      TestStubs.routerContext()
    );
    await tick();
    wrapper.update();
    expect(wrapper.find('PieChart')).toHaveLength(1);
    expect(wrapper.find('EventsTableChart')).toHaveLength(1);
  });
});
