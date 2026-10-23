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
    'gates transformations for every axis with enabled=%s',
    async enabled => {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {timeSeries: []},
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
      const query = request.mock.calls[0][1].query;
      expect(query.yAxis).toEqual(['avg(span.duration)', 'count(span.duration)']);
      expect([query['transformations[0]'], query['transformations[1]']]).toEqual(
        enabled
          ? [
              ['fill(locf)', 'smooth(sma,5)'],
              ['fill(locf)', 'smooth(sma,5)'],
            ]
          : [undefined, undefined]
      );
    }
  );
});
