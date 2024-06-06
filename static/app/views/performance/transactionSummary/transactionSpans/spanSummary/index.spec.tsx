import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useParams} from 'sentry/utils/useParams';
import SpanSummary from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/';

function initializeData(settings) {
  const data = _initializeData(settings);
  act(() => void ProjectsStore.loadInitialData(data.organization.projects));
  return data;
}

jest.mock('sentry/utils/useParams', () => ({
  useParams: jest.fn(),
}));

describe('Performance > Transaction Spans > Span Summary', function () {
  beforeEach(() => {
    jest.mocked(useParams).mockReturnValue({
      spanSlug: 'db:aaaaaaaa',
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
  });

  afterEach(() => {
    ProjectsStore.reset();
    jest.resetAllMocks();
  });

  it('correctly renders the details in the header', async () => {
    const headerDataMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'span.description': 'SELECT thing FROM my_cool_db WHERE value = %s',
            'avg(span.duration)': 1.7381229881349218,
            'count()': 3677407172,
            'sum(span.self_time)': 6391491809.035965,
          },
        ],
        meta: {
          fields: {
            'span.description': 'string',
            'sum(span.self_time)': 'duration',
            'count()': 'integer',
            'avg(span.duration)': 'duration',
          },
          units: {
            'span.description': null,
            'sum(span.self_time)': 'millisecond',
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

    const data = initializeData({});

    render(
      <SpanSummary
        spanSlug={{group: 'aaaaaaaa', op: 'db'}}
        transactionName="transaction"
        {...data}
      />,
      {organization: data.organization}
    );

    expect(headerDataMock).toHaveBeenCalled();

    const headerContainerOp = await screen.findByTestId('operation-name');
    const headerContainerDescription = await screen.findByTestId(
      'header-span-description'
    );
    const avgDuration = await screen.findByTestId('header-avg-duration');
    const timeSpent = await screen.findByTestId('header-total-time-spent');
    const totalSpanCount = await screen.findByTestId('total-span-count');

    expect(headerContainerOp).toHaveTextContent('db');
    expect(headerContainerDescription).toHaveTextContent(
      'SELECT thing FROM my_cool_db WHERE value = %s'
    );
    expect(avgDuration).toHaveTextContent('1.74ms');
    expect(timeSpent).toHaveTextContent('2.43mo');
    expect(totalSpanCount).toHaveTextContent('3.6b spans');
  });

  it('renders the charts', () => {
    const chartMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [],
      },
    });

    const data = initializeData({});

    render(
      <SpanSummary
        spanSlug={{group: 'aaaaaaaa', op: 'db'}}
        transactionName="transaction"
        {...data}
      />,
      {organization: data.organization}
    );

    expect(chartMock).toHaveBeenCalled();

    screen.debug();
  });
});
