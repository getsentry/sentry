import {LogFixture} from 'sentry-fixture/log';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useStreamingTimeseriesResult} from 'sentry/views/explore/logs/useStreamingTimeseriesResult';

jest.mock('sentry/views/explore/contexts/logs/logsPageParams', () => ({
  useLogsAutoRefresh: jest.fn(),
}));

jest.mock('sentry/utils/usePrevious', () => jest.fn());

const mockUseLogsAutoRefresh =
  require('sentry/views/explore/contexts/logs/logsPageParams').useLogsAutoRefresh;
const mockUsePrevious = require('sentry/utils/usePrevious');

describe('useStreamingTimeseriesResult', () => {
  const mockTimeseriesResult = {
    data: {
      'count()': [
        TimeSeriesFixture({
          yAxis: 'count()',
          values: [
            {timestamp: 1000, value: 1},
            {timestamp: 2000, value: 2},
            {timestamp: 3000, value: 3},
          ],
        }),
      ],
    },
    isPending: false,
    isError: false,
    error: null,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLogsAutoRefresh.mockReturnValue(false);
    mockUsePrevious.mockReturnValue(undefined);
  });

  it("doesn't respond to changes in tabledata when autorefresh is disabled", async () => {
    mockUseLogsAutoRefresh.mockReturnValue(false);

    const initialTableData = {
      data: [
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '1500000',
          [OurLogKnownFieldKey.ID]: '1',
        }),
      ],
    } as any;

    const {result, rerender} = renderHook(
      ({tableData: currentTableData}) =>
        useStreamingTimeseriesResult(currentTableData, mockTimeseriesResult),
      {
        initialProps: {tableData: initialTableData},
      }
    );

    // Wait for initial render
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Should return the original timeseries result when autoRefresh is off
    expect(result.current.data).toBe(mockTimeseriesResult.data);
    expect(result.current.isPending).toBe(false);

    // Add more table data
    const updatedTableData = {
      data: [
        ...initialTableData.data,
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '2500000',
          [OurLogKnownFieldKey.ID]: '2',
        }),
      ],
    } as any;

    rerender({tableData: updatedTableData});

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Should still return the original timeseries result (no streaming effect)
    expect(result.current.data).toBe(mockTimeseriesResult.data);
    expect(result.current.isPending).toBe(false);
  });

  it('renders and uses table data when autorefresh is enabled', async () => {
    mockUseLogsAutoRefresh.mockReturnValue(true);

    const mockTableData = {
      data: [
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '1500000',
          [OurLogKnownFieldKey.ID]: '1',
        }),
      ],
    } as any;

    const {result} = renderHook(() =>
      useStreamingTimeseriesResult(mockTableData, mockTimeseriesResult)
    );

    // Wait for any effects to settle
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current.isPending).toBe(false);

    // When autoRefresh is enabled, the hook should return a new result object
    // (not the same reference as the original timeseriesResult)
    expect(result.current).not.toBe(mockTimeseriesResult);

    // The data structure should be preserved
    expect(result.current.data).toHaveProperty('count()');
    expect(Array.isArray(result.current.data?.['count()'])).toBe(true);

    // Should have the same number of series and values as the original
    expect(result.current.data?.['count()']?.length).toBe(
      mockTimeseriesResult.data['count()'].length
    );
    expect(result.current.data?.['count()']?.[0]?.values?.length).toBe(
      mockTimeseriesResult.data['count()'][0].values.length
    );
  });

  it('should handle constantly changing tableData without infinite loops', async () => {
    mockUseLogsAutoRefresh.mockReturnValue(true);

    let mockTableData = {
      data: [
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '1000000',
          [OurLogKnownFieldKey.ID]: '1',
        }),
      ],
    } as any;

    const {result, rerender} = renderHook(
      ({tableData: currentTableData}) =>
        useStreamingTimeseriesResult(currentTableData, mockTimeseriesResult),
      {
        initialProps: {tableData: mockTableData},
      }
    );

    // Wait for initial render
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Simulate streaming updates by adding more data
    for (let i = 2; i <= 5; i++) {
      mockTableData = {
        data: [
          ...mockTableData.data,
          LogFixture({
            [OurLogKnownFieldKey.TIMESTAMP]: `${i}000000`,
            [OurLogKnownFieldKey.ID]: `${i}`,
          }),
        ],
      } as any;

      rerender({tableData: mockTableData});

      // Each rerender should complete without infinite loops
      await waitFor(() => {
        expect(result.current).toBeDefined();
      });
    }

    expect(result.current.isPending).toBe(false);
  });

  it('should not re-process the same timeseries data reference repeatedly', async () => {
    mockUseLogsAutoRefresh.mockReturnValue(true);

    const mockTableData = {data: []} as any;

    const {result, rerender} = renderHook(() =>
      useStreamingTimeseriesResult(mockTableData, mockTimeseriesResult)
    );

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Rerender multiple times with the same timeseries data reference
    for (let i = 0; i < 5; i++) {
      rerender();

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });
    }

    expect(result.current.isPending).toBe(false);
  });

  it('should handle empty timeseries data gracefully', async () => {
    mockUseLogsAutoRefresh.mockReturnValue(true);

    const emptyTimeseriesResult = {
      data: null,
      isPending: false,
      isError: false,
      error: null,
    } as any;

    const mockTableData = {data: []} as any;

    const {result} = renderHook(() =>
      useStreamingTimeseriesResult(mockTableData, emptyTimeseriesResult)
    );

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // When autoRefresh is enabled and original data is empty,
    // the hook should create fake timeseries data for streaming
    expect(result.current.data).not.toBeNull();
    expect(result.current.data).toHaveProperty('count(message)');
    expect(Array.isArray(result.current.data?.['count(message)'])).toBe(true);
    expect(result.current.data?.['count(message)']?.[0]?.values?.length).toBeGreaterThan(
      0
    );
    expect(result.current.isPending).toBe(false);
  });

  it('should return null data when autoRefresh is disabled and timeseries data is empty', async () => {
    mockUseLogsAutoRefresh.mockReturnValue(false);

    const emptyTimeseriesResult = {
      data: null,
      isPending: false,
      isError: false,
      error: null,
    } as any;

    const mockTableData = {data: []} as any;

    const {result} = renderHook(() =>
      useStreamingTimeseriesResult(mockTableData, emptyTimeseriesResult)
    );

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // When autoRefresh is disabled, should return original (null) data
    expect(result.current.data).toBeNull();
    expect(result.current.isPending).toBe(false);
  });

  it('should reset buffer and state when autoRefresh is toggled off', async () => {
    let autoRefreshEnabled = true;
    mockUseLogsAutoRefresh.mockImplementation(() => autoRefreshEnabled);

    const mockTableData = {
      data: [
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '1500000',
          [OurLogKnownFieldKey.ID]: '1',
        }),
      ],
    } as any;

    const {result, rerender} = renderHook(() =>
      useStreamingTimeseriesResult(mockTableData, mockTimeseriesResult)
    );

    // Initially with autoRefresh enabled
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // Toggle autoRefresh off
    autoRefreshEnabled = false;
    rerender();

    await waitFor(() => {
      expect(result.current.data).toBe(mockTimeseriesResult.data);
    });

    expect(result.current.isPending).toBe(false);
  });

  it('should handle table data with no length changes efficiently', async () => {
    mockUseLogsAutoRefresh.mockReturnValue(true);

    const mockTableData = {
      data: [
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '1500000',
          [OurLogKnownFieldKey.ID]: '1',
        }),
      ],
    } as any;

    const {result, rerender} = renderHook(
      ({tableData: currentTableData}) =>
        useStreamingTimeseriesResult(currentTableData, mockTimeseriesResult),
      {
        initialProps: {tableData: mockTableData},
      }
    );

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Rerender with same data length (simulating ref change but no content change)
    const sameData = {
      data: [
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '1500000',
          [OurLogKnownFieldKey.ID]: '1',
        }),
      ],
    } as any;

    rerender({tableData: sameData});

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current.isPending).toBe(false);
  });

  it('should initialize buffer and process streaming data correctly', async () => {
    mockUseLogsAutoRefresh.mockReturnValue(true);

    // Start with initial table data
    const initialTableData = {
      data: [
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '1609459200', // 2021-01-01 00:00:00 UTC (in seconds)
          [OurLogKnownFieldKey.ID]: '1',
        }),
      ],
    } as any;

    const {result, rerender} = renderHook(
      ({tableData: currentTableData}) =>
        useStreamingTimeseriesResult(currentTableData, mockTimeseriesResult),
      {
        initialProps: {tableData: initialTableData},
      }
    );

    // Wait for initial buffer setup
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Should have initialized buffer data
    expect(result.current.data).toBeDefined();
    expect(result.current.data).not.toBe(mockTimeseriesResult.data);

    // Simulate streaming more data
    const streamingTableData = {
      data: [
        ...initialTableData.data,
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '1609459260', // 1 minute later
          [OurLogKnownFieldKey.ID]: '2',
        }),
        LogFixture({
          [OurLogKnownFieldKey.TIMESTAMP]: '1609459320', // 2 minutes later
          [OurLogKnownFieldKey.ID]: '3',
        }),
      ],
    } as any;

    rerender({tableData: streamingTableData});

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Buffer should be processing the new data
    expect(result.current.data).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });
});
