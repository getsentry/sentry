import {browserHistory} from 'react-router';
import {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  initializeData,
  InitializeDataSettings,
} from 'sentry-test/performance/initializePerformanceData';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {WebVital} from 'sentry/utils/fields';
import TrendsIndex from 'sentry/views/performance/trends/';
import {defaultTrendsSelectionDate} from 'sentry/views/performance/trends/content';
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

async function getTrendDropdown() {
  const dropdown = await screen.findByRole('button', {name: /Percentile.+/});
  expect(dropdown).toBeInTheDocument();
  return dropdown;
}

async function getParameterDropdown() {
  const dropdown = await screen.findByRole('button', {name: /Parameter.+/});
  expect(dropdown).toBeInTheDocument();
  return dropdown;
}

async function waitForMockCall(mock: any) {
  await waitFor(() => {
    expect(mock).toHaveBeenCalled();
  });
}

function enterSearch(el, text) {
  fireEvent.change(el, {target: {value: text}});
  fireEvent.submit(el);
}

// Might swap on/off the skiphover to check perf later.
async function clickEl(el) {
  await userEvent.click(el, {skipHover: true});
}

function _initializeData(
  settings: InitializeDataSettings,
  options?: {selectedProjectId?: string}
) {
  const newSettings = {...settings};
  newSettings.projects = settings.projects ?? [
    ProjectFixture({id: '1', firstTransactionEvent: false}),
    ProjectFixture({id: '2', firstTransactionEvent: true}),
  ];

  if (options?.selectedProjectId) {
    const selectedProject = newSettings.projects.find(
      p => p.id === options.selectedProjectId
    );
    if (!selectedProject) {
      throw new Error("Test is selecting project that isn't loaded");
    } else {
      PageFiltersStore.updateProjects(
        settings.selectedProject ? [Number(selectedProject)] : [],
        []
      );
    }
    newSettings.selectedProject = selectedProject.id;
  }

  newSettings.selectedProject = settings.selectedProject ?? newSettings.projects[0].id;
  const data = initializeData(newSettings);

  // Modify page filters store to stop rerendering due to the test harness.
  PageFiltersStore.onInitializeUrlState(
    {
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '24h', utc: null},
    },
    new Set()
  );
  PageFiltersStore.updateDateTime(defaultTrendsSelectionDate);
  if (!options?.selectedProjectId) {
    PageFiltersStore.updateProjects(
      settings.selectedProject ? [Number(newSettings.projects[0].id)] : [],
      []
    );
  }

  act(() => ProjectsStore.loadInitialData(data.projects));
  return data;
}

