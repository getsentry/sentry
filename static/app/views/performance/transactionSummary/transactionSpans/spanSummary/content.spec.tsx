import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import SpanSummary from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/content';

jest.mock('sentry/utils/useParams');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useProjects');

describe('SpanSummaryPage', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d', project: '1'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useProjects).mockReturnValue({
    projects: [],
    onSearch: jest.fn(),
    reloadProjects: jest.fn(),
    placeholders: [],
    fetching: false,
    hasMore: null,
    fetchError: null,
    initiallyLoaded: false,
  });

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
      projects: [parseInt(project.id, 10)],
    },
  });

  let headerDataMock: jest.Mock;
  let avgDurationChartMock: jest.Mock;
  let spanThroughputChartMock: jest.Mock;
  let transactionThroughputChartMock: jest.Mock;

  beforeEach(() => {
    jest.mocked(useParams).mockReturnValue({
      spanSlug: 'db:aaaaaaaa',
    });

    jest.clearAllMocks();

    avgDurationChartMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.performance.span-summary-duration-chart',
        }),
      ],
      body: {
        data: [
          [
            1717102800,
            [
              {
                count: 4.924892746006871,
              },
            ],
          ],
          [
            1717104600,
            [
              {
                count: 8.20925404044671,
              },
            ],
          ],
          [
            1717106400,
            [
              {
                count: 7.218881600137195,
              },
            ],
          ],
        ],
      },
    });

    spanThroughputChartMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.performance.span-summary-throughput-chart',
        }),
      ],
      body: {
        data: [
          [
            1717102800,
            [
              {
                count: 22580.666666666668,
              },
            ],
          ],
          [
            1717104600,
            [
              {
                count: 258816.26666666666,
              },
            ],
          ],
          [
            1717106400,
            [
              {
                count: 305550.4666666667,
              },
            ],
          ],
        ],
      },
    });

    transactionThroughputChartMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.performance.span-summary-transaction-throughput-chart',
        }),
      ],
      body: {
        data: [
          [
            1717102800,
            [
              {
                count: 152823.58333333334,
              },
            ],
          ],
          [
            1717106400,
            [
              {
                count: 143062.61666666667,
              },
            ],
          ],
          [
            1717110000,
            [
              {
                count: 158031.58333333334,
              },
            ],
          ],
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'transaction.id': '93b88037ba134225bdf67d05a69de9ab',
            project: 'sentry',
            'project.name': 'sentry',
            span_id: '9b6e1f295ce7e875',
            id: '9b6e1f295ce7e875',
            'span.duration': 0.860929,
            trace: '80a8718f4b3847eb8d6f3b5715602558',
            timestamp: '2024-05-16T14:45:15+00:00',
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'transaction.duration': 160,
            id: '93b88037ba134225bdf67d05a69de9ab',
            'project.name': 'sentry',
          },
          {
            'transaction.duration': 50,
            id: '2a2c0e1a7cf941f6bcd8ab22b0c4d8c9',
            'project.name': 'sentry',
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  it('correctly renders the details in the header', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/spans/fields/',
      body: [],
    });

    headerDataMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'span.description': 'SELECT thing FROM my_cool_db WHERE value = %s',
            'avg(span.duration)': 1.7381229881349218,
            'count()': 3677407172,
            'sum(span.duration)': 6391491809.035965,
          },
        ],
        meta: {
          fields: {
            'span.description': 'string',
            'sum(span.duration)': 'duration',
            'count()': 'integer',
            'avg(span.duration)': 'duration',
          },
          units: {
            'span.description': null,
            'sum(span.duration)': 'millisecond',
            'count()': null,
            'avg(span.duration)': 'millisecond',
          },
          isMetricsData: false,
          isMetricsExtractedData: false,
          tips: {},
          datasetReason: 'unchanged',
          dataset: 'spansMetrics',
        },
      },
    });

    render(
      <SpanSummary
        spanSlug={{group: 'aaaaaaaa', op: 'db'}}
        transactionName="transaction"
        organization={organization}
        project={undefined}
      />
    );

    expect(headerDataMock).toHaveBeenCalled();

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(await screen.findByTestId('operation-name')).toHaveTextContent('db');
    expect(await screen.findByTestId('header-span-description')).toHaveTextContent(
      'SELECT thing FROM my_cool_db WHERE value = %s'
    );
    expect(await screen.findByTestId('header-avg-duration')).toHaveTextContent('1.74ms');
    expect(await screen.findByTestId('header-total-time-spent')).toHaveTextContent(
      '2.43mo'
    );
    expect(await screen.findByTestId('total-span-count')).toHaveTextContent('3.6b spans');
  });

  it('renders the charts', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/spans/fields/',
      body: [],
    });

    render(
      <SpanSummary
        spanSlug={{group: 'aaaaaaaa', op: 'db'}}
        transactionName="transaction"
        organization={organization}
        project={project}
      />
    );

    expect(avgDurationChartMock).toHaveBeenCalled();
    expect(spanThroughputChartMock).toHaveBeenCalled();
    expect(transactionThroughputChartMock).toHaveBeenCalled();

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    const chartHeaders = await screen.findAllByTestId('chart-panel-header');
    expect(chartHeaders[0]).toHaveTextContent('Average Duration');
    expect(chartHeaders[1]).toHaveTextContent('Span Throughput');
    expect(chartHeaders[2]).toHaveTextContent('Transaction Throughput');
  });
});
