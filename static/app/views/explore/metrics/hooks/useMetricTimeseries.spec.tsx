import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {MockMetricQueryParamsContext} from 'sentry/views/explore/metrics/hooks/testUtils';
import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

jest.mock('sentry/utils/usePageFilters');

function MockMetricQueryParamsContextWithMultiVisualize({
  children,
}: {
  children: ReactNode;
}) {
  const mockQueryParams = new ReadableQueryParams({
    extrapolate: true,
    mode: Mode.SAMPLES,
    query: '',
    cursor: '',
    fields: ['id', 'timestamp'],
    sortBys: [{field: 'timestamp', kind: 'desc'}],
    aggregateCursor: '',
    aggregateFields: [
      new VisualizeFunction('p50(value,test_metric,distribution,-)'),
      new VisualizeFunction('p75(value,test_metric,distribution,-)'),
      new VisualizeFunction('p99(value,test_metric,distribution,-)'),
    ],
    aggregateSortBys: [{field: 'p50(value,test_metric,distribution,-)', kind: 'desc'}],
  });

  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsQueryParamsProvider
        traceMetric={{name: 'test_metric', type: 'distribution'}}
        queryParams={mockQueryParams}
        setQueryParams={() => {}}
        setTraceMetric={() => {}}
        removeMetric={() => {}}
      >
        {children}
      </MetricsQueryParamsProvider>
    </MultiMetricsQueryParamsProvider>
  );
}

describe('useMetricTimeseries', () => {
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
            yAxis: 'per_second(value)',
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

    renderHookWithProviders(useMetricTimeseries, {
      initialProps: {
        traceMetric: {name: 'test metric', type: 'counter'},
        enabled: true,
      },
      additionalWrapper: MockMetricQueryParamsContext,
    });

    expect(mockNormalRequestUrl).toHaveBeenCalledTimes(1);
    expect(mockNormalRequestUrl).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({
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
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
        }),
      })
    );
  });

  describe('with tracemetrics-overlay-charts-ui feature', () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-overlay-charts-ui'],
    });

    beforeEach(() => {
      jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
      jest.clearAllMocks();
    });

    it('requests multiple yAxis values from the API', async () => {
      const mockTimeSeries1 = TimeSeriesFixture();
      const mockTimeSeries2 = TimeSeriesFixture();
      const mockTimeSeries3 = TimeSeriesFixture();

      const mockRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {
          timeSeries: [
            {
              ...mockTimeSeries1,
              yAxis: 'p50(value,test_metric,distribution,-)',
            },
            {
              ...mockTimeSeries2,
              yAxis: 'p75(value,test_metric,distribution,-)',
            },
            {
              ...mockTimeSeries3,
              yAxis: 'p99(value,test_metric,distribution,-)',
            },
          ],
        },
        method: 'GET',
      });

      renderHookWithProviders(useMetricTimeseries, {
        initialProps: {
          traceMetric: {name: 'test_metric', type: 'distribution'},
          enabled: true,
        },
        additionalWrapper: MockMetricQueryParamsContextWithMultiVisualize,
        organization,
      });

      await waitFor(() => {
        expect(mockRequest).toHaveBeenCalledTimes(1);
      });

      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: [
              'p50(value,test_metric,distribution,-)',
              'p75(value,test_metric,distribution,-)',
              'p99(value,test_metric,distribution,-)',
            ],
          }),
        })
      );
    });

    it('triggers high accuracy for all visualizes', async () => {
      const mockTimeSeries = TimeSeriesFixture();

      const mockNormalRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {
          timeSeries: [
            {
              ...mockTimeSeries,
              yAxis: 'p50(value,test_metric,distribution,-)',
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
            {
              ...mockTimeSeries,
              yAxis: 'p75(value,test_metric,distribution,-)',
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
            {
              ...mockTimeSeries,
              yAxis: 'p99(value,test_metric,distribution,-)',
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

      renderHookWithProviders(useMetricTimeseries, {
        initialProps: {
          traceMetric: {name: 'test_metric', type: 'distribution'},
          enabled: true,
        },
        additionalWrapper: MockMetricQueryParamsContextWithMultiVisualize,
        organization,
      });

      expect(mockNormalRequest).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(mockHighAccuracyRequest).toHaveBeenCalledTimes(1);
      });

      expect(mockHighAccuracyRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            sampling: SAMPLING_MODE.HIGH_ACCURACY,
            yAxis: [
              'p50(value,test_metric,distribution,-)',
              'p75(value,test_metric,distribution,-)',
              'p99(value,test_metric,distribution,-)',
            ],
          }),
        })
      );
    });
  });
});
