import {LocationFixture} from 'sentry-fixture/locationFixture';
import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiResult} from 'sentry/api';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import type {InfiniteData} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {
  EventsLogsResult,
  OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  isRowVisibleInVirtualStream,
  updateVirtualStreamingTimestamp,
  useVirtualStreaming,
} from 'sentry/views/explore/logs/useVirtualStreaming';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockUseLocation = jest.mocked(useLocation);

describe('useVirtualStreaming', () => {
  let requestAnimationFrameSpy: jest.SpyInstance<number, [FrameRequestCallback]>;
  let cancelAnimationFrameSpy: jest.SpyInstance<void, [number]>;
  const organization = OrganizationFixture();
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

    requestAnimationFrameSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((_callback: FrameRequestCallback): number => {
        return 1;
      });
    cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame');
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  const createWrapper = ({autoRefresh}: {autoRefresh?: boolean}) => {
    const testContext = autoRefresh ? {autoRefresh} : undefined;
    return function ({children}: {children: React.ReactNode}) {
      return (
        <OrganizationContext.Provider value={organization}>
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

  it('should initialize virtual timestamp to the latest timestamp before the ingest delay', async () => {
    const now = Date.now();
    const mockData = createMockData([
      // Data should be sorted by timestamp, so the first one should be the latest
      LogFixture({
        [OurLogKnownFieldKey.ID]: '4',
        // 42 seconds ago in nanoseconds
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: String(BigInt(now - 42000) * 1_000_000n),
      }),
      LogFixture({
        [OurLogKnownFieldKey.ID]: '3',
        // 45 seconds ago in nanoseconds
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: String(BigInt(now - 44000) * 1_000_000n),
      }),
      LogFixture({
        [OurLogKnownFieldKey.ID]: '2',
        // 50 seconds ago in nanoseconds
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: String(BigInt(now - 46000) * 1_000_000n),
      }),
      LogFixture({
        [OurLogKnownFieldKey.ID]: '1',
        // 55 seconds ago in nanoseconds
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: String(BigInt(now - 55000) * 1_000_000n),
      }),
    ]);

    const {result} = renderHook(() => useVirtualStreaming(mockData), {
      wrapper: createWrapper({autoRefresh: true}),
    });

    await waitFor(() => {
      expect(result.current.virtualStreamedTimestamp).toBeDefined();
    });

    // With MAX_LOG_INGEST_DELAY of 40 seconds and default refresh interval of 5 seconds,
    // The target timestamp would be now - 40000 - 5000 = now - 45000.
    // Since there is no row exactly at 45000, it should select the first row before that (46 seconds ago).
    expect(result.current.virtualStreamedTimestamp).toBe(now - 46000);
  });

  it('should not initialize when auto refresh is disabled', () => {
    const mockData = createMockData([
      LogFixture({
        [OurLogKnownFieldKey.ID]: '1',
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1000000000000000000',
      }),
    ]);

    const {result} = renderHook(() => useVirtualStreaming(mockData), {
      wrapper: createWrapper({autoRefresh: false}),
    });

    expect(result.current.virtualStreamedTimestamp).toBeUndefined();
  });

  it('should start RAF when auto refresh is enabled', async () => {
    const mockData = createMockData([
      LogFixture({
        [OurLogKnownFieldKey.ID]: '1',
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1000000000000000000',
      }),
    ]);

    renderHook(() => useVirtualStreaming(mockData), {
      wrapper: createWrapper({autoRefresh: true}),
    });

    await waitFor(() => {
      expect(requestAnimationFrameSpy).toHaveBeenCalled();
    });
  });

  it('should stop RAF when auto refresh is disabled', async () => {
    mockUseLocation.mockReturnValue(
      LocationFixture({
        query: {
          live: 'true',
        },
      })
    );

    const mockData = createMockData([
      LogFixture({
        [OurLogKnownFieldKey.ID]: '1',
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '1000000000000000000',
      }),
    ]);

    const {rerender} = renderHook(() => useVirtualStreaming(mockData), {
      wrapper: createWrapper({}),
    });

    await waitFor(() => {
      expect(requestAnimationFrameSpy).toHaveBeenCalled();
    });

    // Change to disabled by updating location
    mockUseLocation.mockReturnValue(
      LocationFixture({
        query: {},
      })
    );
    rerender({});

    await waitFor(() => {
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    });
  });
});

describe('isRowVisibleInVirtualStream', () => {
  it('should filter based on the milliseconds of the passed timestamp', () => {
    const row = LogFixture({
      [OurLogKnownFieldKey.ID]: '1',
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: '2000000000',
    });

    const undefinedResult = isRowVisibleInVirtualStream(row, undefined);
    expect(undefinedResult).toBe(true);
    const lessThan2Seconds = isRowVisibleInVirtualStream(row, 2001);
    expect(lessThan2Seconds).toBe(true);
    const moreThan2Seconds = isRowVisibleInVirtualStream(row, 1999);
    expect(moreThan2Seconds).toBe(false);
  });
});

describe('updateVirtualStreamingTimestamp', () => {
  it('should catch up proportionally when significantly behind', () => {
    const currentTimestamp = 1000;
    const mostRecentPageDataTimestamp = 5000; // 4 seconds behind
    const targetVirtualTime = 6000;

    const result = updateVirtualStreamingTimestamp({
      currentTimestamp,
      mostRecentPageDataTimestamp,
      targetVirtualTime,
    });

    // timeBehind = 4000ms, which is > 2 * VIRTUAL_STREAMED_INTERVAL_MS (2 * 250 = 500)
    // Should use proportional catch-up
    // proportionalCatchUp = min(4000 * 0.1, 250 * 3) = min(400, 750) = 400
    // newTimestamp = 1000 + 400 = 1400
    expect(result).toBe(1400);
  });

  it('should use normal progression when not significantly behind', () => {
    const currentTimestamp = 1000;
    const mostRecentPageDataTimestamp = 1500; // Only 0.5 seconds behind
    const targetVirtualTime = 6000;

    const result = updateVirtualStreamingTimestamp({
      currentTimestamp,
      mostRecentPageDataTimestamp,
      targetVirtualTime,
    });

    // timeBehind = 500ms, which is exactly 2 * VIRTUAL_STREAMED_INTERVAL_MS (2 * 250 = 500)
    // Since timeBehind (500) is NOT > 500, it uses normal progression
    // newTimestamp = 1000 + 250 = 1250
    expect(result).toBe(1250);
  });

  it('should not exceed target virtual time', () => {
    const currentTimestamp = 5500;
    const mostRecentPageDataTimestamp = 6000;
    const targetVirtualTime = 5800; // Lower than what would normally be calculated

    const result = updateVirtualStreamingTimestamp({
      currentTimestamp,
      mostRecentPageDataTimestamp,
      targetVirtualTime,
    });

    // timeBehind = 500ms, which equals 2 * VIRTUAL_STREAMED_INTERVAL_MS
    // Since timeBehind (500) is NOT > 500, it uses normal progression
    // newTimestamp = 5500 + 250 = 5750, which is less than targetVirtualTime
    expect(result).toBe(5750);
  });

  it('should not change timestamp when ahead of target virtual time', () => {
    const currentTimestamp = 7000;
    const mostRecentPageDataTimestamp = 6000;
    const targetVirtualTime = 6000;

    const result = updateVirtualStreamingTimestamp({
      currentTimestamp,
      mostRecentPageDataTimestamp,
      targetVirtualTime,
    });

    // Should not change when ahead of target
    expect(result).toBe(7000);
  });
});

function createMockData(logFixtures: OurLogsResponseItem[]) {
  const mockData: InfiniteData<ApiResult<EventsLogsResult>> = {
    pages: [
      [
        {
          data: logFixtures,
          meta: {
            fields: {},
            units: {},
          },
        },
        '',
        {} as any,
      ],
    ],
    pageParams: [null],
  };
  return mockData;
}
