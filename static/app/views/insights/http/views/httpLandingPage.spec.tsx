import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {HTTPLandingPage} from 'sentry/views/insights/http/views/httpLandingPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useProjects');
jest.mock('sentry/views/insights/common/queries/useOnboardingProject');

describe('HTTPLandingPage', function () {
  const organization = OrganizationFixture({
    features: ['insights-initial-modules', 'insights-entry-points'],
  });

  let spanListRequestMock!: jest.Mock;
  let spanChartsRequestMock!: jest.Mock;

  jest.mocked(useOnboardingProject).mockReturnValue(undefined);

  jest.mocked(usePageFilters).mockReturnValue({
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

  jest.mocked(useLocation).mockReturnValue({
    pathname: '/insights/backend/http/',
    search: '',
    query: {statsPeriod: '10d', 'span.domain': 'git', project: '1'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useProjects).mockReturnValue({
    projects: [
      ProjectFixture({
        id: '1',
        name: 'Backend',
        slug: 'backend',
        firstTransactionEvent: true,
        platform: 'javascript',
        hasInsightsHttp: true,
      }),
    ],
    onSearch: jest.fn(),
    reloadProjects: jest.fn(),
    placeholders: [],
    fetching: false,
    hasMore: null,
    fetchError: null,
    initiallyLoaded: false,
  });

  beforeEach(function () {
    jest.clearAllMocks();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture({name: 'frontend'}), ProjectFixture({name: 'backend'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.performance.http.landing-domains',
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
          referrer: 'api.performance.http.landing-domains-list',
        }),
      ],
      body: {
        data: [
          {
            'span.domain': ['*.sentry.io'],
            project: 'backend',
            'project.id': 1,
            'sum(span.self_time)': 815833579.659315,
            'spm()': 40767.0,
            'time_spent_percentage()': 0.33634048399458855,
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
            'spm()': 29912.133333333335,
            'time_spent_percentage()': 0.19522955032268177,
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
            'spm()': 'rate',
            'time_spent_percentage()': 'percentage',
            'http_response_rate(4)': 'percentage',
            'http_response_rate(5)': 'percentage',
            'avg(span.self_time)': 'duration',
          },
        },
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
    jest.resetAllMocks();
  });

  it('fetches module data', async function () {
    render(<HTTPLandingPage />, {organization});

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
          query: 'span.module:http span.op:http.client',
          referrer: 'api.performance.http.landing-throughput-chart',
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
          query: 'span.module:http span.op:http.client',
          referrer: 'api.performance.http.landing-duration-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'avg(span.self_time)',
          transformAliasToInputFormat: '1',
        },
      })
    );

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      3,
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
          query: 'span.module:http span.op:http.client',
          referrer: 'api.performance.http.landing-response-code-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: [
            'http_response_rate(3)',
            'http_response_rate(4)',
            'http_response_rate(5)',
          ],
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
            'project',
            'project.id',
            'span.domain',
            'spm()',
            'http_response_rate(3)',
            'http_response_rate(4)',
            'http_response_rate(5)',
            'avg(span.self_time)',
            'sum(span.self_time)',
            'time_spent_percentage()',
          ],
          per_page: 10,
          project: [],
          query: 'span.module:http span.op:http.client span.domain:*git*',
          referrer: 'api.performance.http.landing-domains-list',
          sort: '-time_spent_percentage()',
          statsPeriod: '10d',
        },
      })
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });

  it('renders a list of domains', async function () {
    render(<HTTPLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Backend');
    const tab = screen.getByRole('tab', {name: 'Outbound API Requests'});
    expect(tab).toBeInTheDocument();
    expect(tab).toHaveAttribute('aria-selected', 'true');

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
    ).toHaveAttribute('href', '/organizations/org-slug/projects/backend/?project=1');
    expect(screen.getByRole('cell', {name: '40.8K/s'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '0.04%'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '39.32%'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '0.38%'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '333.54ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '1.35wk'})).toBeInTheDocument();
  });
});
