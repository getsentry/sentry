import {browserHistory} from 'react-router';

import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {WebVital} from 'sentry/utils/discover/fields';
import TrendsIndex from 'sentry/views/performance/trends/';
import {
  DEFAULT_MAX_DURATION,
  TRENDS_FUNCTIONS,
  TRENDS_PARAMETERS,
} from 'sentry/views/performance/trends/utils';

const trendsViewQuery = {
  query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
};

jest.mock('moment', () => {
  const moment = jest.requireActual('moment');
  moment.now = jest.fn().mockReturnValue(1601251200000);
  return moment;
});

function selectTrendFunction(wrapper, field) {
  const menu = wrapper.find('TrendsDropdown DropdownMenu');
  expect(menu).toHaveLength(2);
  menu.find('DropdownButton').first().simulate('click');

  const option = menu.find(`DropdownItem[data-test-id="${field}"] span`);
  expect(option).toHaveLength(1);
  option.simulate('click');

  wrapper.update();
}

function selectTrendParameter(wrapper, label) {
  const menu = wrapper.find('TrendsDropdown DropdownMenu');
  expect(menu).toHaveLength(2);
  menu.find('DropdownButton').at(1).simulate('click');

  const option = menu.find(`DropdownItem[data-test-id="${label}"] span`);
  expect(option).toHaveLength(1);
  option.simulate('click');

  wrapper.update();
}

function initializeTrendsData(
  projects = undefined,
  query = {},
  includeDefaultQuery = true
) {
  projects = Array.isArray(projects)
    ? projects
    : [
        TestStubs.Project({id: '1', firstTransactionEvent: false}),
        TestStubs.Project({id: '2', firstTransactionEvent: true}),
      ];
  const features = ['transaction-event', 'performance-view'];
  const organization = TestStubs.Organization({
    features,
    projects,
  });

  const newQuery = {...(includeDefaultQuery ? trendsViewQuery : {}), ...query};

  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: newQuery,
      },
    },
  });
  act(() => ProjectsStore.loadInitialData(initialData.organization.projects));
  return initialData;
}

