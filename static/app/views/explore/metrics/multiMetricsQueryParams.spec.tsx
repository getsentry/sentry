import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, screen} from 'sentry-test/reactTestingLibrary';

import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  MultiMetricsQueryParamsProvider,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
  useReorderMetricQueries,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

function TestableMetricComponent() {
  const metricQueries = useMultiMetricsQueryParams();

  return (
    <div>
      {metricQueries.map((metricQuery, index) => (
        <div key={index}>{metricQuery.label}</div>
      ))}
    </div>
  );
}

function Wrapper({children}: {children: ReactNode}) {
  return (
    <MultiMetricsQueryParamsProvider>
      <TestableMetricComponent />
      {children}
    </MultiMetricsQueryParamsProvider>
  );
}

describe('MultiMetricsQueryParamsProvider', () => {
  it('sets defaults', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
    });

    expect(result.current).toEqual([
      {
        label: 'A',
        metric: {name: '', type: ''},
        queryParams: new ReadableQueryParams({
          extrapolate: true,
          mode: Mode.SAMPLES,
          query: '',

          cursor: '',
          fields: ['id', 'timestamp'],
          sortBys: [{field: 'timestamp', kind: 'desc'}],

          aggregateCursor: '',
          aggregateFields: [new VisualizeFunction('sum(value)')],
          aggregateSortBys: [{field: 'sum(value)', kind: 'desc'}],
        }),
        removeMetric: expect.any(Function),
        setQueryParams: expect.any(Function),
        setTraceMetric: expect.any(Function),
      },
    ]);
  });

  it('updates to compatible aggregate when changing metrics', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
    });

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'counter'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'foo', type: 'counter'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('sum(value,foo,counter,none)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'bar', type: 'gauge'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'bar', type: 'gauge'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('avg(value,bar,gauge,none)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'qux', type: 'distribution'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'qux', type: 'distribution'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('avg(value,qux,distribution,none)')],
        }),
      }),
    ]);
  });

  it('updates incompatible aggregate when changing metrics', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
    });

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'counter'}));
    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [new VisualizeFunction('sum(value,foo,counter,none)')],
        })
      )
    );
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'foo', type: 'counter'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('sum(value,foo,counter,none)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'qux', type: 'gauge'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'qux', type: 'gauge'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('avg(value,qux,gauge,none)')],
        }),
      }),
    ]);

    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [new VisualizeFunction('last(value,qux,gauge,none)')],
        })
      )
    );
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'qux', type: 'gauge'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('last(value,qux,gauge,none)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'bar', type: 'distribution'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'bar', type: 'distribution'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('sum(value,bar,distribution,none)')],
        }),
      }),
    ]);

    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [new VisualizeFunction('p99(value,bar,distribution,none)')],
        })
      )
    );
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'bar', type: 'distribution'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('p99(value,bar,distribution,none)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'counter'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'foo', type: 'counter'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('sum(value,foo,counter,none)')],
        }),
      }),
    ]);
  });

  it('falls back from heat map when changing to a non-distribution metric', () => {
    const metricQuery = JSON.stringify({
      metric: {name: 'test_metric', type: 'distribution'},
      query: '',
      aggregateFields: [
        {
          yAxes: ['count(value,test_metric,distribution,none)'],
          chartType: ChartType.HEATMAP,
        },
      ],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {metric: [metricQuery]},
        },
      },
    });

    expect(result.current[0]!.queryParams.aggregateFields[0]).toEqual(
      expect.objectContaining({chartType: ChartType.HEATMAP})
    );

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'counter'}));

    // The counter can't be a heat map, so the chart type falls back.
    const counterVisualize = result.current[0]!.queryParams
      .aggregateFields[0] as VisualizeFunction;
    expect(counterVisualize.chartType).not.toBe(ChartType.HEATMAP);
  });

  it('parses multiple visualizes from URL params', () => {
    const metricQuery = JSON.stringify({
      metric: {name: 'test_metric', type: 'distribution'},
      query: '',
      aggregateFields: [
        {yAxes: ['p50(value,test_metric,distribution,none)']},
        {yAxes: ['p75(value,test_metric,distribution,none)']},
        {yAxes: ['p99(value,test_metric,distribution,none)']},
      ],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {
            metric: [metricQuery],
          },
        },
      },
    });

    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'test_metric', type: 'distribution'},
        queryParams: expect.objectContaining({
          aggregateFields: [
            new VisualizeFunction('p50(value,test_metric,distribution,none)'),
            new VisualizeFunction('p75(value,test_metric,distribution,none)'),
            new VisualizeFunction('p99(value,test_metric,distribution,none)'),
          ],
        }),
      }),
    ]);
  });

  it('sets multiple visualizes when changing aggregates', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
    });

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'distribution'}));
    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [
            new VisualizeFunction('p50(value,foo,distribution,none)'),
            new VisualizeFunction('p75(value,foo,distribution,none)'),
            new VisualizeFunction('p99(value,foo,distribution,none)'),
          ],
        })
      )
    );

    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'foo', type: 'distribution'},
        queryParams: expect.objectContaining({
          aggregateFields: [
            new VisualizeFunction('p50(value,foo,distribution,none)'),
            new VisualizeFunction('p75(value,foo,distribution,none)'),
            new VisualizeFunction('p99(value,foo,distribution,none)'),
          ],
        }),
      }),
    ]);
  });

  it('keeps the first visualize when changing metric type', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
    });

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'distribution'}));
    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [
            new VisualizeFunction('p50(value,foo,distribution,none)'),
            new VisualizeFunction('p75(value,foo,distribution,none)'),
          ],
        })
      )
    );

    act(() => result.current[0]!.setTraceMetric({name: 'bar', type: 'distribution'}));

    // Only the first visualize is updated when changing metric type
    expect(result.current[0]!.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p50(value,bar,distribution,none)'),
    ]);
  });

  it('updates dependent equations in the same metric update', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {
            metric: [
              JSON.stringify({
                metric: {name: 'metricA', type: 'distribution', unit: 'none'},
                query: '',
                aggregateFields: [
                  new VisualizeFunction(
                    'sum(value,metricA,distribution,none)'
                  ).serialize(),
                ],
                aggregateSortBys: [],
                mode: 'samples',
              }),
              JSON.stringify({
                metric: {name: 'metricB', type: 'distribution', unit: 'none'},
                query: '',
                aggregateFields: [
                  new VisualizeFunction(
                    'sum(value,metricB,distribution,none)'
                  ).serialize(),
                ],
                aggregateSortBys: [],
                mode: 'samples',
              }),
              JSON.stringify({
                metric: {name: 'metricC', type: 'distribution', unit: 'none'},
                query: '',
                aggregateFields: [
                  new VisualizeFunction(
                    'sum(value,metricC,distribution,none)'
                  ).serialize(),
                ],
                aggregateSortBys: [],
                mode: 'samples',
              }),
              JSON.stringify({
                metric: {name: '', type: ''},
                query: '',
                aggregateFields: [
                  new VisualizeEquation(
                    'equation|sum(value,metricA,distribution,none) + sum(value,metricB,distribution,none)'
                  ).serialize(),
                ],
                aggregateSortBys: [],
                mode: 'aggregate',
              }),
              JSON.stringify({
                metric: {name: '', type: ''},
                query: '',
                aggregateFields: [
                  new VisualizeEquation(
                    'equation|sum(value,metricA,distribution,none) - sum(value,metricC,distribution,none)'
                  ).serialize(),
                ],
                aggregateSortBys: [],
                mode: 'aggregate',
              }),
            ],
          },
        },
      },
    });

    act(() =>
      result.current[0]!.setTraceMetric({
        name: 'newSelectedMetric',
        type: 'gauge',
        unit: 'none',
      })
    );

    expect(result.current[3]!.queryParams.aggregateFields).toEqual([
      new VisualizeEquation(
        'equation|avg(value,newSelectedMetric,gauge,none) + sum(value,metricB,distribution,none)'
      ),
    ]);
    expect(result.current[4]!.queryParams.aggregateFields).toEqual([
      new VisualizeEquation(
        'equation|avg(value,newSelectedMetric,gauge,none) - sum(value,metricC,distribution,none)'
      ),
    ]);
  });

  describe('stable labels', () => {
    it('preserves label B when A is deleted from [A, B]', () => {
      const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {
              metric: [
                JSON.stringify({
                  metric: {name: 'foo', type: 'counter'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('sum(value,foo,counter,none)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
                JSON.stringify({
                  metric: {name: 'bar', type: 'counter'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('sum(value,bar,counter,none)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
              ],
            },
          },
        },
      });

      expect(result.current).toHaveLength(2);
      expect(result.current[0]).toEqual(expect.objectContaining({label: 'A'}));
      expect(result.current[1]).toEqual(expect.objectContaining({label: 'B'}));

      // Delete A
      act(() => result.current[0]!.removeMetric());

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(expect.objectContaining({label: 'B'}));
    });

    it('assigns correct labels for metrics and equations', () => {
      const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {
              metric: [
                JSON.stringify({
                  metric: {name: 'foo', type: 'counter'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('sum(value,foo,counter,none)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
                JSON.stringify({
                  metric: {name: '', type: ''},
                  query: '',
                  aggregateFields: [new VisualizeEquation(EQUATION_PREFIX).serialize()],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
              ],
            },
          },
        },
      });

      expect(result.current).toHaveLength(2);
      expect(result.current[0]).toEqual(expect.objectContaining({label: 'A'}));
      expect(result.current[1]).toEqual(expect.objectContaining({label: 'ƒ1'}));
    });

    it('keeps labels attached to query identity when reordering', () => {
      const {result} = renderHookWithProviders(
        () => {
          const metricQueries = useMultiMetricsQueryParams();
          const reorder = useReorderMetricQueries();
          return {metricQueries, reorder};
        },
        {
          additionalWrapper: Wrapper,
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/explore/metrics/',
              query: {
                metric: [
                  JSON.stringify({
                    metric: {name: 'foo', type: 'counter'},
                    query: '',
                    aggregateFields: [
                      new VisualizeFunction('sum(value,foo,counter,none)').serialize(),
                    ],
                    aggregateSortBys: [],
                    mode: 'samples',
                  }),
                  JSON.stringify({
                    metric: {name: 'bar', type: 'counter'},
                    query: '',
                    aggregateFields: [
                      new VisualizeFunction('sum(value,bar,counter,none)').serialize(),
                    ],
                    aggregateSortBys: [],
                    mode: 'samples',
                  }),
                ],
              },
            },
          },
        }
      );

      expect(result.current.metricQueries[0]).toEqual(
        expect.objectContaining({label: 'A', metric: {name: 'foo', type: 'counter'}})
      );
      expect(result.current.metricQueries[1]).toEqual(
        expect.objectContaining({label: 'B', metric: {name: 'bar', type: 'counter'}})
      );

      act(() => {
        result.current.reorder(
          [result.current.metricQueries[1]!, result.current.metricQueries[0]!],
          0,
          1
        );
      });

      expect(result.current.metricQueries[0]).toEqual(
        expect.objectContaining({label: 'B', metric: {name: 'bar', type: 'counter'}})
      );
      expect(result.current.metricQueries[1]).toEqual(
        expect.objectContaining({label: 'A', metric: {name: 'foo', type: 'counter'}})
      );
    });
  });

  describe('useAddMetricQuery', () => {
    it('adds new metric at the end of the list when adding without equations', () => {
      const {result, router} = renderHookWithProviders(useAddMetricQuery, {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {
              metric: [
                JSON.stringify({
                  metric: {name: 'foo', type: 'distribution'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('p50(value,foo,distribution,none)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
              ],
            },
          },
        },
      });

      act(() => result.current());

      expect(router.location.query.metric).toHaveLength(2);

      expect(JSON.parse(router.location.query.metric![0]!)).toEqual(
        expect.objectContaining({
          metric: {name: 'foo', type: 'distribution'},
          query: '',
          aggregateFields: [
            new VisualizeFunction('p50(value,foo,distribution,none)').serialize(),
          ],
        })
      );

      // The last field was copied
      expect(JSON.parse(router.location.query.metric![1]!)).toEqual(
        expect.objectContaining({
          metric: {name: 'foo', type: 'distribution'},
          query: '',
          aggregateFields: [
            new VisualizeFunction('p50(value,foo,distribution,none)').serialize(),
          ],
        })
      );
    });

    it('duplicates the last metric when adding with equations', () => {
      const {result, router} = renderHookWithProviders(useAddMetricQuery, {
        additionalWrapper: Wrapper,
        organization: OrganizationFixture({
          features: ['tracemetrics-enabled'],
        }),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {
              metric: [
                JSON.stringify({
                  metric: {name: 'foo', type: 'distribution'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('p50(value,foo,distribution,none)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
                JSON.stringify({
                  metric: {name: '', type: ''},
                  query: '',
                  aggregateFields: [new VisualizeEquation(EQUATION_PREFIX).serialize()],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
              ],
            },
          },
        },
      });

      act(() => result.current());

      expect(router.location.query.metric).toHaveLength(3);

      expect(JSON.parse(router.location.query.metric![0]!)).toEqual(
        expect.objectContaining({
          metric: {name: 'foo', type: 'distribution'},
          query: '',
          aggregateFields: [
            new VisualizeFunction('p50(value,foo,distribution,none)').serialize(),
          ],
        })
      );

      // The last metric query before the equation was duplicated
      expect(JSON.parse(router.location.query.metric![1]!)).toEqual(
        expect.objectContaining({
          metric: {name: 'foo', type: 'distribution'},
          query: '',
          aggregateFields: [
            new VisualizeFunction('p50(value,foo,distribution,none)').serialize(),
          ],
        })
      );

      // The equation remains
      expect(JSON.parse(router.location.query.metric![2]!)).toEqual(
        expect.objectContaining({
          query: '',
          aggregateFields: [new VisualizeEquation(EQUATION_PREFIX).serialize()],
        })
      );
    });

    it('adds equations to the end of the list', () => {
      const {result, router} = renderHookWithProviders(useAddMetricQuery, {
        additionalWrapper: Wrapper,
        organization: OrganizationFixture({
          features: ['tracemetrics-enabled'],
        }),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {
              metric: [
                JSON.stringify({
                  metric: {name: 'foo', type: 'distribution'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('p50(value,foo,distribution,none)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
                JSON.stringify({
                  metric: {name: '', type: ''},
                  query: '',
                  aggregateFields: [
                    new VisualizeEquation(
                      `${EQUATION_PREFIX}p50(value,foo,distribution,none)`
                    ).serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
              ],
            },
          },
        },
        initialProps: {
          type: 'equation',
        },
      });

      act(() => result.current());

      expect(router.location.query.metric).toHaveLength(3);

      expect(JSON.parse(router.location.query.metric![0]!)).toEqual(
        expect.objectContaining({
          metric: {name: 'foo', type: 'distribution'},
          query: '',
          aggregateFields: [
            new VisualizeFunction('p50(value,foo,distribution,none)').serialize(),
          ],
        })
      );

      // The old equation remains
      expect(JSON.parse(router.location.query.metric![1]!)).toEqual(
        expect.objectContaining({
          metric: {name: '', type: ''},
          query: '',
          aggregateFields: [
            new VisualizeEquation(
              `${EQUATION_PREFIX}p50(value,foo,distribution,none)`
            ).serialize(),
          ],
        })
      );

      // The new equation is added to the end of the list
      expect(JSON.parse(router.location.query.metric![2]!)).toEqual(
        expect.objectContaining({
          query: '',
          aggregateFields: [new VisualizeEquation(EQUATION_PREFIX).serialize()],
        })
      );
    });

    it('adds metric before equation with independent label sequences', () => {
      const {result} = renderHookWithProviders(useAddMetricQuery, {
        additionalWrapper: Wrapper,
        organization: OrganizationFixture({
          features: ['tracemetrics-enabled'],
        }),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {
              metric: [
                JSON.stringify({
                  metric: {name: 'foo', type: 'counter'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('sum(value,foo,counter,none)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
                JSON.stringify({
                  metric: {name: '', type: ''},
                  query: '',
                  aggregateFields: [new VisualizeEquation(EQUATION_PREFIX).serialize()],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
              ],
            },
          },
        },
      });

      // Add a new metric — should be inserted before the equation
      act(() => result.current());

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('ƒ1')).toBeInTheDocument();
    });

    it('increments the equation label from the last equation label counter', () => {
      const {result} = renderHookWithProviders(useAddMetricQuery, {
        additionalWrapper: Wrapper,
        organization: OrganizationFixture({
          features: ['tracemetrics-enabled'],
        }),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {
              metric: [
                JSON.stringify({
                  metric: {name: 'foo', type: 'counter'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('sum(value,foo,counter,none)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
                JSON.stringify({
                  metric: {name: '', type: ''},
                  query: '',
                  aggregateFields: [new VisualizeEquation(EQUATION_PREFIX).serialize()],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
              ],
            },
          },
        },
        initialProps: {
          type: 'equation',
        },
      });

      act(() => result.current());

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('ƒ1')).toBeInTheDocument();
      expect(screen.getByText('ƒ2')).toBeInTheDocument();
    });
  });
});
