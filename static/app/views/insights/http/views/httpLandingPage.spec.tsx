import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {HTTPLandingPage} from 'sentry/views/insights/http/views/httpLandingPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useReleaseStats');

describe('HTTPLandingPage', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });

  let throughputRequestMock!: jest.Mock;
  let durationRequestMock!: jest.Mock;
  let statusRequestMock!: jest.Mock;

  let spanListRequestMock!: jest.Mock;
  let regionFilterRequestMock!: jest.Mock;
  jest.mocked(usePageFilters).mockReturnValue(
    PageFilterStateFixture({
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
    })
  );

  const useLocationMock = jest.mocked(useLocation);

  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();

    useLocationMock.mockReturnValue({
      pathname: '/insights/backend/http/',
      search: '',
      query: {statsPeriod: '10d', 'span.domain': 'git', project: '1'},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });

    ProjectsStore.loadInitialData([
      ProjectFixture({
        id: '1',
        name: 'Backend',
        slug: 'backend',
        firstTransactionEvent: true,
        platform: 'javascript',
        hasInsightsHttp: true,
      }),
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture({name: 'frontend'}), ProjectFixture({name: 'backend'})],
    });

    regionFilterRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.user-geo-subregion-selector',
        }),
      ],
      body: {
        data: [
          {'user.geo.subregion': '21', 'count()': 123},
          {'user.geo.subregion': '155', 'count()': 123},
        ],
        meta: {
          fields: {'user.geo.subregion': 'string', 'count()': 'integer'},
        },
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.http.landing-domains',
        }),
      ],
      body: {
        data: [{'count()': 43374}],
        meta: {
          fields: {'count()': 'integer'},
        },
      },
    });

    spanListRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.http.landing-domains-list',
        }),
      ],
      body: {
        data: [
          {
            'span.domain': ['*.sentry.io'],
            project: 'backend',
            'project.id': 1,
            'sum(span.self_time)': 815833579.659315,
            'epm()': 40767.0,
            'http_response_rate(3)': 0.00035567983908553485,
            'http_response_rate(4)': 0.3931893443226139,
            'http_response_rate(5)': 0.0037624385736829626,
            'avg(span.self_time)': 333.53512222275975,
          },
          {
            'span.domain': ['*.github.com'],
            project: 'frontend',
            'project.id': 2,
            'sum(span.self_time)': 473552338.9970339,
            'epm()': 29912.133333333335,
            'http_response_rate(3)': 0.0,
            'http_response_rate(4)': 0.0012324987407562593,
            'http_response_rate(5)': 0.004054096219594279,
            'avg(span.self_time)': 263.857441905979,
          },
        ],
        meta: {
          fields: {
            'project.id': 'integer',
            'span.domain': 'array',
            'sum(span.self_time)': 'duration',
            'http_response_rate(3)': 'percentage',
            'epm()': 'rate',
            'http_response_rate(4)': 'percentage',
            'http_response_rate(5)': 'percentage',
            'avg(span.self_time)': 'duration',
          },
        },
      },
    });

    throughputRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.http.landing-throughput-chart',
        }),
      ],
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'epm()',
            values: [
              {value: 7810.2, timestamp: 1699907700000},
              {value: 1216.8, timestamp: 1699908000000},
            ],
          }),
        ],
      },
    });

    durationRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.http.landing-duration-chart',
        }),
      ],
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'avg(span.self_time)',
            values: [
              {value: 710.2, timestamp: 1699907700000},
              {value: 1216.8, timestamp: 1699908000000},
            ],
          }),
        ],
      },
    });

    statusRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.http.landing-response-code-chart',
        }),
      ],
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'http_response_rate(3)',
            values: [{value: 0.2, timestamp: 1699908000000}],
          }),
          TimeSeriesFixture({
            yAxis: 'http_response_rate(4)',
            values: [{value: 0.1, timestamp: 1699908000000}],
          }),
          TimeSeriesFixture({
            yAxis: 'http_response_rate(5)',
            values: [{value: 0.1, timestamp: 1699908000000}],
          }),
        ],
      },
    });
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('fetches module data', async () => {
    render(<HTTPLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(throughputRequestMock).toHaveBeenNthCalledWith(
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
          partial: 1,
          project: [],
          query: 'span.op:http.client',
          referrer: 'api.insights.http.landing-throughput-chart',
          statsPeriod: '10d',
          yAxis: ['epm()'],
          caseInsensitive: undefined,
        },
      })
    );

    expect(regionFilterRequestMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          environment: [],
          field: ['user.geo.subregion', 'count()'],
          per_page: 50,
          project: [],
          query: 'has:user.geo.subregion',
          sort: '-count()',
          referrer: 'api.insights.user-geo-subregion-selector',
          sampling: SAMPLING_MODE.NORMAL,
          statsPeriod: '10d',
        },
      })
    );

    expect(durationRequestMock).toHaveBeenNthCalledWith(
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
          partial: 1,
          project: [],
          query: 'span.op:http.client',
          referrer: 'api.insights.http.landing-duration-chart',
          statsPeriod: '10d',
          yAxis: ['avg(span.self_time)'],
          caseInsensitive: undefined,
        },
      })
    );

    expect(statusRequestMock).toHaveBeenNthCalledWith(
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
          partial: 1,
          project: [],
          query: 'span.op:http.client',
          referrer: 'api.insights.http.landing-response-code-chart',
          statsPeriod: '10d',
          yAxis: [
            'http_response_rate(3)',
            'http_response_rate(4)',
            'http_response_rate(5)',
          ],
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
          environment: [],
          field: [
            'project',
            'project.id',
            'span.domain',
            'epm()',
            'http_response_rate(3)',
            'http_response_rate(4)',
            'http_response_rate(5)',
            'avg(span.self_time)',
            'sum(span.self_time)',
          ],
          per_page: 10,
          project: [],
          query: 'span.op:http.client span.domain:*git*',
          referrer: 'api.insights.http.landing-domains-list',
          sort: '-sum(span.self_time)',
          statsPeriod: '10d',
          sampling: SAMPLING_MODE.NORMAL,
        },
      })
    );
  });

  it('renders a list of domains', async () => {
    render(<HTTPLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('table', {name: 'Domains'})).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: 'Domain'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Project'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Requests Per Minute'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: '3XXs'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: '4XXs'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: '5XXs'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Avg Duration'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Time Spent'})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: '*.sentry.io'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '*.sentry.io'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/backend/http/domains/?domain=%2A.sentry.io&project=1&statsPeriod=10d'
    );
    expect(
      screen.getAllByRole('cell', {name: 'View Project Details'})[0]
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', {name: 'View Project Details'})[0]
    ).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/projects/backend/?project=1'
    );
    expect(screen.getByRole('cell', {name: '40.8K/s'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '0.04%'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '39.32%'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '0.38%'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '333.54ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '1.35wk'})).toBeInTheDocument();
  });

  it('sorts with query params', async () => {
    useLocationMock.mockReturnValue({
      pathname: '/insights/backend/http/',
      search: '',
      query: {
        statsPeriod: '10d',
        'span.domain': 'git',
        project: '1',
        [QueryParameterNames.DOMAINS_SORT]: '-avg(span.self_time)',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });

    render(<HTTPLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(spanListRequestMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          environment: [],
          field: [
            'project',
            'project.id',
            'span.domain',
            'epm()',
            'http_response_rate(3)',
            'http_response_rate(4)',
            'http_response_rate(5)',
            'avg(span.self_time)',
            'sum(span.self_time)',
          ],
          per_page: 10,
          project: [],
          query: 'span.op:http.client span.domain:*git*',
          referrer: 'api.insights.http.landing-domains-list',
          sort: '-avg(span.self_time)',
          statsPeriod: '10d',
          sampling: SAMPLING_MODE.NORMAL,
        },
      })
    );
  });
});
