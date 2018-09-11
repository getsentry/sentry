import React from 'react';
import {mount} from 'enzyme';

import OrganizationHealthErrors from 'app/views/organizationHealth/errors';

jest.mock('app/utils/withLatestContext');

describe('OrganizationHealthErrors', function() {
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
      <OrganizationHealthErrors organization={org} />,
      TestStubs.routerContext()
    );
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
  });
});
