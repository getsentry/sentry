import type {ReactNode} from 'react';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

jest.mock('sentry/components/pageFilters/usePageFilters');

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

describe('useExploreTimeseries', () => {
  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    jest.clearAllMocks();
  });

  it('triggers the high accuracy request when there is no data and a partial scan', async () => {
    const mockTimeSeries = TimeSeriesFixture();

    const mockNormalRequestUrl = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            ...mockTimeSeries,
            yAxis: 'count(span.duration)',
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
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY;
        },
      ],
      method: 'GET',
    });
    renderHookWithProviders(
      () =>
        useExploreTimeseries({
          query: 'test value',
          enabled: true,
        }),
      {
        additionalWrapper: Wrapper,
      }
    );

    expect(mockNormalRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockNormalRequestUrl).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: SAMPLING_MODE.NORMAL,
          query: 'test value',
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
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
          query: 'test value',
        }),
      })
    );
  });

  it('disables extrapolation', async () => {
    const mockNonExtrapolatedRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      match: [
        function (_url: string, options: Record<string, any>) {
          return (
            options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY &&
            options.query.disableAggregateExtrapolation === '1'
          );
        },
      ],
      method: 'GET',
    });

    renderHookWithProviders(
      () =>
        useExploreTimeseries({
          query: 'test value',
          enabled: true,
        }),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              extrapolate: '0',
            },
          },
        },
      }
    );

    await waitFor(() => expect(mockNonExtrapolatedRequest).toHaveBeenCalledTimes(1));
    expect(mockNonExtrapolatedRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
          disableAggregateExtrapolation: '1',
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
          query: 'test value',
        }),
      })
    );
  });

  it('requests all yAxes when a visualize has multiple aggregates', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            ...TimeSeriesFixture(),
            yAxis: 'avg(span.duration)',
            meta: {
              ...TimeSeriesFixture().meta,
              dataScanned: 'full',
            },
          },
        ],
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return (
            Array.isArray(options.query.yAxis) &&
            options.query.yAxis.includes('avg(span.duration)') &&
            options.query.yAxis.includes('p95(span.duration)') &&
            options.query.yAxis.includes('count(span.duration)')
          );
        },
      ],
    });

    renderHookWithProviders(useExploreTimeseries, {
      additionalWrapper: Wrapper,
      initialProps: {
        query: 'test value',
        enabled: true,
      },
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
          query: {
            visualize: '{"yAxes":["avg(span.duration)","p95(span.duration)"]}',
          },
        },
      },
    });

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
  });

  it('triggers high accuracy for multi-yAxis visualizes with no data and partial scan', async () => {
    const mockTimeSeries = TimeSeriesFixture();
    const mockNormalRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            ...mockTimeSeries,
            yAxis: 'avg(span.duration)',
            values: [{...mockTimeSeries.values[0]!, value: 0}],
            meta: {...mockTimeSeries.meta, dataScanned: 'partial'},
          },
          {
            ...mockTimeSeries,
            yAxis: 'p95(span.duration)',
            values: [{...mockTimeSeries.values[0]!, value: 0}],
            meta: {...mockTimeSeries.meta, dataScanned: 'partial'},
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
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY;
        },
      ],
    });

    renderHookWithProviders(useExploreTimeseries, {
      additionalWrapper: Wrapper,
      initialProps: {
        query: 'test value',
        enabled: true,
      },
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
          query: {
            visualize: '{"yAxes":["avg(span.duration)","p95(span.duration)"]}',
          },
        },
      },
    });

    expect(mockNormalRequest).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockHighAccuracyRequest).toHaveBeenCalledTimes(1);
    });
  });
});
