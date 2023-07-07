import React from 'react';
import moment from 'moment';

import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {PerformanceChangeExplorer} from 'sentry/views/performance/trends/changeExplorer';
import {
  COLUMNS,
  MetricsTable,
  renderBodyCell,
} from 'sentry/views/performance/trends/changeExplorerUtils/metricsTable';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendFunctionField,
} from 'sentry/views/performance/trends/types';
import {TRENDS_PARAMETERS} from 'sentry/views/performance/trends/utils';

async function waitForMockCall(mock: any) {
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

describe('Performance > Trends > Performance Change Explorer', function () {
  let eventsMockBefore;
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
          },
        ],
        meta: {
          fields: {
            'p95()': 'duration',
            '950()': 'duration',
            'tps()': 'number',
            'count()': 'number',
          },
          units: {
            'p95()': 'millisecond',
            'p50()': 'millisecond',
            'tps()': null,
            'count()': null,
          },
          isMetricsData: true,
          tips: {},
          dataset: 'metrics',
        },
      },
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
        selectedTransaction={transaction.transaction}
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

    await waitFor(() => {
      expect(screen.getByTestId('pce-header')).toBeInTheDocument();
      expect(screen.getByTestId('pce-graph')).toBeInTheDocument();
      expect(screen.getByTestId('grid-editable')).toBeInTheDocument();
      expect(screen.getAllByTestId('pce-metrics-chart-row-metric')).toHaveLength(4);
      expect(screen.getAllByTestId('pce-metrics-chart-row-before')).toHaveLength(4);
      expect(screen.getAllByTestId('pce-metrics-chart-row-after')).toHaveLength(4);
      expect(screen.getAllByTestId('pce-metrics-chart-row-change')).toHaveLength(4);
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
});
