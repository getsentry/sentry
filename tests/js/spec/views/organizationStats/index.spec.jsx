import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import ProjectsStore from 'app/stores/projectsStore';
import {DataCategory} from 'app/types';
import {OrganizationStats} from 'app/views/organizationStats';
import {CHART_OPTIONS_DATA_TRANSFORM} from 'app/views/organizationStats/usageChart';

describe('OrganizationStats', function () {
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
      <OrganizationStats organization={organization} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.text()).toContain('Organization Usage Stats');

    expect(wrapper.find('UsageChart')).toHaveLength(1);
    expect(wrapper.find('UsageTable')).toHaveLength(1);
    expect(wrapper.find('IconWarning')).toHaveLength(0);

    const orgAsync = wrapper.find('UsageStatsOrganization');
    expect(orgAsync.props().dataDatetime.period).toEqual(DEFAULT_STATS_PERIOD);
    expect(orgAsync.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(orgAsync.props().chartTransform).toEqual(undefined);
    expect(orgAsync.text()).toContain('Total Errors64');
    expect(orgAsync.text()).toContain('Accepted28');
    expect(orgAsync.text()).toContain('Filtered7');
    expect(orgAsync.text()).toContain('Dropped29');

    const orgChart = wrapper.find('UsageChart');
    expect(orgChart.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(orgChart.props().dataTransform).toEqual(CHART_OPTIONS_DATA_TRANSFORM[1].value);

    const minAsync = wrapper.find('UsageStatsPerMin');
    expect(minAsync.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(minAsync.text()).toContain('6'); // Display 2nd last value in series

    const projectAsync = wrapper.find('UsageStatsProjects');
    expect(projectAsync.props().dataDatetime.period).toEqual(DEFAULT_STATS_PERIOD);
    expect(projectAsync.props().dataCategory).toEqual(DataCategory.ERRORS);
    expect(projectAsync.props().tableSort).toEqual(undefined);

    const projectTable = wrapper.find('UsageTable');
    expect(projectTable.props().dataCategory).toEqual(DataCategory.ERRORS);

    // API calls with defaults
    expect(mock).toHaveBeenCalledTimes(3);

    // From UsageStatsOrg
    expect(mock).toHaveBeenNthCalledWith(
      1,
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

    // From UsageStatsPerMin
    expect(mock).toHaveBeenNthCalledWith(
      2,
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

    // From UsageStatsProjects
    expect(mock).toHaveBeenNthCalledWith(
      3,
      '/organizations/org-slug/stats_v2/',
      expect.objectContaining({
        query: {
          statsPeriod: DEFAULT_STATS_PERIOD,
          interval: '1h',
          groupBy: ['outcome', 'project'],
          project: '-1',
          field: ['sum(quantity)'],
          category: 'error',
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
      <OrganizationStats organization={organization} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.text()).toContain('Organization Usage Stats');

    expect(wrapper.find('UsageChart')).toHaveLength(1);
    expect(wrapper.find('UsageTable')).toHaveLength(1);
    expect(wrapper.find('IconWarning')).toHaveLength(2);
  });

  it('renders with error when user has no access to projects', async function () {
    MockApiClient.addMockResponse({
      url: statsUrl,
      statusCode: 400,
      body: {
        detail: 'No projects available',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationStats organization={organization} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.text()).toContain('Organization Usage Stats');

    expect(wrapper.find('UsageTable')).toHaveLength(1);
    expect(wrapper.find('IconWarning')).toHaveLength(2);
    expect(wrapper.find('UsageTable').text()).toContain('no projects');
  });

  it('passes state from router down to components', async function () {
    const wrapper = mountWithTheme(
      <OrganizationStats
        organization={organization}
        location={{
          query: {
            pageStatsPeriod: ninetyDays,
            dataCategory: DataCategory.TRANSACTIONS,
            transform: CHART_OPTIONS_DATA_TRANSFORM[1].value,
            sort: '-project',
            query: 'myProjectSlug',
            cursor: '0:1:0',
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
          statsPeriod: ninetyDays,
          interval: '1d',
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
          statsPeriod: '5m',
          interval: '1m',
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
          groupBy: ['outcome', 'project'],
          project: '-1',
          category: 'transaction',
          field: ['sum(quantity)'],
        },
      })
    );
  });

  it('pushes state to router', async function () {
    // Add another 30 projects to allow us to test pagination
    const moreProjects = Array.from(Array(30).keys()).map(id =>
      TestStubs.Project({id, slug: `myProjectSlug-${id}`})
    );
    ProjectsStore.loadInitialData(moreProjects);

    const wrapper = mountWithTheme(
      <OrganizationStats
        organization={organization}
        location={{
          query: {
            pageStatsPeriod: ninetyDays,
            dataCategory: DataCategory.ERRORS,
            transform: CHART_OPTIONS_DATA_TRANSFORM[0].value,
            sort: '-project',
            query: 'myProjectSlug',
            cursor: '0:0:0',
          },
        }}
        router={router}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    const optionpagePeriod = wrapper.find(`TimeRangeSelector`);
    optionpagePeriod.props().onUpdate({relative: '30d'});
    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        pageStatsPeriod: '30d',
      }),
    });

    optionpagePeriod
      .props()
      .onUpdate({start: '2021-01-01', end: '2021-01-31', utc: true});
    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        pageStart: '2021-01-01T00:00:00Z',
        pageEnd: '2021-01-31T00:00:00Z',
        pageUtc: true,
      }),
    });

    const optionDataCategory = wrapper.find('DropdownItem[eventKey="attachments"]');
    optionDataCategory.props().onSelect(DataCategory.ATTACHMENTS);
    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({dataCategory: DataCategory.ATTACHMENTS}),
    });

    const optionChartTransform = wrapper.find('OptionSelector[title="Type"]');
    optionChartTransform.props().onChange(CHART_OPTIONS_DATA_TRANSFORM[1].value);
    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        transform: CHART_OPTIONS_DATA_TRANSFORM[1].value,
      }),
    });

    const inputQuery = wrapper.find('SearchBar');
    inputQuery.props().onSearch('someSearchQuery');
    expect(router.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        query: 'someSearchQuery',
      }),
    });

    wrapper.find('Pagination Button').last().simulate('click');
    expect(browserHistory.push).toHaveBeenCalledWith({
      query: expect.objectContaining({cursor: '0:25:0'}),
    });
  });

  it('removes page query parameters during outbound navigation', async () => {
    const wrapper = mountWithTheme(
      <OrganizationStats
        organization={organization}
        location={{
          query: {
            pageStart: '2021-01-01T00:00:00Z',
            pageEnd: '2021-01-07T00:00:00Z',
            pageStatsPeriod: ninetyDays,
            pageUtc: true,
            dataCategory: DataCategory.TRANSACTIONS,
            transform: CHART_OPTIONS_DATA_TRANSFORM[1].value,
            sort: '-project',
            query: 'myProjectSlug',
            cursor: '0:1:0',
            notAPageKey: 'hello', // Should not be removed
          },
        }}
        router={router}
      />,
      routerContext
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
        pathname: '/organizations/org-slug/projects/project/',
      },
      issueList: {
        query: {project: 1, notAPageKey: 'hello'},
        pathname: '/organizations/org-slug/issues/',
      },
      settings: {
        pathname: '/settings/org-slug/projects/project/',
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
            outcome: 'rate_limited',
          },
          totals: {
            'sum(quantity)': 14,
          },
          series: {
            'sum(quantity)': [2, 2, 2, 2, 2, 2, 2],
          },
        },
        {
          by: {
            category: 'error',
            outcome: 'invalid',
          },
          totals: {
            'sum(quantity)': 15,
          },
          series: {
            'sum(quantity)': [2, 2, 2, 2, 2, 2, 3],
          },
        },
      ],
    },
  };
}
