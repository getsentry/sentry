import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {DatabaseLandingPage} from 'sentry/views/insights/database/views/databaseLandingPage';

jest.mock('sentry/utils/useReleaseStats');

describe('DatabaseLandingPage', () => {
  const organization = OrganizationFixture({features: ['insight-modules']});

  const baseRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/insights/backend/database/`,
      query: {statsPeriod: '10d'},
    },
    route: `/organizations/:orgId/insights/backend/database/`,
  };

  let spanListRequestMock: jest.Mock;
  let spanChartsRequestMock: jest.Mock;

  ProjectsStore.loadInitialData([
    ProjectFixture({hasInsightsDb: true, firstTransactionEvent: true}),
  ]);

  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {period: '10d', start: null, end: null, utc: false},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'span-metrics'})],
      body: {
        data: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'api.insights.get-span-actions'})],
      body: {
        data: [{'span.action': 'SELECT', count: 1}],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'api.insights.get-span-domains'})],
      body: {
        data: [{'span.domain': ['sentry_users'], count: 1}],
      },
    });

    spanListRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'api.insights.use-span-list'})],
      body: {
        data: [
          {
            'span.group': '271536360c0b6f89',
            'sentry.normalized_description': 'SELECT * FROM users',
          },
          {
            'span.group': '360c0b6f89271536',
            'sentry.normalized_description': 'SELECT * FROM organizations',
          },
        ],
      },
    });

    spanChartsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        'epm()': {
          data: [
            [1699907700, [{count: 7810.2}]],
            [1699908000, [{count: 1216.8}]],
          ],
        },
      },
    });
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('fetches module data', async () => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {
      organization,
      initialRouterConfig: baseRouterConfig,
    });

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events-timeseries/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          excludeOther: 0,
          groupBy: undefined,
          interval: '30m',
          sort: undefined,
          partial: 1,
          project: [],
          query:
            'span.category:db !span.op:[db.sql.room,db.redis] has:sentry.normalized_description',
          referrer: 'api.insights.database.landing-throughput-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: ['epm()'],
          caseInsensitive: undefined,
        },
      })
    );

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${organization.slug}/events-timeseries/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          excludeOther: 0,
          groupBy: undefined,
          interval: '30m',
          sort: undefined,
          partial: 1,
          project: [],
          query:
            'span.category:db !span.op:[db.sql.room,db.redis] has:sentry.normalized_description',
          referrer: 'api.insights.database.landing-duration-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: ['avg(span.self_time)'],
          caseInsensitive: undefined,
        },
      })
    );

    expect(spanListRequestMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          field: [
            'project.id',
            'span.group',
            'sentry.normalized_description',
            'span.action',
            'epm()',
            'avg(span.self_time)',
            'sum(span.self_time)',
          ],
          per_page: 25,
          project: [],
          query:
            'span.category:db !span.op:[db.sql.room,db.redis] has:sentry.normalized_description',
          referrer: 'api.insights.use-span-list',
          sort: '-sum(span.self_time)',
          statsPeriod: '10d',
        },
      })
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });

  it('renders a list of queries', async () => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {
      organization,
      initialRouterConfig: baseRouterConfig,
    });

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('cell', {name: 'SELECT * FROM users'})).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {name: 'SELECT * FROM organizations'})
    ).toBeInTheDocument();
  });

  it('filters by category and action', async () => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {
      organization,
      initialRouterConfig: {
        ...baseRouterConfig,
        location: {
          ...baseRouterConfig.location,
          query: {
            statsPeriod: '10d',
            'span.action': 'SELECT',
            'span.domain': 'organizations',
          },
        },
      },
    });

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events-timeseries/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          excludeOther: 0,
          groupBy: undefined,
          interval: '30m',
          sort: undefined,
          partial: 1,
          project: [],
          query:
            'span.category:db !span.op:[db.sql.room,db.redis] has:sentry.normalized_description span.action:SELECT span.domain:organizations',
          referrer: 'api.insights.database.landing-throughput-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: ['epm()'],
          caseInsensitive: undefined,
        },
      })
    );

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${organization.slug}/events-timeseries/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          excludeOther: 0,
          groupBy: undefined,
          interval: '30m',
          sort: undefined,
          partial: 1,
          project: [],
          query:
            'span.category:db !span.op:[db.sql.room,db.redis] has:sentry.normalized_description span.action:SELECT span.domain:organizations',
          referrer: 'api.insights.database.landing-duration-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: ['avg(span.self_time)'],
          caseInsensitive: undefined,
        },
      })
    );

    expect(spanListRequestMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          field: [
            'project.id',
            'span.group',
            'sentry.normalized_description',
            'span.action',
            'epm()',
            'avg(span.self_time)',
            'sum(span.self_time)',
          ],
          per_page: 25,
          project: [],
          query:
            'span.category:db !span.op:[db.sql.room,db.redis] has:sentry.normalized_description span.action:SELECT span.domain:organizations',
          referrer: 'api.insights.use-span-list',
          sort: '-sum(span.self_time)',
          statsPeriod: '10d',
        },
      })
    );
  });

  it('displays the correct domain label for SQL systems', async () => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {
      organization,
      initialRouterConfig: {
        ...baseRouterConfig,
        location: {
          ...baseRouterConfig.location,
          query: {
            statsPeriod: '10d',
            'span.system': 'postgresql',
          },
        },
      },
    });

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    const domainSelector = await screen.findByTestId('domain-selector');
    expect(domainSelector).toHaveTextContent('Table');
  });

  it('displays the correct domain label for NoSQL systems', async () => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {
      organization,
      initialRouterConfig: {
        ...baseRouterConfig,
        location: {
          ...baseRouterConfig.location,
          query: {
            statsPeriod: '10d',
            'span.system': 'mongodb',
          },
        },
      },
    });

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    const domainSelector = await screen.findByTestId('domain-selector');
    expect(domainSelector).toHaveTextContent('Collection');
  });
});
