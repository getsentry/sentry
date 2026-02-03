import {LocationFixture} from 'sentry-fixture/locationFixture';
import {initializeLogsTest, LogFixture} from 'sentry-fixture/log';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  LOGS_AUTO_REFRESH_KEY,
  type AutoRefreshState,
} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {LOGS_GROUP_BY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {UseInfiniteLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
import {useStreamingTimeseriesResult} from 'sentry/views/explore/logs/useStreamingTimeseriesResult';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockUseLocation = jest.mocked(useLocation);
jest.mock('sentry/utils/useNavigate');
const mockUseNavigate = jest.mocked(useNavigate);

function preciseTimestampFromMillis(timestamp: number) {
  return String(BigInt(timestamp) * 1_000_000n);
}

describe('useStreamingTimeseriesResult', () => {
  const {
    organization: logsOrganization,
    project,
    setupPageFilters,
  } = initializeLogsTest({
    liveRefresh: true,
  });

  setupPageFilters();

  beforeEach(() => {
    jest.resetAllMocks();
    mockUseNavigate.mockReturnValue(jest.fn());
  });

  const createWrapper = ({
    autoRefresh = 'idle',
    groupBy,
    organization,
  }: {
    autoRefresh?: AutoRefreshState;
    groupBy?: string | string[];
    organization?: Organization;
  }) => {
    return function ({children}: {children: React.ReactNode}) {
      const query: Record<string, string | string[]> = {};
      if (autoRefresh) {
        query[LOGS_AUTO_REFRESH_KEY] = autoRefresh;
      }
      if (groupBy) {
        query[LOGS_GROUP_BY_KEY] = groupBy;
      }
      const mockLocation = LocationFixture({query});
      mockUseLocation.mockReturnValue(mockLocation);

      return (
        <OrganizationContext.Provider value={organization ?? logsOrganization}>
          <LogsQueryParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
            source="location"
          >
            {children}
          </LogsQueryParamsProvider>
        </OrganizationContext.Provider>
      );
    };
  };

  function createMockTableData(
    logFixtures: OurLogsResponseItem[]
  ): UseInfiniteLogsQueryResult {
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
      isRefetching: false,
      refetch: jest.fn(),
      queryKey: ['logs', 'infinite', 'infinite'],
      hasNextPage: false,
      hasPreviousPage: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      lastPageLength: logFixtures.length,
      bytesScanned: 0,
      dataScanned: undefined,
      canResumeAutoFetch: false,
      resumeAutoFetch: () => {},
    } as unknown as UseInfiniteLogsQueryResult;
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
        'avg(payload_size)': [
          {
            yAxis: 'avg(payload_size)',
            values: [
              {timestamp: 1000, value: 1000},
              {timestamp: 2000, value: 2000},
              {timestamp: 3000, value: 3000},
              {timestamp: 4000, value: 0},
              {timestamp: 5000, value: 0},
              {timestamp: 6000, value: 6000},
              {timestamp: 7000, value: 7000},
              {timestamp: 8000, value: 8000},
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

  const getMockMultiGroupTimeseries = () =>
    ({
      data: {
        'count(message)': [
          {
            yAxis: 'error',
            groupBy: [{key: 'severity', value: 'error'}],
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
            groupBy: [{key: 'severity', value: 'warn'}],
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
            groupBy: [{key: 'severity', value: 'info'}],
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

  const getMockMultiAxisGroupTimeseries = () =>
    ({
      data: {
        'count(message)': [
          {
            yAxis: 'error',
            groupBy: [{key: 'severity', value: 'error'}],
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
            groupBy: [{key: 'severity', value: 'warn'}],
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
            groupBy: [{key: 'severity', value: 'info'}],
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
        'avg(payload_size)': [
          {
            yAxis: 'error',
            groupBy: [{key: 'severity', value: 'error'}],
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
          {
            yAxis: 'warn',
            groupBy: [{key: 'severity', value: 'warn'}],
            values: [
              {timestamp: 1000, value: 1000},
              {timestamp: 2000, value: 2000},
              {timestamp: 3000, value: 3000},
              {timestamp: 4000, value: 0},
              {timestamp: 5000, value: 0},
              {timestamp: 6000, value: 6000},
              {timestamp: 7000, value: 7000},
              {timestamp: 8000, value: 8000},
            ],
            meta: {
              valueType: 'integer' as const,
              valueUnit: null,
              interval: 1000,
            },
          },
          {
            yAxis: 'info',
            groupBy: [{key: 'severity', value: 'info'}],
            values: [
              {timestamp: 1000, value: 10000},
              {timestamp: 2000, value: 20000},
              {timestamp: 3000, value: 30000},
              {timestamp: 4000, value: 0},
              {timestamp: 5000, value: 0},
              {timestamp: 6000, value: 60000},
              {timestamp: 7000, value: 70000},
              {timestamp: 8000, value: 80000},
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

  const getMockMultipleGroupByTimeseries = () =>
    ({
      data: {
        'count(message)': [
          {
            yAxis: 'error,frontend',
            groupBy: [
              {key: 'severity', value: 'error'},
              {key: 'component', value: 'frontend'},
            ],
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
            yAxis: 'warn,backend',
            groupBy: [
              {key: 'severity', value: 'warn'},
              {key: 'component', value: 'backend'},
            ],
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

  it('should return original timeseries when feature flag is enabled', () => {
    const mockTableData = createMockTableData([]);
    const mockTimeseriesData = getMockSingleAxisTimeseries();

    const {result} = renderHook(
      () => useStreamingTimeseriesResult(mockTableData, mockTimeseriesData, 0n),
      {
        wrapper: createWrapper({autoRefresh: 'enabled', organization: logsOrganization}),
      }
    );

    expect(result.current.data).toEqual(mockTimeseriesData.data);
  });

  it('should return original single axis timeseries when auto refresh is disabled', () => {
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

  it('should return original multi axis timeseries when auto refresh is disabled', () => {
    const mockTableData = createMockTableData([]);
    const mockTimeseriesData = getMockMultiAxisTimeseries();

    const {result} = renderHook(
      () => useStreamingTimeseriesResult(mockTableData, mockTimeseriesData, 0n),
      {
        wrapper: createWrapper({autoRefresh: 'idle'}),
      }
    );

    expect(result.current.data).toEqual(mockTimeseriesData.data);
  });

  it('should return original multi group timeseries when auto refresh is disabled', () => {
    const mockTableData = createMockTableData([]);
    const mockTimeseriesData = getMockMultiGroupTimeseries();

    const {result} = renderHook(
      () => useStreamingTimeseriesResult(mockTableData, mockTimeseriesData, 0n),
      {
        wrapper: createWrapper({autoRefresh: 'idle'}),
      }
    );

    expect(result.current.data).toEqual(mockTimeseriesData.data);
  });

  it('should return original multi axis group timeseries when auto refresh is disabled', () => {
    const mockTableData = createMockTableData([]);
    const mockTimeseriesData = getMockMultiAxisGroupTimeseries();

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
        (tableData: UseInfiniteLogsQueryResult) =>
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
          [OurLogKnownFieldKey.ID]: '1',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(9000),
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '2',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8200),
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '3',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8100),
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '4',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
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

  describe('multi group', () => {
    it('should create buckets from table data and merge with timeseries', async () => {
      const mockTimeseriesData = getMockMultiGroupTimeseries();

      const {result, rerender} = renderHook(
        (tableData: UseInfiniteLogsQueryResult) =>
          useStreamingTimeseriesResult(tableData, mockTimeseriesData, 0n),
        {
          initialProps: createMockTableData([]),
          wrapper: createWrapper({
            autoRefresh: 'enabled',
            groupBy: [OurLogKnownFieldKey.SEVERITY],
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
          [OurLogKnownFieldKey.ID]: '5',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(9000),
          [OurLogKnownFieldKey.SEVERITY]: 'brand_new_severity',
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '6',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8001),
          [OurLogKnownFieldKey.SEVERITY]: 'error',
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '7',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8001),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '8',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8000),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '9',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
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
            [OurLogKnownFieldKey.ID]: '10',
            [OurLogKnownFieldKey.PROJECT_ID]: project.id,
            [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
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
      const mockTimeseriesData = getMockMultiGroupTimeseries();
      const ingestDelayMs = 8500n * 1_000_000n; // Set delay to match last bucket timestamp

      const {result, rerender} = renderHook(
        (tableData: UseInfiniteLogsQueryResult) =>
          useStreamingTimeseriesResult(tableData, mockTimeseriesData, ingestDelayMs),
        {
          initialProps: createMockTableData([]),
          wrapper: createWrapper({
            autoRefresh: 'enabled',
            groupBy: [OurLogKnownFieldKey.SEVERITY],
          }),
        }
      );

      const initialValues = result.current.data['count(message)'];
      expect(initialValues).toHaveLength(3);

      const mockTableData = createMockTableData([
        LogFixture({
          [OurLogKnownFieldKey.ID]: '10',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(9000),
          [OurLogKnownFieldKey.SEVERITY]: 'error',
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '11',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8600),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '12',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8000),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '13',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(6500),
          [OurLogKnownFieldKey.SEVERITY]: 'info',
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '14',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
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

  describe('multiple group-by fields', () => {
    it('should handle multiple group-by fields correctly', async () => {
      const mockTimeseriesData = getMockMultipleGroupByTimeseries();

      const {result, rerender} = renderHook(
        (tableData: UseInfiniteLogsQueryResult) =>
          useStreamingTimeseriesResult(tableData, mockTimeseriesData, 0n),
        {
          initialProps: createMockTableData([]),
          wrapper: createWrapper({
            autoRefresh: 'enabled',
            groupBy: ['severity', 'component'],
          }),
        }
      );

      const initialValues = result.current.data['count(message)'];
      const flatMappedInitialValues = initialValues?.flatMap(d => [d.yAxis, d.values]);
      expect(flatMappedInitialValues).toEqual([
        'error,frontend',
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
        'warn,backend',
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
      ]);

      const mockTableData = createMockTableData([
        LogFixture({
          [OurLogKnownFieldKey.ID]: '1',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(9000),
          [OurLogKnownFieldKey.SEVERITY]: 'error',
          component: 'frontend',
        }),
        LogFixture({
          [OurLogKnownFieldKey.ID]: '2',
          [OurLogKnownFieldKey.PROJECT_ID]: project.id,
          [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(logsOrganization.id),
          [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: preciseTimestampFromMillis(8500),
          [OurLogKnownFieldKey.SEVERITY]: 'warn',
          component: 'backend',
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
        'error,frontend',
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
        'warn,backend',
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
      ]);
    });
  });
});
