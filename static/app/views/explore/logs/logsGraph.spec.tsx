import type {EChartsOption} from 'echarts';
import {initializeLogsTest, LogFixture} from 'sentry-fixture/log';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {
  LogsPageDataProvider,
  useLogsPageDataQueryResult,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsGraph} from 'sentry/views/explore/logs/logsGraph';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useLogsTimeseries} from 'sentry/views/explore/logs/useLogsTimeseries';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const mockChartOptions = new Map<string, EChartsOption>();

jest.mock('echarts-for-react/lib/core', () => {
  const {useId} = jest.requireActual<typeof import('react')>('react');
  return function MockEcharts({option}: {option: EChartsOption}) {
    mockChartOptions.set(useId(), option);
    return null;
  };
});

function GraphHarness() {
  const tableData = useLogsPageDataQueryResult();
  const timeseriesResult = useLogsTimeseries({
    enabled: true,
    tableData,
    timeseriesIngestDelay: 0n,
  });
  return (
    <LogsGraph
      timeseriesResult={timeseriesResult}
      rawLogCounts={{
        normal: {count: 100, isLoading: false},
        total: {count: 100, isLoading: false},
      }}
    />
  );
}

describe('LogsGraph transformation identity', () => {
  const {organization, project, setupPageFilters, setupEventsMock} = initializeLogsTest({
    orgFeatures: ['explore-interpolation-and-smoothing'],
  });

  it('plots independent values for same-axis charts with different pipelines', async () => {
    setupPageFilters();
    setupEventsMock([
      LogFixture({
        id: 'log-1',
        [OurLogKnownFieldKey.PROJECT_ID]: project.id,
        [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      }),
    ]);
    mockChartOptions.clear();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [10, 20, 30].map(value =>
          TimeSeriesFixture({
            yAxis: 'count(message)',
            meta: {valueType: 'integer', valueUnit: null, interval: 1000},
            values: [{timestamp: 1000, value, sampleCount: value}],
          })
        ),
      },
    });

    render(
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <LogsPageDataProvider>
          <GraphHarness />
        </LogsPageDataProvider>
      </LogsQueryParamsProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {
              aggregateField: [['fill(zero)'], ['moving_average(3)']].map(
                transformations =>
                  JSON.stringify({
                    yAxes: ['count(message)'],
                    transformations,
                    chartType: ChartType.LINE,
                  })
              ),
            },
          },
        },
      }
    );

    await waitFor(() => {
      expect(Array.from(mockChartOptions.values(), option => option.series)).toEqual([
        [expect.objectContaining({data: [[1000, 10]]})],
        [expect.objectContaining({data: [[1000, 20]]})],
      ]);
    });
  });
});
