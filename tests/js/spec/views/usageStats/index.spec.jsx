import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import UsageStats from 'app/views/usageStats';

import {mockData} from './usageStatsOrg.spec';

describe('UsageStats', function () {
  const {organization, routerContext} = initializeOrg();
  const orgSlug = organization.slug;

  const orgUrl = `/organizations/${orgSlug}/stats_v2/`;
  const projectUrl = `/organizations/${orgSlug}/stats_v2/projects/`;

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

  it('renders', async function () {
    const wrapper = mountWithTheme(
      <UsageStats organization={organization} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.text()).toContain('Organization Usage Stats for Errors');

    expect(wrapper.find('UsageChart')).toHaveLength(1);
    expect(wrapper.find('IconWarning')).toHaveLength(0);

    expect(wrapper.text()).toContain('UsageStatsProjects is okay');
    expect(wrapper.text()).not.toContain('UsageStatsProjects has an error');
  });

  it('renders with error on organization stats endpoint', async function () {
    MockApiClient.addMockResponse({
      url: orgUrl,
      statusCode: 500,
    });

    const wrapper = mountWithTheme(
      <UsageStats organization={organization} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.text()).toContain('Organization Usage Stats for Errors');

    expect(wrapper.find('UsageChart')).toHaveLength(0);
    expect(wrapper.find('IconWarning')).toHaveLength(1);

    expect(wrapper.text()).toContain('UsageStatsProjects is okay');
    expect(wrapper.text()).not.toContain('UsageStatsProjects has an error');
  });

  it('renders with error on project stats endpoint', async function () {
    MockApiClient.addMockResponse({
      url: projectUrl,
      statusCode: 500,
    });

    const wrapper = mountWithTheme(
      <UsageStats organization={organization} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.text()).toContain('Organization Usage Stats for Errors');

    expect(wrapper.find('UsageChart')).toHaveLength(1);
    expect(wrapper.find('IconWarning')).toHaveLength(0);

    expect(wrapper.text()).not.toContain('UsageStatsProjects is okay');
    expect(wrapper.text()).toContain('UsageStatsProjects has an error');
  });
});
