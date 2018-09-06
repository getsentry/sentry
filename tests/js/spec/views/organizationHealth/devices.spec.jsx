import React from 'react';
import {mount} from 'enzyme';

import OrganizationHealthDevices from 'app/views/organizationHealth/devices';

jest.mock('app/utils/withLatestContext');

describe('OrganizationHealthDevices', function() {
  const org = TestStubs.Organization();
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/health/top/',
    body: (url, opts) => {
      return TestStubs.HealthTop(opts.query.tag);
    },
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/health/graph/',
    body: (url, opts) => {
      return TestStubs.HealthGraph(opts.query.tag);
    },
  });

  it('renders with PieChart, and EventTableChart', async function() {
    let wrapper = mount(<OrganizationHealthDevices organization={org} />);
    await tick();
    wrapper.update();
    expect(wrapper.find('PieChart')).toHaveLength(1);
    expect(wrapper.find('EventsTableChart')).toHaveLength(1);
  });
});
