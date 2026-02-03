import type {ReactNode} from 'react';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useLogsTimeseries} from 'sentry/views/explore/logs/useLogsTimeseries';

jest.mock('sentry/utils/usePageFilters');

function Wrapper({children}: {children: ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      source="location"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

describe('useLogsTimeseries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
  });

  it('triggers the high accuracy request when there is no data and a partial scan', async () => {
    const mockTimeSeries = TimeSeriesFixture();

    const mockNormalRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            ...mockTimeSeries,
            yAxis: 'count(message)',
            values: [
              {
                ...mockTimeSeries.values[0]!,
                value: 0,
              },
            ],
            meta: {
              ...mockTimeSeries.meta,
              dataScanned: 'partial',
            },
          },
        ],
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.NORMAL;
        },
      ],
    });

    const mockHighAccuracyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [TimeSeriesFixture()],
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY;
        },
      ],
    });

    renderHookWithProviders(
      () =>
        useLogsTimeseries({
          enabled: true,
          timeseriesIngestDelay: 0n,
          tableData: {
            error: null,
            isError: false,
            isFetching: false,
            isPending: false,
            data: [],
            meta: {
              fields: {},
              units: {},
            },
            isRefetching: false,
            isEmpty: true,
            fetchNextPage: () => Promise.resolve({} as any),
            fetchPreviousPage: () => Promise.resolve({} as any),
            refetch: () => Promise.resolve({} as any),
            hasNextPage: false,
            queryKey: [] as any,
            hasPreviousPage: false,
            isFetchingNextPage: false,
            isFetchingPreviousPage: false,
            lastPageLength: 0,
            bytesScanned: 0,
            dataScanned: undefined,
            canResumeAutoFetch: false,
            resumeAutoFetch: () => {},
          },
        }),
      {additionalWrapper: Wrapper}
    );

    expect(mockNormalRequest).toHaveBeenCalledTimes(1);
    expect(mockNormalRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'ourlogs',
          sampling: SAMPLING_MODE.NORMAL,
        }),
      })
    );

    await waitFor(() => {
      expect(mockHighAccuracyRequest).toHaveBeenCalledTimes(1);
    });
    expect(mockHighAccuracyRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'ourlogs',
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
        }),
      })
    );
  });
});
