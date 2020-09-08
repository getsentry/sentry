import React from 'react';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import PerformanceLanding from 'app/views/performance/landing';
import ProjectsStore from 'app/stores/projectsStore';
import {
  TRENDS_FUNCTIONS,
  getTrendAliasedFieldPercentage,
  getTrendAliasedQueryPercentage,
  getTrendAliasedMinus,
} from 'app/views/performance/trends/utils';
import {TrendFunctionField} from 'app/views/performance/trends/types';

const trendsViewQuery = {
  view: 'TRENDS',
};

function selectTrendFunction(wrapper, field) {
  const menu = wrapper.find('TrendsDropdown DropdownMenu');
  expect(menu).toHaveLength(1);
  menu.find('DropdownButton').simulate('click');

  const option = menu.find(`DropdownItem[data-test-id="${field}"] span`);
  expect(option).toHaveLength(1);
  option.simulate('click');

  wrapper.update();
}

function initializeData(projects, query) {
  const features = ['transaction-event', 'performance-view', 'internal-catchall'];
  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {...trendsViewQuery, ...query},
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

describe('Performance > Trends', function() {
  let trendsMock;
  let baselineMock;
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    trendsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-trends/',
      body: {
        stats: {
          'internal,/organizations/:orgId/performance/': {
            data: [[123, []]],
          },
          order: 0,
        },
        events: {
          meta: {
            count_range_1: 'integer',
            count_range_2: 'integer',
            percentage_count_range_2_count_range_1: 'percentage',
            percentage_percentile_range_2_percentile_range_1: 'percentage',
            minus_percentile_range_2_percentile_range_1: 'number',
            percentile_range_1: 'duration',
            percentile_range_2: 'duration',
            transaction: 'string',
          },
          data: [
            {
              count: 8,
              project: 'internal',
              count_range_1: 2,
              count_range_2: 6,
              percentage_count_range_2_count_range_1: 3,
              percentage_percentile_range_2_percentile_range_1: 1.9235225955967554,
              minus_percentile_range_2_percentile_range_1: 797,
              percentile_range_1: 863,
              percentile_range_2: 1660,
              transaction: '/organizations/:orgId/performance/',
            },
            {
              count: 60,
              project: 'internal',
              count_range_1: 20,
              count_range_2: 40,
              percentage_count_range_2_count_range_1: 2,
              percentage_percentile_range_2_percentile_range_1: 1.204968944099379,
              minus_percentile_range_2_percentile_range_1: 66,
              percentile_range_1: 322,
              percentile_range_2: 388,
              transaction: '/api/0/internal/health/',
            },
          ],
        },
      },
    });
    baselineMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/event-baseline/',
      body: {
        project: 'sentry',
        id: '66877921c6ff440b8b891d3734f074e7',
      },
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function() {
    const projects = [TestStubs.Project()];
    const data = initializeData(projects, {});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    // Trends dropdown and transaction widgets should render.
    expect(wrapper.find('TrendsDropdown')).toHaveLength(1);
    expect(wrapper.find('ChangedTransactions')).toHaveLength(2);
  });

  it('transaction list items are rendered', async function() {
    const projects = [TestStubs.Project()];
    const data = initializeData(projects, {project: ['-1']});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('TrendsListItem')).toHaveLength(4);
  });

  it('view summary menu action links to the correct view', async function() {
    const projects = [TestStubs.Project({id: 1, slug: 'internal'}), TestStubs.Project()];
    const data = initializeData(projects, {project: ['1']});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    wrapper
      .find('TransactionMenuButton')
      .first()
      .simulate('click');

    const firstTransaction = wrapper.find('TrendsListItem').first();
    const summaryLink = firstTransaction.find('StyledSummaryLink');
    expect(summaryLink).toHaveLength(1);

    expect(summaryLink.text()).toEqual('View Summary');
    expect(summaryLink.props().to.pathname).toEqual(
      '/organizations/org-slug/performance/summary/'
    );
    expect(summaryLink.props().to.query.project).toEqual(1);
  });

  it('transaction link calls comparison view', async function() {
    const projects = [TestStubs.Project({id: 1, slug: 'internal'}), TestStubs.Project()];
    const data = initializeData(projects, {project: ['1']});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    const firstTransaction = wrapper.find('TrendsListItem').first();
    const transactionLink = firstTransaction.find('StyledLink').first();
    transactionLink.simulate('click');

    await tick();
    wrapper.update();

    expect(baselineMock).toHaveBeenCalledTimes(2);
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname:
        '/organizations/org-slug/performance/compare/sentry:66877921c6ff440b8b891d3734f074e7/sentry:66877921c6ff440b8b891d3734f074e7/',
      query: expect.anything(),
    });
  });

  it('choosing a trend function changes location', async function() {
    const projects = [TestStubs.Project()];
    const data = initializeData(projects, {project: ['-1']});
    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    for (const trendFunction of TRENDS_FUNCTIONS) {
      selectTrendFunction(wrapper, trendFunction.field);
      await tick();

      expect(browserHistory.push).toHaveBeenCalledWith({
        query: expect.objectContaining({
          trendFunction: trendFunction.field,
        }),
      });
    }
  });

  it('trend functions in location make api calls', async function() {
    const projects = [TestStubs.Project(), TestStubs.Project()];
    const data = initializeData(projects, {project: ['-1']});

    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    for (const trendFunction of TRENDS_FUNCTIONS) {
      trendsMock.mockReset();
      wrapper.setProps({
        location: {query: {...trendsViewQuery, trendFunction: trendFunction.field}},
      });
      wrapper.update();
      await tick();

      expect(trendsMock).toHaveBeenCalledTimes(2);

      const aliasedFieldDivide = getTrendAliasedFieldPercentage(trendFunction.alias);
      const aliasedQueryDivide = getTrendAliasedQueryPercentage(trendFunction.alias);

      const sort =
        trendFunction.field === TrendFunctionField.USER_MISERY
          ? getTrendAliasedMinus(trendFunction.alias)
          : aliasedFieldDivide;

      const defaultFields = ['transaction', 'project', 'count()'];
      const trendFunctionFields = TRENDS_FUNCTIONS.map(({field}) => field);

      const field = [...trendFunctionFields, ...defaultFields];

      expect(field).toHaveLength(5);

      // Improved trends call
      expect(trendsMock).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            trendFunction: trendFunction.field,
            sort,
            query: expect.stringContaining(aliasedQueryDivide + ':<1'),
            interval: '12h',
            field,
            statsPeriod: '14d',
          }),
        })
      );

      // Regression trends call
      expect(trendsMock).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            trendFunction: trendFunction.field,
            sort: '-' + sort,
            query: expect.stringContaining(aliasedQueryDivide + ':>1'),
            interval: '12h',
            field,
            statsPeriod: '14d',
          }),
        })
      );
    }
  });
});
