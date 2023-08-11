import React from 'react';
import moment from 'moment';

import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {SuspectSpans} from 'sentry/utils/performance/suspectSpans/types';
import {PerformanceChangeExplorer} from 'sentry/views/performance/trends/changeExplorer';
import {
  COLUMNS,
  MetricsTable,
  renderBodyCell,
} from 'sentry/views/performance/trends/changeExplorerUtils/metricsTable';
import {SpansList} from 'sentry/views/performance/trends/changeExplorerUtils/spansList';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendFunctionField,
} from 'sentry/views/performance/trends/types';
import {TRENDS_PARAMETERS} from 'sentry/views/performance/trends/utils';

async function waitForMockCall(mock: jest.Mock) {
  await waitFor(() => {
    expect(mock).toHaveBeenCalled();
  });
}

const transaction: NormalizedTrendsTransaction = {
  aggregate_range_1: 78.2757131147541,
  aggregate_range_2: 110.50465131578949,
  breakpoint: 1687262400,
  project: 'sentry',
  transaction: 'sentry.tasks.store.save_event',
  trend_difference: 32.22893820103539,
  trend_percentage: 1.411736117354651,
  count: 3459,
  received_at: moment(1601251200000),
};

const spanResults: SuspectSpans = [
  {
    op: 'db',
    group: '1',
    description: 'span1',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '2',
    description: 'span2',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '3',
    description: 'span3',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '4',
    description: 'span4',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '5',
    description: 'span5',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '6',
    description: 'span6',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '7',
    description: 'span7',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '8',
    description: 'span8',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '9',
    description: 'span9',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '10',
    description: 'span10',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
  {
    op: 'db',
    group: '11',
    description: 'span11',
    frequency: 4,
    count: 4,
    avgOccurrences: undefined,
    sumExclusiveTime: 345345,
    p50ExclusiveTime: undefined,
    p75ExclusiveTime: 25,
    p95ExclusiveTime: undefined,
    p99ExclusiveTime: undefined,
    examples: [],
  },
];

describe('Performance > Trends > Performance Change Explorer', function () {
  let eventsMockBefore;
  let spansMock;
  beforeEach(function () {
    eventsMockBefore = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'p95()': 1010.9232499999998,
            'p50()': 47.34580982348902,
            'tps()': 3.7226926286168966,
            'count()': 345,
            'failure_rate()': 0.23498234,
          },
        ],
        meta: {
          fields: {
            'p95()': 'duration',
            '950()': 'duration',
            'tps()': 'number',
            'count()': 'number',
            'failure_rate()': 'number',
          },
          units: {
            'p95()': 'millisecond',
            'p50()': 'millisecond',
            'tps()': null,
            'count()': null,
            'failure_rate()': null,
          },
          isMetricsData: true,
          tips: {},
          dataset: 'metrics',
        },
      },
    });

    spansMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-spans-performance/',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.reset());
  });

  it('renders basic UI elements', async function () {
    const data = initializeData();
    const statsData = {
      ['/organizations/:orgId/performance/']: {
        data: [],
        order: 0,
      },
    };

    render(
      <PerformanceChangeExplorer
        collapsed={false}
        transaction={transaction}
        onClose={() => {}}
        trendChangeType={TrendChangeType.REGRESSION}
        trendFunction={TrendFunctionField.P50}
        trendParameter={TRENDS_PARAMETERS[0]}
        trendView={data.eventView}
        statsData={statsData}
        isLoading={false}
        organization={data.organization}
        projects={data.projects}
        location={data.location}
      />,
      {
        context: data.routerContext,
        organization: data.organization,
      }
    );

    await waitForMockCall(eventsMockBefore);
    await waitForMockCall(spansMock);

    await waitFor(() => {
      expect(screen.getByTestId('pce-header')).toBeInTheDocument();
      expect(screen.getByTestId('pce-graph')).toBeInTheDocument();
      expect(screen.getByTestId('grid-editable')).toBeInTheDocument();
      expect(screen.getAllByTestId('pce-metrics-chart-row-metric')).toHaveLength(4);
      expect(screen.getAllByTestId('pce-metrics-chart-row-before')).toHaveLength(4);
      expect(screen.getAllByTestId('pce-metrics-chart-row-after')).toHaveLength(4);
      expect(screen.getAllByTestId('pce-metrics-chart-row-change')).toHaveLength(4);
      expect(screen.getByTestId('spans-no-results')).toBeInTheDocument();
    });
  });

  it('shows correct change notation for no change', async () => {
    const data = initializeData();

    render(
      <MetricsTable
        isLoading={false}
        location={data.location}
        trendFunction={TrendFunctionField.P50}
        transaction={transaction}
        trendView={data.eventView}
        organization={data.organization}
      />
    );

    await waitForMockCall(eventsMockBefore);

    await waitFor(() => {
      expect(screen.getAllByText('3.7 ps')).toHaveLength(2);
      expect(screen.getAllByTestId('pce-metrics-text-change')[0]).toHaveTextContent('-');
    });
  });

  it('shows correct change notation for positive change', async () => {
    const data = initializeData();

    render(
      <MetricsTable
        isLoading={false}
        location={data.location}
        trendFunction={TrendFunctionField.P50}
        transaction={transaction}
        trendView={data.eventView}
        organization={data.organization}
      />
    );

    await waitForMockCall(eventsMockBefore);

    await waitFor(() => {
      expect(screen.getAllByTestId('pce-metrics-text-before')[1]).toHaveTextContent(
        '78.3 ms'
      );
      expect(screen.getAllByTestId('pce-metrics-text-after')[1]).toHaveTextContent(
        '110.5 ms'
      );
      expect(screen.getAllByTestId('pce-metrics-text-change')[1]).toHaveTextContent(
        '+41.2%'
      );
    });
  });

  it('shows correct change notation for negative change', async () => {
    const data = initializeData();
    const negativeTransaction = {
      ...transaction,
      aggregate_range_1: 110.50465131578949,
      aggregate_range_2: 78.2757131147541,
      trend_percentage: 0.588263882645349,
    };

    render(
      <MetricsTable
        isLoading={false}
        location={data.location}
        trendFunction={TrendFunctionField.P50}
        transaction={negativeTransaction}
        trendView={data.eventView}
        organization={data.organization}
      />
    );

    await waitForMockCall(eventsMockBefore);

    await waitFor(() => {
      expect(screen.getAllByTestId('pce-metrics-text-after')[1]).toHaveTextContent(
        '78.3 ms'
      );
      expect(screen.getAllByTestId('pce-metrics-text-before')[1]).toHaveTextContent(
        '110.5 ms'
      );
      expect(screen.getAllByTestId('pce-metrics-text-change')[1]).toHaveTextContent(
        '-41.2%'
      );
    });
  });

  it('shows correct change notation for no results', async () => {
    const data = initializeData();

    const nullEventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'p95()': 1010.9232499999998,
            'p50()': 47.34580982348902,
            'count()': 345,
          },
        ],
        meta: {
          fields: {
            'p95()': 'duration',
            '950()': 'duration',
            'count()': 'number',
          },
          units: {
            'p95()': 'millisecond',
            'p50()': 'millisecond',
            'count()': null,
          },
          isMetricsData: true,
          tips: {},
          dataset: 'metrics',
        },
      },
    });

    render(
      <MetricsTable
        isLoading={false}
        location={data.location}
        trendFunction={TrendFunctionField.P50}
        transaction={transaction}
        trendView={data.eventView}
        organization={data.organization}
      />
    );

    await waitForMockCall(nullEventsMock);

    await waitFor(() => {
      expect(screen.getAllByTestId('pce-metrics-text-after')[0]).toHaveTextContent('-');
      expect(screen.getAllByTestId('pce-metrics-text-before')[0]).toHaveTextContent('-');
      expect(screen.getAllByTestId('pce-metrics-text-change')[0]).toHaveTextContent('-');
    });
  });

  it('returns correct null formatting for change column', () => {
    render(
      <React.Fragment>
        {renderBodyCell(COLUMNS.change, {
          metric: null,
          before: null,
          after: null,
          change: '0%',
        })}
        {renderBodyCell(COLUMNS.change, {
          metric: null,
          before: null,
          after: null,
          change: '+NaN%',
        })}
        {renderBodyCell(COLUMNS.change, {
          metric: null,
          before: null,
          after: null,
          change: '-',
        })}
      </React.Fragment>
    );

    expect(screen.getAllByTestId('pce-metrics-text-change')[0]).toHaveTextContent('-');
    expect(screen.getAllByTestId('pce-metrics-text-change')[1]).toHaveTextContent('-');
    expect(screen.getAllByTestId('pce-metrics-text-change')[2]).toHaveTextContent('-');
  });

  it('returns correct positive formatting for change column', () => {
    render(
      renderBodyCell(COLUMNS.change, {
        metric: null,
        before: null,
        after: null,
        change: '40.3%',
      })
    );

    expect(screen.getByText('+40.3%')).toBeInTheDocument();
  });

  it('renders spans list with no results', async () => {
    const data = initializeData();

    render(
      <SpansList
        location={data.location}
        organization={data.organization}
        trendView={data.eventView}
        breakpoint={transaction.breakpoint!}
        transaction={transaction}
        trendChangeType={TrendChangeType.REGRESSION}
      />
    );

    await waitForMockCall(spansMock);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('spans-no-results')).toBeInTheDocument();
    });
  });

  it('renders spans list with error message', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-spans-performance/',
      statusCode: 504,
    });
    const data = initializeData();

    render(
      <SpansList
        location={data.location}
        organization={data.organization}
        trendView={data.eventView}
        breakpoint={transaction.breakpoint!}
        transaction={transaction}
        trendChangeType={TrendChangeType.REGRESSION}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
    });
  });

  it('renders spans list with no changes message', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-spans-performance/',
      body: spanResults,
    });
    const data = initializeData();

    render(
      <SpansList
        location={data.location}
        organization={data.organization}
        trendView={data.eventView}
        breakpoint={transaction.breakpoint!}
        transaction={transaction}
        trendChangeType={TrendChangeType.REGRESSION}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('spans-no-changes')).toBeInTheDocument();
    });
  });
});
