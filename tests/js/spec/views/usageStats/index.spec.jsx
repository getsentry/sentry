import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {DataCategory} from 'app/types';
import UsageStats from 'app/views/usageStats';
import {CHART_OPTIONS_DATA_TRANSFORM} from 'app/views/usageStats/usageChart';

describe('UsageStats', function () {
  const router = TestStubs.router();
  const {organization, routerContext} = initializeOrg({router});

  const statsUrl = `/organizations/${organization.slug}/stats_v2/`;

  const {mockOrgStats} = getMockResponse();
  let mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mock = MockApiClient.addMockResponse({
      url: statsUrl,
      body: mockOrgStats,
    });
  });

  it('renders with default state', async function () {
    const wrapper = mountWithTheme(
      <UsageStats organization={organization} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.text()).toContain('Organization Usage Stats for Errors');

    expect(wrapper.find('UsageChart')).toHaveLength(1);
    expect(wrapper.find('UsageTable')).toHaveLength(1);
    expect(wrapper.find('IconWarning')).toHaveLength(0);

    const orgAsync = wrapper.find('UsageStatsOrganization');
    expect(orgAsync.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(orgAsync.props().chartTransform).toEqual(undefined);

    const orgChart = wrapper.find('UsageChart');
    expect(orgChart.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(orgChart.props().dataTransform).toEqual(CHART_OPTIONS_DATA_TRANSFORM[0].value);

    const projectAsync = wrapper.find('UsageStatsProjects');
    expect(projectAsync.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(projectAsync.props().tableSort).toEqual(undefined);

    const projectTable = wrapper.find('UsageTable');
    expect(projectTable.props().dataCategory).toEqual(DataCategory.ERRORS);

    // API calls with defaults
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: '14d',
          interval: '1h',
          groupBy: ['category', 'outcome'],
          field: ['sum(quantity)'],
        },
      })
    );
    expect(mock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: '14d',
          interval: '1d',
          groupBy: ['category', 'outcome', 'project'],
          field: ['sum(quantity)'],
        },
      })
    );
  });

  it('renders with error on organization stats endpoint', async function () {
    MockApiClient.addMockResponse({
      url: statsUrl,
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
    expect(wrapper.find('UsageTable')).toHaveLength(0);
    expect(wrapper.find('IconWarning')).toHaveLength(2);
  });

  it('passes state from router', async function () {
    const wrapper = mountWithTheme(
      <UsageStats
        organization={organization}
        location={{
          query: {
            statsPeriod: '30d',
            dataCategory: DataCategory.TRANSACTIONS,
            chartTransform: CHART_OPTIONS_DATA_TRANSFORM[1].value,
            sort: '-project',
          },
        }}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    const orgAsync = wrapper.find('UsageStatsOrganization');
    expect(orgAsync.props().dataCategory).toEqual(DataCategory.TRANSACTIONS);
    expect(orgAsync.props().chartTransform).toEqual(
      CHART_OPTIONS_DATA_TRANSFORM[1].value
    );

    const orgChart = wrapper.find('UsageChart');
    expect(orgChart.props().dataCategory).toEqual(DataCategory.TRANSACTIONS);
    expect(orgChart.props().dataTransform).toEqual(CHART_OPTIONS_DATA_TRANSFORM[1].value);

    const projectAsync = wrapper.find('UsageStatsProjects');
    expect(projectAsync.props().dataCategory).toEqual(DataCategory.TRANSACTIONS);
    expect(projectAsync.props().tableSort).toEqual('-project');

    const projectTable = wrapper.find('UsageTable');
    expect(projectTable.props().dataCategory).toEqual(DataCategory.TRANSACTIONS);

    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: '14d',
          interval: '1h',
          groupBy: ['category', 'outcome'],
          field: ['sum(quantity)'],
        },
      })
    );
    expect(mock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: '30d',
          interval: '1d',
          groupBy: ['category', 'outcome', 'project'],
          field: ['sum(quantity)'],
        },
      })
    );
  });
});

function getMockResponse() {
  return {
    mockOrgStats: {
      start: '2021-01-01T00:00:00Z',
      end: '2021-01-07T00:00:00Z',
      intervals: [
        '2021-01-01T00:00:00Z',
        '2021-01-02T00:00:00Z',
        '2021-01-03T00:00:00Z',
        '2021-01-04T00:00:00Z',
        '2021-01-05T00:00:00Z',
        '2021-01-06T00:00:00Z',
        '2021-01-07T00:00:00Z',
      ],
      groups: [
        {
          by: {
            category: 'attachment',
            outcome: 'accepted',
          },
          totals: {
            'sum(quantity)': 28000,
          },
          series: {
            'sum(quantity)': [1000, 2000, 3000, 4000, 5000, 6000, 7000],
          },
        },
        {
          by: {
            outcome: 'accepted',
            category: 'transaction',
          },
          totals: {
            'sum(quantity)': 28,
          },
          series: {
            'sum(quantity)': [1, 2, 3, 4, 5, 6, 7],
          },
        },
        {
          by: {
            category: 'error',
            outcome: 'accepted',
          },
          totals: {
            'sum(quantity)': 28,
          },
          series: {
            'sum(quantity)': [1, 2, 3, 4, 5, 6, 7],
          },
        },
      ],
    },
  };
}
