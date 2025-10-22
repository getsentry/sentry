import type {ReactNode} from 'react';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import usePageFilters from 'sentry/utils/usePageFilters';
import {PageParamsProvider} from 'sentry/views/explore/contexts/pageParamsContext';
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
      <PageParamsProvider>{children}</PageParamsProvider>
    </LogsQueryParamsProvider>
  );
}

describe('useLogsTimeseries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
  });

  it('triggers the high accuracy request when there is no data and a partial scan', async () => {
    const mockNormalRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [[1745371800, [{count: 0}]]],
        meta: {
          dataScanned: 'partial',
          accuracy: {
            confidence: [],
            sampleCount: [],
            samplingRate: [],
          },
          fields: {},
        },
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.NORMAL;
        },
      ],
    });

    const mockHighAccuracyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [[1745371800, [{count: 0}]]],
        meta: {
          dataScanned: 'partial',
          accuracy: {
            confidence: [],
            sampleCount: [],
            samplingRate: [],
          },
          fields: {},
        },
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
          },
        }),
      {additionalWrapper: Wrapper}
    );

    expect(mockNormalRequest).toHaveBeenCalledTimes(1);
    expect(mockNormalRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
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
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'ourlogs',
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
        }),
      })
    );
  });
});
