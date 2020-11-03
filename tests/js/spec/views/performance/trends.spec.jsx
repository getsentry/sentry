import React from 'react';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import PerformanceLanding from 'app/views/performance/landing';
import ProjectsStore from 'app/stores/projectsStore';
import {
  DEFAULT_MAX_DURATION,
  TRENDS_FUNCTIONS,
  CONFIDENCE_LEVELS,
  getTrendAliasedFieldPercentage,
  getTrendAliasedMinus,
} from 'app/views/performance/trends/utils';
import {TrendFunctionField} from 'app/views/performance/trends/types';

const trendsViewQuery = {
  view: 'TRENDS',
  query: `epm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
};

jest.mock('moment', () => {
  const moment = jest.requireActual('moment');
  moment.now = jest.fn().mockReturnValue(1601251200000);
  return moment;
});

function selectTrendFunction(wrapper, field) {
  const menu = wrapper.find('TrendsDropdown DropdownMenu');
  expect(menu).toHaveLength(2);
  menu.find('DropdownButton').at(1).simulate('click');

  const option = menu.find(`DropdownItem[data-test-id="${field}"] span`);
  expect(option).toHaveLength(1);
  option.simulate('click');

  wrapper.update();
}

function selectConfidenceLevel(wrapper, label) {
  const menu = wrapper.find('TrendsDropdown DropdownMenu');
  expect(menu).toHaveLength(2);
  menu.find('DropdownButton').first().simulate('click');

  const option = menu.find(`DropdownItem[data-test-id="${label}"] span`);
  expect(option).toHaveLength(1);
  option.simulate('click');

  wrapper.update();
}

function initializeData(projects, query) {
  const features = ['transaction-event', 'performance-view', 'trends'];
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

describe('Performance > Trends', function () {
  let trendsStatsMock;
  beforeEach(function () {
    browserHistory.push = jest.fn();
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
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/transaction.duration/values/',
      body: [],
    });
    trendsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-trends-stats/',
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
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function () {
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
    expect(wrapper.find('TrendsDropdown')).toHaveLength(2);
    expect(wrapper.find('ChangedTransactions')).toHaveLength(2);
  });

  it('transaction list items are rendered', async function () {
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

  it('view summary menu action links to the correct view', async function () {
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

    wrapper.find('DropdownLink').first().simulate('click');

    const firstTransaction = wrapper.find('TrendsListItem').first();
    const summaryLink = firstTransaction.find('ItemTransactionName');

    expect(summaryLink.props().to.pathname).toEqual(
      '/organizations/org-slug/performance/summary/'
    );
    expect(summaryLink.props().to.query.project).toEqual(1);
  });

  it('hide from list menu action modifies query', async function () {
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

    wrapper.find('DropdownLink').first().simulate('click');

    const firstTransaction = wrapper.find('TrendsListItem').first();
    const menuActions = firstTransaction.find('StyledMenuAction');
    expect(menuActions).toHaveLength(3);

    const menuAction = menuActions.at(2);
    menuAction.simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        project: expect.anything(),
        query: `epm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION} !transaction:/organizations/:orgId/performance/`,
        view: 'TRENDS',
      }),
    });
  });

  it('Changing search causes cursors to be reset', async function () {
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
    const search = wrapper.find('#smart-search-input').first();

    search
      .simulate('change', {target: {value: 'transaction.duration:>9000'}})
      .simulate('submit', {
        preventDefault() {},
      });

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: expect.objectContaining({
        project: ['1'],
        query: 'transaction.duration:>9000',
        improvedCursor: undefined,
        regressionCursor: undefined,
        view: 'TRENDS',
      }),
    });
  });

  it('exclude greater than list menu action modifies query', async function () {
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

    wrapper.find('DropdownLink').first().simulate('click');

    const firstTransaction = wrapper.find('TrendsListItem').first();
    const menuActions = firstTransaction.find('StyledMenuAction');
    expect(menuActions).toHaveLength(3);

    const menuAction = menuActions.at(0);
    expect(menuAction.text()).toEqual('Show \u2264 863ms');
    menuAction.simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        project: expect.anything(),
        query: 'epm():>0.01 transaction.duration:>0 transaction.duration:<=863',
        view: 'TRENDS',
      }),
    });
  });

  it('exclude less than list menu action modifies query', async function () {
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

    wrapper.find('DropdownLink').first().simulate('click');

    const firstTransaction = wrapper.find('TrendsListItem').first();
    const menuActions = firstTransaction.find('StyledMenuAction');
    expect(menuActions).toHaveLength(3);

    const menuAction = menuActions.at(1);
    expect(menuAction.text()).toEqual('Show \u2265 863ms');
    menuAction.simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        project: expect.anything(),
        query: `epm():>0.01 transaction.duration:<${DEFAULT_MAX_DURATION} transaction.duration:>=863`,
        view: 'TRENDS',
      }),
    });
  });

  it('choosing a trend function changes location', async function () {
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
          regressionCursor: undefined,
          improvedCursor: undefined,
          trendFunction: trendFunction.field,
        }),
      });
    }
  });

  it('choosing a confidence level changes location', async function () {
    const projects = [TestStubs.Project()];
    const data = initializeData(projects, {project: ['-1']});
    const wrapper = mountWithTheme(
      <PerformanceLanding
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    for (const confidenceLevel of CONFIDENCE_LEVELS) {
      selectConfidenceLevel(wrapper, confidenceLevel.label);
      await tick();

      expect(browserHistory.push).toHaveBeenCalledWith({
        query: expect.objectContaining({
          confidenceLevel: confidenceLevel.label,
        }),
      });
    }
  });

  it('trend functions in location make api calls', async function () {
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
      trendsStatsMock.mockReset();
      wrapper.setProps({
        location: {query: {...trendsViewQuery, trendFunction: trendFunction.field}},
      });
      wrapper.update();
      await tick();

      expect(trendsStatsMock).toHaveBeenCalledTimes(2);

      const aliasedFieldDivide = getTrendAliasedFieldPercentage(trendFunction.alias);

      const sort =
        trendFunction.field === TrendFunctionField.USER_MISERY
          ? getTrendAliasedMinus(trendFunction.alias)
          : aliasedFieldDivide;

      const defaultTrendsFields = ['project'];

      const transactionFields = ['transaction', ...defaultTrendsFields];
      const projectFields = [...defaultTrendsFields];

      expect(transactionFields).toHaveLength(2);
      expect(projectFields).toHaveLength(transactionFields.length - 1);

      // Improved transactions call
      expect(trendsStatsMock).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            trendFunction: trendFunction.field,
            sort,
            query: expect.stringContaining('trend_percentage():<1'),
            interval: '30m',
            field: transactionFields,
            statsPeriod: '14d',
          }),
        })
      );

      // Regression transactions call
      expect(trendsStatsMock).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            trendFunction: trendFunction.field,
            sort: '-' + sort,
            query: expect.stringContaining('trend_percentage():>1'),
            interval: '30m',
            field: transactionFields,
            statsPeriod: '14d',
          }),
        })
      );
    }
  });
});
