import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

describe('useExploreTimeseries', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    jest.clearAllMocks();
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it.each([true, false])(
    'keeps validated, sorted query pairs aligned with transformations enabled=%s',
    async featureEnabled => {
      const invalidAxis = 'count_if(`p95(span.duration):>100`,span.duration)';
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {timeSeries: []},
      });

      renderHookWithProviders(
        () => useExploreTimeseries({query: 'span.op:pageload', enabled: true}),
        {
          organization: OrganizationFixture({
            features: featureEnabled ? ['explore-interpolation-and-smoothing'] : [],
          }),
          additionalWrapper: Wrapper,
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/explore/traces/',
              query: {
                aggregateField: [
                  {groupBy: 'service.name'},
                  {yAxes: ['p95(span.duration)'], transformations: ['smooth(asap)']},
                  {yAxes: [invalidAxis], transformations: ['fill(linear)']},
                  {yAxes: ['avg(span.duration)']},
                  {yAxes: ['count(span.duration)'], transformations: ['fill(locf)']},
                  {yAxes: ['count(span.duration)'], transformations: ['smooth(sma,5)']},
                  {yAxes: ['count(span.duration)'], transformations: ['fill(locf)']},
                ].map(field => JSON.stringify(field)),
                aggregateSort: [`-${invalidAxis}`],
              },
            },
          },
        }
      );

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
      const query = request.mock.calls[0]![1].query;
      expect(query.yAxis).toEqual(
        featureEnabled
          ? [
              'avg(span.duration)',
              'count(span.duration)',
              'count(span.duration)',
              'count(span.duration)',
              'p95(span.duration)',
            ]
          : ['avg(span.duration)', 'count(span.duration)', 'p95(span.duration)']
      );
      expect(
        Object.fromEntries(
          Object.entries(query).filter(([key]) => key.startsWith('transformations'))
        )
      ).toEqual(
        featureEnabled
          ? {
              'transformations[1]': ['fill(locf)'],
              'transformations[2]': ['smooth(sma,5)'],
              'transformations[4]': ['smooth(asap)'],
            }
          : {}
      );
      expect(query.groupBy).toEqual(['service.name']);
      expect(query.sort).toBe('-p95_span_duration');
      expect(query.query).toBe('span.op:pageload');
    }
  );

  it.each([0, 4])(
    'uses the selected pipeline for progressive sampling with %s samples',
    async sampleCount => {
      const normalRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        match: [MockApiClient.matchQuery({sampling: SAMPLING_MODE.NORMAL})],
        body: {
          timeSeries: [
            TimeSeriesFixture({
              yAxis: 'count(span.duration)',
              meta: {
                valueType: 'integer',
                valueUnit: null,
                interval: 1_800_000,
                dataScanned: 'partial',
              },
              values: [{timestamp: 1729796400000, value: 14, sampleCount}],
            }),
            TimeSeriesFixture({
              yAxis: 'count(span.duration)',
              meta: {
                valueType: 'integer',
                valueUnit: null,
                interval: 1_800_000,
                dataScanned: 'full',
              },
              values: [{timestamp: 1729796400000, value: 97, sampleCount: 97}],
            }),
          ],
        },
      });
      const highAccuracyRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        match: [MockApiClient.matchQuery({sampling: SAMPLING_MODE.HIGH_ACCURACY})],
        body: {
          timeSeries: [
            TimeSeriesFixture({
              yAxis: 'count(span.duration)',
              meta: {
                valueType: 'integer',
                valueUnit: null,
                interval: 1_800_000,
                dataScanned: 'full',
              },
              values: [{timestamp: 1729796400000, value: 71, sampleCount: 9}],
            }),
            TimeSeriesFixture({
              yAxis: 'count(span.duration)',
              values: [{timestamp: 1729796400000, value: 97, sampleCount: 97}],
            }),
          ],
        },
      });
      const {result} = renderHookWithProviders(
        () => useExploreTimeseries({query: '', enabled: true}),
        {
          organization: OrganizationFixture({
            features: ['explore-interpolation-and-smoothing'],
          }),
          additionalWrapper: Wrapper,
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/explore/traces/',
              query: {
                aggregateField: [
                  JSON.stringify({
                    yAxes: ['count(span.duration)'],
                    transformations: ['fill(locf)'],
                  }),
                ],
              },
            },
          },
        }
      );

      await waitFor(() => {
        expect(
          result.current.result.data['count(span.duration)']?.map(s => s.values[0]?.value)
        ).toEqual(sampleCount === 0 ? [71, 97] : [14, 97]);
      });
      expect(result.current.samplingMode).toBe(
        sampleCount === 0 ? SAMPLING_MODE.HIGH_ACCURACY : SAMPLING_MODE.NORMAL
      );
      expect(highAccuracyRequest).toHaveBeenCalledTimes(sampleCount === 0 ? 1 : 0);
      for (const request of sampleCount === 0
        ? [normalRequest, highAccuracyRequest]
        : [normalRequest]) {
        expect(request).toHaveBeenCalledWith(
          '/organizations/org-slug/events-timeseries/',
          expect.objectContaining({
            query: expect.objectContaining({
              yAxis: ['count(span.duration)', 'count(span.duration)'],
              'transformations[0]': ['fill(locf)'],
            }),
          })
        );
      }
    }
  );

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

  it('forwards a bracketed list with whitespace between items unchanged', async () => {
    // The grammar allows `key:[a, b]`, but re-serializing through the legacy
    // token splitter used to break the list on the space and quote each half,
    // so the chart queried for something the table never filtered on.
    const query =
      'span.op:pageload sentry.segment.name:["/issues/", "/issues/:groupId/"]';

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      method: 'GET',
    });

    renderHookWithProviders(() => useExploreTimeseries({query, enabled: true}), {
      additionalWrapper: Wrapper,
    });

    await waitFor(() => expect(mockRequest).toHaveBeenCalled());
    expect(mockRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({query}),
      })
    );
  });

  it('does not query when the only series has an invalid conditional filter', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
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
              aggregateField: [
                JSON.stringify({groupBy: ''}),
                JSON.stringify({
                  yAxes: ['count_if(`p95(span.duration):>100`,span.duration)'],
                }),
              ],
            },
          },
        },
      }
    );

    expect(mockRequest).not.toHaveBeenCalled();
  });
});