function initializeTrendsData(
  projects: null | any[] = null,
  query = {},
  includeDefaultQuery = true,
  extraFeatures?: string[]
) {
  const _projects = Array.isArray(projects)
    ? projects
    : [
        ProjectFixture({id: '1', firstTransactionEvent: false}),
        ProjectFixture({id: '2', firstTransactionEvent: true}),
      ];
  const features = extraFeatures
    ? ['transaction-event', 'performance-view', ...extraFeatures]
    : ['transaction-event', 'performance-view'];
  const organization = OrganizationFixture({
    features,
    projects: _projects,
  });

  const newQuery = {...(includeDefaultQuery ? trendsViewQuery : {}), ...query};

  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: newQuery,
      },
    },
    projects: _projects,
    project: projects ? projects[0] : undefined,
  });

  act(() => ProjectsStore.loadInitialData(initialData.organization.projects));

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
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
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
            breakpoint: 'number',
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
              breakpoint: 1686967200,
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
              breakpoint: 1686967200,
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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'p95()': 1010.9232499999998,
            'p50()': 47.34580982348902,
            'tps()': 3.7226926286168966,
            'count()': 34872349,
            'failure_rate()': 0.43428379,
            'examples()': ['djk3w308er', '3298a9ui3h'],
          },
        ],
        meta: {
          fields: {
            'p95()': 'duration',
            '950()': 'duration',
            'tps()': 'number',
            'count()': 'number',
            'failure_rate()': 'number',
            'examples()': 'Array',
          },
          units: {
            'p95()': 'millisecond',
            'p50()': 'millisecond',
            'tps()': null,
            'count()': null,
            'failure_rate()': null,
            'examples()': null,
          },
          isMetricsData: true,
          tips: {},
          dataset: 'metrics',
        },
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-spans-performance/',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.reset());
  });

  it('renders basic UI elements', async function () {
    const data = _initializeData({});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    expect(await getTrendDropdown()).toBeInTheDocument();
    expect(await getParameterDropdown()).toBeInTheDocument();
    expect(screen.getAllByTestId('changed-transactions')).toHaveLength(2);
  });

  it('transaction list items are rendered', async function () {
    const data = _initializeData({});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    expect(await screen.findAllByTestId('trends-list-item-regression')).toHaveLength(2);
    expect(await screen.findAllByTestId('trends-list-item-improved')).toHaveLength(2);
  });

  it('view summary menu action links to the correct view', async function () {
    const projects = [ProjectFixture({id: '1', slug: 'internal'}), ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['1']});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    const transactions = await screen.findAllByTestId('trends-list-item-improved');
    expect(transactions).toHaveLength(2);
    const firstTransaction = transactions[0];

    const summaryLink = within(firstTransaction).getByTestId('item-transaction-name');

    expect(summaryLink.closest('a')).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/summary/?display=trend&project=1&query=tpm%28%29%3A%3E0.01%20transaction.duration%3A%3E0%20transaction.duration%3A%3C15min%20count_percentage%28%29%3A%3E0.25%20count_percentage%28%29%3A%3C4%20trend_percentage%28%29%3A%3E0%25%20confidence%28%29%3A%3E6&referrer=performance-transaction-summary&statsPeriod=14d&transaction=%2Forganizations%2F%3AorgId%2Fperformance%2F&trendFunction=p50&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
    );
  });

  it('view summary menu action opens performance change explorer with feature flag', async function () {
    const projects = [ProjectFixture({id: '1', slug: 'internal'}), ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['1']}, true, [
      'performance-change-explorer',
    ]);

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    const transactions = await screen.findAllByTestId('trends-list-item-improved');
    expect(transactions).toHaveLength(2);
    const firstTransaction = transactions[0];

    const summaryLink = within(firstTransaction).getByTestId('item-transaction-name');

    expect(summaryLink.closest('a')).not.toHaveAttribute('href');

    await clickEl(summaryLink);
    await waitFor(() => {
      expect(screen.getByText('Ongoing Improvement')).toBeInTheDocument();
      expect(screen.getByText('Throughput')).toBeInTheDocument();
      expect(screen.getByText('P95')).toBeInTheDocument();
      expect(screen.getByText('P50')).toBeInTheDocument();
      expect(screen.getByText('Failure Rate')).toBeInTheDocument();
    });
  });

  it('hide from list menu action modifies query', async function () {
    const projects = [ProjectFixture({id: '1', slug: 'internal'}), ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['1']});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    const transactions = await screen.findAllByTestId('trends-list-item-improved');
    expect(transactions).toHaveLength(2);
    const firstTransaction = transactions[0];

    const menuActions = within(firstTransaction).getAllByTestId('menu-action');
    expect(menuActions).toHaveLength(3);

    const menuAction = menuActions[2];
    await clickEl(menuAction);

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        project: expect.anything(),
        query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION} !transaction:/organizations/:orgId/performance/`,
      }),
    });
  });

  it('Changing search causes cursors to be reset', async function () {
    const projects = [ProjectFixture({id: '1', slug: 'internal'}), ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['1']});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    const input = await screen.findByTestId('smart-search-input');
    enterSearch(input, 'transaction.duration:>9000');

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
    const projects = [ProjectFixture({id: '1', slug: 'internal'}), ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['1']});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    const transactions = await screen.findAllByTestId('trends-list-item-improved');
    expect(transactions).toHaveLength(2);
    const firstTransaction = transactions[0];

    const menuActions = within(firstTransaction).getAllByTestId('menu-action');
    expect(menuActions).toHaveLength(3);

    const menuAction = menuActions[0];
    await clickEl(menuAction);

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        project: expect.anything(),
        query: 'tpm():>0.01 transaction.duration:>0 transaction.duration:<=863',
      }),
    });
  });

  it('exclude less than list menu action modifies query', async function () {
    const projects = [ProjectFixture({id: '1', slug: 'internal'}), ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['1']});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    const transactions = await screen.findAllByTestId('trends-list-item-improved');
    expect(transactions).toHaveLength(2);
    const firstTransaction = transactions[0];

    const menuActions = within(firstTransaction).getAllByTestId('menu-action');
    expect(menuActions).toHaveLength(3);

    const menuAction = menuActions[1];
    await clickEl(menuAction);

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        project: expect.anything(),
        query: 'tpm():>0.01 transaction.duration:<15min transaction.duration:>=863',
      }),
    });
  });

  it('choosing a trend function changes location', async function () {
    const projects = [ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['-1']});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    for (const trendFunction of TRENDS_FUNCTIONS) {
      // Open dropdown
      const dropdown = await getTrendDropdown();
      await clickEl(dropdown);

      // Select function
      const option = screen.getByRole('option', {name: trendFunction.label});
      await clickEl(option);

      expect(browserHistory.push).toHaveBeenCalledWith({
        query: expect.objectContaining({
          regressionCursor: undefined,
          improvedCursor: undefined,
          trendFunction: trendFunction.field,
        }),
      });
    }
  });

  it('sets LCP as a default trend parameter for frontend project if query does not specify trend parameter', async function () {
    const projects = [ProjectFixture({id: '1', platform: 'javascript'})];
    const data = initializeTrendsData(projects, {project: [1]});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    const trendDropdownButton = await getTrendDropdown();
    expect(trendDropdownButton).toHaveTextContent('Percentilep50');
  });

  it('sets duration as a default trend parameter for backend project if query does not specify trend parameter', async function () {
    const projects = [ProjectFixture({id: '1', platform: 'python'})];
    const data = initializeTrendsData(projects, {project: [1]});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    const parameterDropdownButton = await getParameterDropdown();
    expect(parameterDropdownButton).toHaveTextContent('ParameterDuration');
  });

  it('sets trend parameter from query and ignores default trend parameter', async function () {
    const projects = [ProjectFixture({id: '1', platform: 'javascript'})];
    const data = initializeTrendsData(projects, {project: [1], trendParameter: 'FCP'});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    const parameterDropdownButton = await getParameterDropdown();
    expect(parameterDropdownButton).toHaveTextContent('ParameterFCP');
  });

  it('choosing a parameter changes location', async function () {
    const projects = [ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['-1']});

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    for (const parameter of TRENDS_PARAMETERS) {
      // Open dropdown
      const dropdown = await getParameterDropdown();
      await clickEl(dropdown);

      // Select parameter
      const option = screen.getByRole('option', {name: parameter.label});
      await clickEl(option);

      expect(browserHistory.push).toHaveBeenCalledWith({
        query: expect.objectContaining({
          trendParameter: parameter.label,
        }),
      });
    }
  });

  it('choosing a web vitals parameter adds it as an additional condition to the query', async function () {
    const projects = [ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['-1']});

    const {rerender} = render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    for (const parameter of TRENDS_PARAMETERS) {
      if (Object.values(WebVital).includes(parameter.column as string as WebVital)) {
        trendsStatsMock.mockReset();

        const newLocation = {
          query: {...trendsViewQuery, trendParameter: parameter.label},
        };
        rerender(
          <TrendsIndex
            location={newLocation as unknown as Location}
            organization={data.organization}
          />
        );

        await waitForMockCall(trendsStatsMock);

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
  });

  it('trend functions in location make api calls', async function () {
    const projects = [ProjectFixture(), ProjectFixture()];
    const data = initializeTrendsData(projects, {project: ['-1']});

    const {rerender} = render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    for (const trendFunction of TRENDS_FUNCTIONS) {
      trendsStatsMock.mockReset();

      const newLocation = {
        query: {...trendsViewQuery, trendFunction: trendFunction.field},
      };
      rerender(
        <TrendsIndex
          location={newLocation as unknown as Location}
          organization={data.organization}
        />
      );

      await waitForMockCall(trendsStatsMock);

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
            interval: '1h',
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
            interval: '1h',
            field: transactionFields,
            statsPeriod: '14d',
          }),
        })
      );
    }
  });

  it('Visiting trends with trends feature will update filters if none are set', function () {
    const data = initializeTrendsData(undefined, {}, false);

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

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

    render(
      <TrendsIndex location={data.router.location} organization={data.organization} />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    (browserHistory.push as any).mockReset();

    const byTransactionLink = await screen.findByTestId('breadcrumb-link');

    expect(byTransactionLink.closest('a')).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/?query=device.family%3AMac'
    );
  });
});
