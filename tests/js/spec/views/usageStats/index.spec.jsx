import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {DataCategory} from 'app/types';
import UsageStats from 'app/views/usageStats';
import {CHART_OPTIONS_DATA_TRANSFORM} from 'app/views/usageStats/usageChart';

describe('UsageStats', function () {
  const router = TestStubs.router();
  const {organization, routerContext} = initializeOrg({router});

  const statsUrl = `/organizations/${organization.slug}/stats_v2/`;
  const ninetyDays = Object.keys(DEFAULT_RELATIVE_PERIODS)[5];

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

    const minAsync = wrapper.find('UsageStatsLastMin');
    expect(minAsync.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(minAsync.text()).toContain('6'); // Display 2nd last value in series

    const orgAsync = wrapper.find('UsageStatsOrganization');
    expect(orgAsync.props().dataDatetime.period).toEqual(DEFAULT_STATS_PERIOD);
    expect(orgAsync.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(orgAsync.props().chartTransform).toEqual(undefined);
    expect(orgAsync.text()).toContain('Total Errors49');
    expect(orgAsync.text()).toContain('Accepted28');
    expect(orgAsync.text()).toContain('Filtered7');
    expect(orgAsync.text()).toContain('Dropped14');

    const orgChart = wrapper.find('UsageChart');
    expect(orgChart.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(orgChart.props().dataTransform).toEqual(CHART_OPTIONS_DATA_TRANSFORM[0].value);

    const projectAsync = wrapper.find('UsageStatsProjects');
    expect(projectAsync.props().dataDatetime.period).toEqual(DEFAULT_STATS_PERIOD);
    expect(projectAsync.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(projectAsync.props().tableSort).toEqual(undefined);

    const projectTable = wrapper.find('UsageTable');
    expect(projectTable.props().dataCategory).toEqual(DataCategory.ERRORS);

    // API calls with defaults
    expect(mock).toHaveBeenCalledTimes(3);

    // From UsageStatsLastMin
    expect(mock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: '5m',
          interval: '1m',
          groupBy: ['category', 'outcome'],
          field: ['sum(quantity)'],
        },
      })
    );

    // From UsageStatsOrg
    expect(mock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: DEFAULT_STATS_PERIOD,
          interval: '1h',
          groupBy: ['category', 'outcome'],
          field: ['sum(quantity)'],
        },
      })
    );

    // From UsageStatsProjects
    expect(mock).toHaveBeenNthCalledWith(
      3,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: DEFAULT_STATS_PERIOD,
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

    expect(wrapper.find('UsageChart')).toHaveLength(1);
    expect(wrapper.find('UsageTable')).toHaveLength(1);
    expect(wrapper.find('IconWarning')).toHaveLength(2);
  });

  it('passes state from router down to components', async function () {
    const wrapper = mountWithTheme(
      <UsageStats
        organization={organization}
        location={{
          query: {
            pagePeriod: ninetyDays,
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
    expect(orgAsync.props().dataDatetime.period).toEqual(ninetyDays);
    expect(orgAsync.props().dataCategory).toEqual(DataCategory.TRANSACTIONS);
    expect(orgAsync.props().chartTransform).toEqual(
      CHART_OPTIONS_DATA_TRANSFORM[1].value
    );

    const orgChart = wrapper.find('UsageChart');
    expect(orgChart.props().dataCategory).toEqual(DataCategory.TRANSACTIONS);
    expect(orgChart.props().dataTransform).toEqual(CHART_OPTIONS_DATA_TRANSFORM[1].value);

    const projectAsync = wrapper.find('UsageStatsProjects');
    expect(projectAsync.props().dataDatetime.period).toEqual(ninetyDays);
    expect(projectAsync.props().dataCategory).toEqual(DataCategory.TRANSACTIONS);
    expect(projectAsync.props().tableSort).toEqual('-project');

    const projectTable = wrapper.find('UsageTable');
    expect(projectTable.props().dataCategory).toEqual(DataCategory.TRANSACTIONS);

    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: '5m',
          interval: '1m',
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
          statsPeriod: ninetyDays,
          interval: '1d',
          groupBy: ['category', 'outcome'],
          field: ['sum(quantity)'],
        },
      })
    );
    expect(mock).toHaveBeenNthCalledWith(
      3,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: ninetyDays,
          interval: '1d',
          groupBy: ['category', 'outcome', 'project'],
          field: ['sum(quantity)'],
        },
      })
    );
  });

  it('pushes state to router', async function () {
    const wrapper = mountWithTheme(
      <UsageStats
        organization={organization}
        location={{
          query: {
            pagePeriod: ninetyDays,
            dataCategory: DataCategory.TRANSACTIONS,
            chartTransform: CHART_OPTIONS_DATA_TRANSFORM[1].value,
            sort: '-project',
          },
        }}
        router={router}
      />,
      router
    );

    await tick();
    wrapper.update();

    const optionPagePeriod = wrapper.find('OptionSelector[title="Display"]');
    const oneDay = Object.keys(DEFAULT_RELATIVE_PERIODS)[0];
    optionPagePeriod.props().onChange(oneDay);
    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        pagePeriod: oneDay,
      }),
    });

    const optionDataCategory = wrapper.find('OptionSelector[title="of"]');
    optionDataCategory.props().onChange(DataCategory.ATTACHMENTS);
    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({dataCategory: DataCategory.ATTACHMENTS}),
    });

    const optionChartTransform = wrapper.find('OptionSelector[title="Type"]');
    optionChartTransform.props().onChange(CHART_OPTIONS_DATA_TRANSFORM[1].value);
    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        chartTransform: CHART_OPTIONS_DATA_TRANSFORM[1].value,
      }),
    });
  });

  it('removes page query parameters during outbound navigation', async () => {
    const wrapper = mountWithTheme(
      <UsageStats
        organization={organization}
        location={{
          query: {
            pageStart: '2021-01-01T00:00:00Z',
            pageEnd: '2021-01-07T00:00:00Z',
            pagePeriod: ninetyDays,
            pageUtc: true,
            dataCategory: DataCategory.TRANSACTIONS,
            chartTransform: CHART_OPTIONS_DATA_TRANSFORM[1].value,
            sort: '-project',
            notAPageKey: 'hello', // Should not be removed
          },
        }}
        router={router}
      />,
      router
    );

    await tick();
    wrapper.update();

    const outboundLinks = wrapper.instance().getNextLocations({id: 1, slug: 'project'});
    expect(outboundLinks).toEqual({
      performance: {
        query: {project: 1, notAPageKey: 'hello'},
        pathname: '/organizations/org-slug/performance/',
      },
      projectDetail: {
        query: {project: 1, notAPageKey: 'hello'},
        pathname: '/organizations/org-slug/projects/project',
      },
      issueList: {
        query: {project: 1, notAPageKey: 'hello'},
        pathname: '/organizations/org-slug/issues/',
      },
    });
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
        {
          by: {
            category: 'error',
            outcome: 'filtered',
          },
          totals: {
            'sum(quantity)': 7,
          },
          series: {
            'sum(quantity)': [1, 1, 1, 1, 1, 1, 1],
          },
        },
        {
          by: {
            category: 'error',
            outcome: 'dropped',
          },
          totals: {
            'sum(quantity)': 14,
          },
          series: {
            'sum(quantity)': [2, 2, 2, 2, 2, 2, 2],
          },
        },
      ],
    },
  };
}
