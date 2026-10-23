import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useMultiQueryTimeseries} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTimeseries';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('useMultiQueryTimeseries', () => {
  let mockNormalRequestUrl: jest.Mock;

  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    jest.clearAllMocks();
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('triggers the high accuracy request when there is no data and a partial scan', async () => {
    const mockTimeSeries = TimeSeriesFixture();

    mockNormalRequestUrl = MockApiClient.addMockResponse({
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
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY;
        },
      ],
      method: 'GET',
    });
    renderHookWithProviders(() => useMultiQueryTimeseries({enabled: true, index: 0}), {
      initialRouterConfig: {
        location: {
          pathname: '/traces/compare/',
          query: {
            queries: JSON.stringify({
              query: 'test value',
              groupBys: [],
              sortBys: [],
              yAxes: ['count(message)'],
              chartType: ChartType.LINE,
            }),
          },
        },
      },
    });

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

  it.each([true, false])(
    'forwards the indexed row pipeline to every axis only when enabled=%s',
    async enabled => {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {
          timeSeries: [
            TimeSeriesFixture({yAxis: 'avg(span.duration)'}),
            TimeSeriesFixture({yAxis: 'count(span.duration)'}),
          ],
        },
      });
      const {result} = renderHookWithProviders(
        () => useMultiQueryTimeseries({enabled: true, index: 1}),
        {
          organization: OrganizationFixture({
            features: enabled ? ['explore-interpolation-and-smoothing'] : [],
          }),
          initialRouterConfig: {
            location: {
              pathname: '/traces/compare/',
              query: {
                queries: [
                  JSON.stringify({
                    yAxes: ['count(span.duration)'],
                    transformations: ['fill(zero)'],
                  }),
                  JSON.stringify({
                    yAxes: ['avg(span.duration)', 'count(span.duration)'],
                    transformations: ['fill(locf)', 'smooth(sma,5)'],
                  }),
                ],
              },
            },
          },
        }
      );

      await waitFor(() => expect(result.current.result.isSuccess).toBe(true));
      expect(request).toHaveBeenCalledWith(
        '/organizations/org-slug/events-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: ['avg(span.duration)', 'count(span.duration)'],
            ...(enabled
              ? {
                  'transformations[0]': ['fill(locf)', 'smooth(sma,5)'],
                  'transformations[1]': ['fill(locf)', 'smooth(sma,5)'],
                }
              : {}),
          }),
        })
      );
      if (!enabled) {
        expect(request.mock.calls[0][1].query).not.toHaveProperty('transformations[0]');
        expect(request.mock.calls[0][1].query).not.toHaveProperty('transformations[1]');
      }
      expect(result.current.result.data['avg(span.duration)']?.[0]).toEqual(
        expect.objectContaining({
          yAxis: 'avg(span.duration)',
          ...(enabled ? {requestedTransformations: ['fill(locf)', 'smooth(sma,5)']} : {}),
        })
      );
    }
  );
});
