import {LocationFixture} from 'sentry-fixture/locationFixture';
import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {Organization} from 'sentry/types/organization';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {type AutoRefreshState} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {
  UseInfiniteLogsQueryResult,
  UseLogsQueryResult,
} from 'sentry/views/explore/logs/useLogsQuery';
import {useStreamingTimeseriesResult} from 'sentry/views/explore/logs/useStreamingTimeseriesResult';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockUseLocation = jest.mocked(useLocation);

function preciseTimestampFromMillis(timestamp: number) {
  return String(BigInt(timestamp) * 1_000_000n);
}

describe('useStreamingTimeseriesResult', () => {
  const logsOrganization = OrganizationFixture({
    features: ['ourlogs-enabled', 'ourlogs-live-refresh'],
  });
  const project = ProjectFixture();

  beforeEach(() => {
    jest.resetAllMocks();
    mockUseLocation.mockReturnValue(LocationFixture());

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [parseInt(project.id, 10)],
        environments: [],
        datetime: {
          period: '14d',
          start: null,
          end: null,
          utc: null,
        },
      },
      new Set()
    );
  });

  const createWrapper = ({
    autoRefresh = 'idle',
    groupBy,
    organization,
  }: {
    autoRefresh?: AutoRefreshState;
    groupBy?: string;
    organization?: Organization;
  }) => {
    const testContext: Record<string, any> = {
      autoRefresh,
    };
    if (groupBy !== undefined) {
      testContext.groupBy = groupBy;
    }
    return function ({children}: {children: React.ReactNode}) {
      const mockLocation = LocationFixture({
        query: groupBy ? {groupBy} : {},
      });
      mockUseLocation.mockReturnValue(mockLocation);

      return (
        <OrganizationContext.Provider value={organization ?? logsOrganization}>
          <LogsPageParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
            _testContext={testContext}
          >
            {children}
          </LogsPageParamsProvider>
        </OrganizationContext.Provider>
      );
    };
  };

  function createMockTableData(
    logFixtures: OurLogsResponseItem[]
  ): UseInfiniteLogsQueryResult | UseLogsQueryResult {
    return {
      error: null,
      isError: false,
      isFetching: false,
      isPending: false,
      data: logFixtures,
      meta: {
        fields: {},
        units: {},
      },
      isEmpty: logFixtures.length === 0,
      fetchNextPage: jest.fn(),
      fetchPreviousPage: jest.fn(),
      hasNextPage: false,
      hasPreviousPage: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      lastPageLength: logFixtures.length,
    } as UseInfiniteLogsQueryResult;
  }

  const getMockSingleAxisTimeseries = () =>
    ({
      data: {
        'count(message)': [
          {
            yAxis: 'count(message)',
            values: [
              {timestamp: 1000, value: 10},
              {timestamp: 2000, value: 20},
              {timestamp: 3000, value: 30},
              {timestamp: 4000, value: 0},
              {timestamp: 5000, value: 0},
              {timestamp: 6000, value: 60},
              {timestamp: 7000, value: 70},
              {timestamp: 8000, value: 80},
            ],
            meta: {
              valueType: 'integer' as const,
              valueUnit: null,
              interval: 1000,
            },
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      meta: undefined,
      pageLinks: undefined,
      isLoading: false,
    }) as any;

  const getMockMultiAxisTimeseries = () =>
    ({
      data: {
        'count(message)': [
          {
            yAxis: 'error',
            values: [
              {timestamp: 1000, value: 1},
              {timestamp: 2000, value: 2},
              {timestamp: 3000, value: 3},
              {timestamp: 4000, value: 0},
              {timestamp: 5000, value: 0},
              {timestamp: 6000, value: 6},
              {timestamp: 7000, value: 7},
              {timestamp: 8000, value: 8},
            ],
            meta: {
              valueType: 'integer' as const,
              valueUnit: null,
              interval: 1000,
            },
          },
          {
            yAxis: 'warn',
            values: [
              {timestamp: 1000, value: 10},
              {timestamp: 2000, value: 20},
              {timestamp: 3000, value: 30},
              {timestamp: 4000, value: 0},
              {timestamp: 5000, value: 0},
              {timestamp: 6000, value: 60},
              {timestamp: 7000, value: 70},
              {timestamp: 8000, value: 80},
            ],
            meta: {
              valueType: 'integer' as const,
              valueUnit: null,
              interval: 1000,
            },
          },
          {
            yAxis: 'info',
            values: [
              {timestamp: 1000, value: 100},
              {timestamp: 2000, value: 200},
              {timestamp: 3000, value: 300},
              {timestamp: 4000, value: 0},
              {timestamp: 5000, value: 0},
              {timestamp: 6000, value: 600},
              {timestamp: 7000, value: 700},
              {timestamp: 8000, value: 800},
            ],
            meta: {
              valueType: 'integer' as const,
              valueUnit: null,
              interval: 1000,
            },
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      meta: undefined,
      pageLinks: undefined,
      isLoading: false,
    }) as any;

  it('should return original timeseries when feature flag is enabled', () => {
    const orgWithFeature = OrganizationFixture({
      features: ['ourlogs-enabled', 'ourlogs-live-refresh'],
    });

    const mockTableData = createMockTableData([]);
    const mockTimeseriesData = getMockSingleAxisTimeseries();

    const {result} = renderHook(
      () => useStreamingTimeseriesResult(mockTableData, mockTimeseriesData, 0n),
      {
        wrapper: createWrapper({autoRefresh: 'enabled', organization: orgWithFeature}),
      }
    );

    expect(result.current.data).toEqual(mockTimeseriesData.data);
  });

  it('should return original timeseries when auto refresh is disabled', () => {
    const mockTableData = createMockTableData([]);
    const mockTimeseriesData = getMockSingleAxisTimeseries();

    const {result} = renderHook(
      () => useStreamingTimeseriesResult(mockTableData, mockTimeseriesData, 0n),
      {
        wrapper: createWrapper({autoRefresh: 'idle'}),
      }
    );

    expect(result.current.data).toEqual(mockTimeseriesData.data);
  });

  describe('single axis', () => {
    it('should create buckets from table data and merge with timeseries', async () => {
      const mockTimeseriesData = getMockSingleAxisTimeseries();

      const {result, rerender} = renderHook(
        (tableData: UseInfiniteLogsQueryResult | UseLogsQueryResult) =>
          useStreamingTimeseriesResult(tableData, mockTimeseriesData, 0n),
        {
          initialProps: createMockTableData([]),
          wrapper: createWrapper({autoRefresh: 'enabled'}),
        }
      );

      const initialValues = result.current.data['count(message)']?.[0]?.values;
      expect(initialValues).toEqual([
        {timestamp: 1000, value: 10},
        {timestamp: 2000, value: 20},
        {timestamp: 3000, value: 30},
        {timestamp: 4000, value: 0},
        {timestamp: 5000, value: 0},
        {timestamp: 6000, value: 60},
        {timestamp: 7000, value: 70},
        {timestamp: 8000, value: 80},
      ]);

      const mockTableData = createMockTableData([
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(9000),
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8200),
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8100),
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8000),
        }),
      ]);

      rerender(mockTableData);

      await waitFor(() => {
        const mergedData = result.current.data['count(message)']?.[0]?.values;
        expect(mergedData).toBeDefined();
      });

      const mergedData = result.current.data['count(message)']?.[0]?.values;
      expect(result.current.data['count(message)']).toHaveLength(1);
      expect(mergedData).toEqual([
        {timestamp: 2000, value: 20},
        {timestamp: 3000, value: 30},
        {timestamp: 4000, value: 0},
        {timestamp: 5000, value: 0},
        {timestamp: 6000, value: 60},
        {timestamp: 7000, value: 70},
        {timestamp: 8000, value: 83},
        {timestamp: 9000, value: 1, incomplete: true},
      ]);
    });
  });

  describe('multi axis', () => {
    it('should create buckets from table data and merge with timeseries', async () => {
      const mockTimeseriesData = getMockMultiAxisTimeseries();

      const {result, rerender} = renderHook(
        (tableData: UseInfiniteLogsQueryResult | UseLogsQueryResult) =>
          useStreamingTimeseriesResult(tableData, mockTimeseriesData, 0n),
        {
          initialProps: createMockTableData([]),
          wrapper: createWrapper({
            autoRefresh: 'enabled',
            groupBy: OurLogKnownFieldKey.SEVERITY,
          }),
        }
      );

      const initialValues = result.current.data['count(message)'];
      const flatMappedInitialValues = initialValues?.flatMap(d => [d.yAxis, d.values]);
      expect(flatMappedInitialValues).toEqual([
        'error',
        [
          {timestamp: 1000, value: 1},
          {timestamp: 2000, value: 2},
          {timestamp: 3000, value: 3},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 6},
          {timestamp: 7000, value: 7},
          {timestamp: 8000, value: 8},
        ],
        'warn',
        [
          {timestamp: 1000, value: 10},
          {timestamp: 2000, value: 20},
          {timestamp: 3000, value: 30},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 60},
          {timestamp: 7000, value: 70},
          {timestamp: 8000, value: 80},
        ],
        'info',
        [
          {timestamp: 1000, value: 100},
          {timestamp: 2000, value: 200},
          {timestamp: 3000, value: 300},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 600},
          {timestamp: 7000, value: 700},
          {timestamp: 8000, value: 800},
        ],
      ]);

      const initialTableFixtures = [
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(9000),
          [OurLogKnownFieldKey.SEVERITY]: 'brand_new_severity',
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8001),
          [OurLogKnownFieldKey.SEVERITY]: 'error',
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8001),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8000),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(7000),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
        }),
      ];
      const mockTableData = createMockTableData(initialTableFixtures);

      rerender(mockTableData);

      await waitFor(() => {
        const mergedData = result.current.data['count(message)']?.[0]?.values;
        expect(mergedData).toBeDefined();
      });

      const flatMappedData = result.current.data['count(message)']?.flatMap(d => [
        d.yAxis,
        d.values,
      ]);

      expect(flatMappedData).toEqual([
        'error',
        [
          {timestamp: 2000, value: 2},
          {timestamp: 3000, value: 3},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 6},
          {timestamp: 7000, value: 7},
          {timestamp: 8000, value: 9},
          {timestamp: 9000, value: 0, incomplete: true},
        ],
        'warn',
        [
          {timestamp: 2000, value: 20},
          {timestamp: 3000, value: 30},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 60},
          {timestamp: 7000, value: 71},
          {timestamp: 8000, value: 82},
          {timestamp: 9000, value: 0, incomplete: true},
        ],
        'info',
        [
          {timestamp: 2000, value: 200},
          {timestamp: 3000, value: 300},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 600},
          {timestamp: 7000, value: 700},
          {timestamp: 8000, value: 800},
          {timestamp: 9000, value: 0, incomplete: true},
        ],
        'brand_new_severity',
        [
          {timestamp: 2000, value: 0},
          {timestamp: 3000, value: 0},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 0},
          {timestamp: 7000, value: 0},
          {timestamp: 8000, value: 0},
          {timestamp: 9000, value: 1, incomplete: true},
        ],
      ]);

      rerender(
        createMockTableData([
          LogFixture({
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(12000),
            [OurLogKnownFieldKey.SEVERITY]: 'yet_another_severity',
          }),
          ...initialTableFixtures,
        ])
      );

      await waitFor(() => {
        // Wait for last bucket to be added.
        const mergedData =
          result.current.data['count(message)']?.[0]?.values[
            result.current.data['count(message)']?.[0]?.values.length - 1
          ];
        expect(mergedData).toBeDefined();
      });

      const flatMappedData2 = result.current.data['count(message)']?.flatMap(d => [
        d.yAxis,
        d.values,
      ]);

      expect(flatMappedData2).toEqual([
        'error',
        [
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 6},
          {timestamp: 7000, value: 7},
          {timestamp: 8000, value: 9},
          {timestamp: 9000, value: 0},
          {timestamp: 10000, value: 0},
          {timestamp: 11000, value: 0},
          {timestamp: 12000, value: 0, incomplete: true},
        ],
        'warn',
        [
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 60},
          {timestamp: 7000, value: 71},
          {timestamp: 8000, value: 82},
          {timestamp: 9000, value: 0},
          {timestamp: 10000, value: 0},
          {timestamp: 11000, value: 0},
          {timestamp: 12000, value: 0, incomplete: true},
        ],
        'info',
        [
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 600},
          {timestamp: 7000, value: 700},
          {timestamp: 8000, value: 800},
          {timestamp: 9000, value: 0},
          {timestamp: 10000, value: 0},
          {timestamp: 11000, value: 0},
          {timestamp: 12000, value: 0, incomplete: true},
        ],
        'brand_new_severity',
        [
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 0},
          {timestamp: 7000, value: 0},
          {timestamp: 8000, value: 0},
          {timestamp: 9000, value: 1},
          {timestamp: 10000, value: 0},
          {timestamp: 11000, value: 0},
          {timestamp: 12000, value: 0, incomplete: true},
        ],
        'yet_another_severity',
        [
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 0},
          {timestamp: 7000, value: 0},
          {timestamp: 8000, value: 0},
          {timestamp: 9000, value: 0},
          {timestamp: 10000, value: 0},
          {timestamp: 11000, value: 0},
          {timestamp: 12000, value: 1, incomplete: true},
        ],
      ]);
    });

    it('should only update last bucket when ingest delay is at end of timeseries data', async () => {
      const mockTimeseriesData = getMockMultiAxisTimeseries();
      const ingestDelayMs = 8500n * 1_000_000n; // Set delay to match last bucket timestamp

      const {result, rerender} = renderHook(
        (tableData: UseInfiniteLogsQueryResult | UseLogsQueryResult) =>
          useStreamingTimeseriesResult(tableData, mockTimeseriesData, ingestDelayMs),
        {
          initialProps: createMockTableData([]),
          wrapper: createWrapper({
            autoRefresh: 'enabled',
            groupBy: OurLogKnownFieldKey.SEVERITY,
          }),
        }
      );

      const initialValues = result.current.data['count(message)'];
      expect(initialValues).toHaveLength(3);

      const mockTableData = createMockTableData([
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(9000),
          [OurLogKnownFieldKey.SEVERITY]: 'error',
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8600),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8000),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(6500),
          [OurLogKnownFieldKey.SEVERITY]: 'info',
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8500),
          [OurLogKnownFieldKey.SEVERITY]: 'error',
        }),
      ]);

      rerender(mockTableData);

      await waitFor(() => {
        const mergedData = result.current.data['count(message)']?.[0]?.values;
        expect(mergedData).toBeDefined();
      });

      const flatMappedData = result.current.data['count(message)']?.flatMap(d => [
        d.yAxis,
        d.values,
      ]);

      expect(flatMappedData).toEqual([
        'error',
        [
          {timestamp: 2000, value: 2},
          {timestamp: 3000, value: 3},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 6},
          {timestamp: 7000, value: 7},
          {timestamp: 8000, value: 8},
          {timestamp: 9000, value: 1, incomplete: true},
        ],
        'warn',
        [
          {timestamp: 2000, value: 20},
          {timestamp: 3000, value: 30},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 60},
          {timestamp: 7000, value: 70},
          {timestamp: 8000, value: 81},
          {timestamp: 9000, value: 0, incomplete: true},
        ],
        'info',
        [
          {timestamp: 2000, value: 200},
          {timestamp: 3000, value: 300},
          {timestamp: 4000, value: 0},
          {timestamp: 5000, value: 0},
          {timestamp: 6000, value: 600},
          {timestamp: 7000, value: 700},
          {timestamp: 8000, value: 800},
          {timestamp: 9000, value: 0, incomplete: true},
        ],
      ]);
    });
  });
});
