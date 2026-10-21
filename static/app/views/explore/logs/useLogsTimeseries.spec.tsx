import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {getTimeSeriesForQuery} from 'sentry/utils/timeSeries/getTimeSeriesForQuery';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useLogsTimeseries} from 'sentry/views/explore/logs/useLogsTimeseries';

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

afterEach(() => {
  PageFiltersStore.reset();
});

describe('useLogsTimeseries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  it.each([false, true])(
    'promotes partial empty results with transformations enabled %s',
    async transformationsEnabled => {
      const mockTimeSeries = TimeSeriesFixture();
      const pipelines = transformationsEnabled
        ? [['fill(zero)'], ['moving_average(3)'], []]
        : [[]];

      const mockNormalRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {
          timeSeries: pipelines.map(() => ({
            ...mockTimeSeries,
            yAxis: 'count(message)',
            values: [
              {
                ...mockTimeSeries.values[0]!,
                value: 0,
                sampleCount: 0,
              },
            ],
            meta: {
              ...mockTimeSeries.meta,
              dataScanned: 'partial',
            },
          })),
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
          timeSeries: pipelines.map((_, index) =>
            TimeSeriesFixture({
              yAxis: 'count(message)',
              values: [{timestamp: 1000, value: index + 10, sampleCount: index + 10}],
            })
          ),
        },
        method: 'GET',
        match: [
          function (_url: string, options: Record<string, any>) {
            return options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY;
          },
        ],
      });

      const {result} = renderHookWithProviders(
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
              routingHintsByRow: new Map(),
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
        {
          additionalWrapper: Wrapper,
          organization: OrganizationFixture({
            features: transformationsEnabled
              ? ['explore-interpolation-and-smoothing']
              : [],
          }),
          initialRouterConfig: {
            location: {
              pathname: '/',
              query: {
                aggregateField: [
                  {yAxes: ['count(message)'], transformations: ['fill(zero)']},
                  {yAxes: ['count(message)'], transformations: ['moving_average(3)']},
                ].map(field => JSON.stringify(field)),
              },
            },
          },
        }
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
      await waitFor(() => {
        expect(
          getTimeSeriesForQuery(result.current.data, 'count(message)', [
            'fill(zero)',
          ]).map(series => series.values[0]?.value)
        ).toEqual([10]);
      });
      expect(
        getTimeSeriesForQuery(result.current.data, 'count(message)', [
          'moving_average(3)',
        ]).map(series => series.values[0]?.value)
      ).toEqual(transformationsEnabled ? [11] : [10]);
      expect(
        getTimeSeriesForQuery(result.current.data, 'count(message)').map(
          series => series.values[0]?.value
        )
      ).toEqual(transformationsEnabled ? [12] : [10]);
      for (const request of [mockNormalRequest, mockHighAccuracyRequest]) {
        expect(request).toHaveBeenCalledWith(
          '/organizations/org-slug/events-timeseries/',
          expect.objectContaining({
            query: expect.objectContaining({
              yAxis: pipelines.map(() => 'count(message)'),
              ...(transformationsEnabled
                ? {
                    'transformations[0]': ['fill(zero)'],
                    'transformations[1]': ['moving_average(3)'],
                  }
                : {}),
            }),
          })
        );
      }
    }
  );
});
