import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {DatabaseLandingPage} from 'sentry/views/insights/database/views/databaseLandingPage';

vi.mock('sentry/utils/useLocation');
vi.mock('sentry/utils/usePageFilters');
vi.mock('sentry/utils/useProjects');
vi.mock('sentry/views/insights/common/queries/useOnboardingProject');
import {useReleaseStats} from 'sentry/utils/useReleaseStats';

vi.mock('sentry/utils/useReleaseStats');

describe('DatabaseLandingPage', function () {
  const organization = OrganizationFixture({features: ['insights-initial-modules']});

  let spanListRequestMock: vi.Mock;
  let spanChartsRequestMock: vi.Mock;

  vi.mocked(useProjects).mockReturnValue({
    projects: [ProjectFixture({hasInsightsDb: true})],
    onSearch: vi.fn(),
    reloadProjects: vi.fn(),
    placeholders: [],
    fetching: false,
    hasMore: null,
    fetchError: null,
    initiallyLoaded: false,
  });

  vi.mocked(useOnboardingProject).mockReturnValue(undefined);

  vi.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [],
    },
  });

  vi.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  vi.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

  beforeEach(function () {
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
      match: [MockApiClient.matchQuery({referrer: 'api.starfish.get-span-actions'})],
      body: {
        data: [{'span.action': 'SELECT', count: 1}],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'api.starfish.get-span-domains'})],
      body: {
        data: [{'span.domain': ['sentry_users'], count: 1}],
      },
    });

    spanListRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'api.starfish.use-span-list'})],
      body: {
        data: [
          {
            'span.group': '271536360c0b6f89',
            'span.description': 'SELECT * FROM users',
          },
          {
            'span.group': '360c0b6f89271536',
            'span.description': 'SELECT * FROM organizations',
          },
        ],
      },
    });

    spanChartsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        'spm()': {
          data: [
            [1699907700, [{count: 7810.2}]],
            [1699908000, [{count: 1216.8}]],
          ],
        },
      },
    });
  });

  afterAll(function () {
    vi.resetAllMocks();
  });

  it('fetches module data', async function () {
    vi.spyOn(console, 'error').mockImplementation(vi.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {organization});

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events-stats/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          cursor: undefined,
          dataset: 'spansMetrics',
          environment: [],
          excludeOther: 0,
          field: [],
          interval: '30m',
          orderby: undefined,
          partial: 1,
          per_page: 50,
          project: [],
          query: 'span.module:db has:span.description',
          referrer: 'api.starfish.span-landing-page-metrics-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'spm()',
          transformAliasToInputFormat: '1',
        },
      })
    );

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${organization.slug}/events-stats/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          cursor: undefined,
          dataset: 'spansMetrics',
          environment: [],
          excludeOther: 0,
          field: [],
          interval: '30m',
          orderby: undefined,
          partial: 1,
          per_page: 50,
          project: [],
          query: 'span.module:db has:span.description',
          referrer: 'api.starfish.span-landing-page-metrics-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'avg(span.self_time)',
          transformAliasToInputFormat: '1',
        },
      })
    );

    expect(spanListRequestMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'project.id',
            'span.group',
            'span.description',
            'span.action',
            'spm()',
            'avg(span.self_time)',
            'sum(span.self_time)',
            'time_spent_percentage()',
          ],
          per_page: 25,
          project: [],
          query: 'span.module:db has:span.description',
          referrer: 'api.starfish.use-span-list',
          sort: '-time_spent_percentage()',
          statsPeriod: '10d',
        },
      })
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });

  it('renders a list of queries', async function () {
    vi.spyOn(console, 'error').mockImplementation(vi.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('cell', {name: 'SELECT * FROM users'})).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {name: 'SELECT * FROM organizations'})
    ).toBeInTheDocument();
  });

  it('filters by category and action', async function () {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        statsPeriod: '10d',
        'span.action': 'SELECT',
        'span.domain': 'organizations',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });

    vi.spyOn(console, 'error').mockImplementation(vi.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events-stats/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          cursor: undefined,
          dataset: 'spansMetrics',
          environment: [],
          excludeOther: 0,
          field: [],
          interval: '30m',
          orderby: undefined,
          partial: 1,
          per_page: 50,
          project: [],
          query:
            'span.module:db has:span.description span.action:SELECT span.domain:organizations',
          referrer: 'api.starfish.span-landing-page-metrics-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'spm()',
          transformAliasToInputFormat: '1',
        },
      })
    );

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${organization.slug}/events-stats/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          cursor: undefined,
          dataset: 'spansMetrics',
          environment: [],
          excludeOther: 0,
          field: [],
          interval: '30m',
          orderby: undefined,
          partial: 1,
          per_page: 50,
          project: [],
          query:
            'span.module:db has:span.description span.action:SELECT span.domain:organizations',
          referrer: 'api.starfish.span-landing-page-metrics-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'avg(span.self_time)',
          transformAliasToInputFormat: '1',
        },
      })
    );

    expect(spanListRequestMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'project.id',
            'span.group',
            'span.description',
            'span.action',
            'spm()',
            'avg(span.self_time)',
            'sum(span.self_time)',
            'time_spent_percentage()',
          ],
          per_page: 25,
          project: [],
          query:
            'span.module:db has:span.description span.action:SELECT span.domain:organizations',
          referrer: 'api.starfish.use-span-list',
          sort: '-time_spent_percentage()',
          statsPeriod: '10d',
        },
      })
    );
  });

  it('displays the correct domain label for SQL systems', async function () {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        statsPeriod: '10d',
        'span.system': 'postgresql',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });

    vi.spyOn(console, 'error').mockImplementation(vi.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    const domainSelector = await screen.findByTestId('domain-selector');
    expect(domainSelector).toHaveTextContent('Table');
  });

  it('displays the correct domain label for NoSQL systems', async function () {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        statsPeriod: '10d',
        'span.system': 'mongodb',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });

    vi.spyOn(console, 'error').mockImplementation(vi.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    const domainSelector = await screen.findByTestId('domain-selector');
    expect(domainSelector).toHaveTextContent('Collection');
  });
});
