import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import withUsageStats from 'app/views/usageStats/withUsageStats';

describe('withUsageStats HoC', () => {
  const api = new MockApiClient();

  const organization = TestStubs.Organization();
  const orgSlug = organization.slug;

  const orgUrl = `/organizations/${orgSlug}/stats_v2/`;
  const projectUrl = `/organizations/${orgSlug}/stats_v2/projects/`;

  // TODO(org-stats): Update with finalized response
  const mockData = {ts: '1'};

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: orgUrl,
      body: mockData,
    });
    MockApiClient.addMockResponse({
      url: projectUrl,
      body: mockData,
    });
  });

  it('adds organization/project stats props', async () => {
    const Component = () => null;
    const Container = withUsageStats(Component);
    const wrapper = mountWithTheme(<Container api={api} organization={organization} />);

    await tick();
    wrapper.update();

    const mountedComponent = wrapper.find(Component);
    expect(mountedComponent.prop('orgStats')).toEqual(mockData);
    expect(mountedComponent.prop('orgStatsLoading')).toEqual(false);
    expect(mountedComponent.prop('orgStatsError')).toEqual(undefined);
    expect(mountedComponent.prop('projectStats')).toEqual(mockData);
    expect(mountedComponent.prop('projectStatsLoading')).toEqual(false);
    expect(mountedComponent.prop('projectStatsError')).toEqual(undefined);
  });
});