describe('Performance > Trends', function () {
  enforceActOnUseLegacyStoreHook();

  let trendsStatsMock;
  let wrapper;
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
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
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
            count_percentage: 'percentage',
            trend_percentage: 'percentage',
            trend_difference: 'number',
            aggregate_range_1: 'duration',
            aggregate_range_2: 'duration',
            transaction: 'string',
          },
          data: [
            {
              count: 8,
              project: 'internal',
              count_range_1: 2,
              count_range_2: 6,
              count_percentage: 3,
              trend_percentage: 1.9235225955967554,
              trend_difference: 797,
              aggregate_range_1: 863,
              aggregate_range_2: 1660,
              transaction: '/organizations/:orgId/performance/',
            },
            {
              count: 60,
              project: 'internal',
              count_range_1: 20,
              count_range_2: 40,
              count_percentage: 2,
              trend_percentage: 1.204968944099379,
              trend_difference: 66,
              aggregate_range_1: 322,
              aggregate_range_2: 388,
              transaction: '/api/0/internal/health/',
            },
          ],
        },
      },
    });
  });

  afterEach(function () {
    wrapper.unmount();
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.reset());
  });

  it('renders basic UI elements', async function () {
    const projects = [TestStubs.Project()];
    const data = initializeTrendsData(projects, {});

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
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
    const data = initializeTrendsData(projects, {project: ['-1']});

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('TrendsListItem')).toHaveLength(4);
  });

  it('view summary menu action links to the correct view', async function () {
    const projects = [TestStubs.Project({id: 1, slug: 'internal'}), TestStubs.Project()];
    const data = initializeTrendsData(projects, {project: ['1']});

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownLink').first().simulate('click');

    const firstTransaction = wrapper.find('TrendsListItem').first();
    const summaryLink = firstTransaction.find('ItemTransactionName');

    expect(summaryLink.props().to).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/summary/',
        query: expect.objectContaining({
          project: 1,
          display: 'trend',
          trendFunction: 'p50',
          trendColumn: 'transaction.duration',
        }),
      })
    );
  });

  it('hide from list menu action modifies query', async function () {
    const projects = [TestStubs.Project({id: 1, slug: 'internal'}), TestStubs.Project()];
    const data = initializeTrendsData(projects, {project: ['1']});

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
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
        query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION} !transaction:/organizations/:orgId/performance/`,
      }),
    });
  });

  it('Changing search causes cursors to be reset', async function () {
    const projects = [TestStubs.Project({id: 1, slug: 'internal'}), TestStubs.Project()];
    const data = initializeTrendsData(projects, {project: ['1']});

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
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
      }),
    });
  });

  it('exclude greater than list menu action modifies query', async function () {
    const projects = [TestStubs.Project({id: 1, slug: 'internal'}), TestStubs.Project()];
    const data = initializeTrendsData(projects, {project: ['1']});

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
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
        query: 'tpm():>0.01 transaction.duration:>0 transaction.duration:<=863',
      }),
    });
  });

  it('exclude less than list menu action modifies query', async function () {
    const projects = [TestStubs.Project({id: 1, slug: 'internal'}), TestStubs.Project()];
    const data = initializeTrendsData(projects, {project: ['1']});

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
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
        query: `tpm():>0.01 transaction.duration:<${DEFAULT_MAX_DURATION} transaction.duration:>=863`,
      }),
    });
  });

  it('choosing a trend function changes location', async function () {
    const projects = [TestStubs.Project()];
    const data = initializeTrendsData(projects, {project: ['-1']});
    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    for (const trendFunction of TRENDS_FUNCTIONS) {
      selectTrendFunction(wrapper, trendFunction.field);

      await tick();
      wrapper.update();

      expect(browserHistory.push).toHaveBeenCalledWith({
        query: expect.objectContaining({
          regressionCursor: undefined,
          improvedCursor: undefined,
          trendFunction: trendFunction.field,
        }),
      });
    }
  }, 10000);

  it('sets LCP as a default trend parameter for frontend project if query does not specify trend parameter', async function () {
    const projects = [TestStubs.Project({id: 1, platform: 'javascript'})];
    const data = initializeTrendsData(projects, {project: [1]});
    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    const menu = wrapper.find('TrendsDropdown DropdownMenu').find('DropdownButton').at(1);
    const label = menu.find('DropdownButton');
    expect(label.text()).toContain('LCP');
  });

  it('sets duration as a default trend parameter for backend project if query does not specify trend parameter', async function () {
    const projects = [TestStubs.Project({id: 1, platform: 'python'})];
    const data = initializeTrendsData(projects, {project: [1]});
    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    const menu = wrapper.find('TrendsDropdown DropdownMenu').find('DropdownButton').at(1);
    const label = menu.find('DropdownButton');
    expect(label.text()).toContain('Duration');
  });

  it('sets trend parameter from query and ignores default trend parameter', async function () {
    const projects = [TestStubs.Project({id: 1, platform: 'javascript'})];
    const data = initializeTrendsData(projects, {project: [1], trendParameter: 'FCP'});
    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    const menu = wrapper.find('TrendsDropdown DropdownMenu').find('DropdownButton').at(1);
    const label = menu.find('DropdownButton');
    expect(label.text()).toContain('FCP');
  });

  it('choosing a parameter changes location', async function () {
    const projects = [TestStubs.Project()];
    const data = initializeTrendsData(projects, {project: ['-1']});
    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    for (const parameter of TRENDS_PARAMETERS) {
      selectTrendParameter(wrapper, parameter.label);

      await tick();
      wrapper.update();

      expect(browserHistory.push).toHaveBeenCalledWith({
        query: expect.objectContaining({
          trendParameter: parameter.label,
        }),
      });
    }
  }, 10000);

  it('choosing a web vitals parameter adds it as an additional condition to the query', async function () {
    const projects = [TestStubs.Project()];
    const data = initializeTrendsData(projects, {project: ['-1']});

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    for (const parameter of TRENDS_PARAMETERS) {
      if (Object.values(WebVital).includes(parameter.column)) {
        trendsStatsMock.mockReset();

        wrapper.setProps({
          location: {query: {...trendsViewQuery, trendParameter: parameter.label}},
        });

        wrapper.update();
        await tick();

        expect(trendsStatsMock).toHaveBeenCalledTimes(2);

        // Improved transactions call
        expect(trendsStatsMock).toHaveBeenNthCalledWith(
          1,
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`has:${parameter.column}`),
            }),
          })
        );

        // Regression transactions call
        expect(trendsStatsMock).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`has:${parameter.column}`),
            }),
          })
        );
      }
    }
  }, 10000);

  it('trend functions in location make api calls', async function () {
    const projects = [TestStubs.Project(), TestStubs.Project()];
    const data = initializeTrendsData(projects, {project: ['-1']});

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
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

      const sort = 'trend_percentage()';

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
            trendFunction: `${trendFunction.field}(transaction.duration)`,
            sort,
            query: expect.stringContaining('trend_percentage():>0%'),
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
            trendFunction: `${trendFunction.field}(transaction.duration)`,
            sort: '-' + sort,
            query: expect.stringContaining('trend_percentage():>0%'),
            interval: '30m',
            field: transactionFields,
            statsPeriod: '14d',
          }),
        })
      );
    }
  }, 10000);

  it('Visiting trends with trends feature will update filters if none are set', async function () {
    const data = initializeTrendsData(undefined, {}, false);

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(browserHistory.push).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: {
          query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
        },
      })
    );
  });

  it('Navigating away from trends will remove extra tags from query', async function () {
    const data = initializeTrendsData(
      undefined,
      {
        query: `device.family:Mac tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
      },
      false
    );

    wrapper = mountWithTheme(
      <TrendsIndex organization={data.organization} location={data.router.location} />,
      data.routerContext
    );

    await tick();
    wrapper.update();

    browserHistory.push.mockReset();

    const byTransactionLink = wrapper.find('BreadcrumbLink');

    expect(byTransactionLink.props().to).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/',
        query: {
          query: 'device.family:Mac',
        },
      })
    );
  });
});
