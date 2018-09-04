import React from 'react';
import {mount} from 'enzyme';

import OrganizationHealthTransactions from 'app/views/organizationHealth/transactions';

jest.mock('app/utils/withLatestContext');
jest.mock('echarts-for-react/lib/core', () => jest.fn(() => null));

describe('OrganizationHealthTransactions', function() {
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

  it('renders with LineChart, AreaChart, and TableChart', async function() {
    let wrapper = mount(<OrganizationHealthTransactions organization={org} />);
    await tick();
    wrapper.update();
    expect(wrapper.find('TableChart')).toHaveLength(1);
    expect(wrapper.find('AreaChart')).toHaveLength(1);
    expect(wrapper.find('LineChart')).toHaveLength(1);
  });
});
