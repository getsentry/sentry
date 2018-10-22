import React from 'react';
import {mount} from 'enzyme';

import {OrganizationEvents} from 'app/views/organizationEvents/events';

jest.mock('app/utils/withLatestContext');

describe('OrganizationEventsErrors', function() {
  const project = TestStubs.Project({isMember: true});
  const org = TestStubs.Organization({projects: [project]});
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: (url, opts) => [TestStubs.OrganizationEvent(opts.query)],
  });
  const healthGraphMock = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/health/graph/',
    body: (url, opts) => {
      return TestStubs.HealthGraph(opts.query);
    },
  });

  it('renders events table', async function() {
    let wrapper = mount(
      <OrganizationEvents organization={org} location={{query: {}}} />,
      TestStubs.routerContext()
    );
    await tick();
    wrapper.update();
    expect(healthGraphMock).toHaveBeenCalled();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
    expect(wrapper.find('IdBadge')).toHaveLength(2);
  });
});
