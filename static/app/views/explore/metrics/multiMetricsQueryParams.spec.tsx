import {useEffect, type ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  renderHookWithProviders,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  decodeMetricsQueryParams,
  defaultMetricQuery,
  encodeMetricQueryParams,
  type MetricQuery,
} from 'sentry/views/explore/metrics/metricQuery';
import {
  LocalMultiMetricsQueryParamsProvider,
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

function canonicalMetricQueryParam(name: string) {
  return encodeMetricQueryParams(
    decodeMetricsQueryParams(
      JSON.stringify({
        metric: {name, type: 'counter'},
        query: '',
        aggregateFields: [
          new VisualizeFunction(`sum(value,${name},counter,none)`).serialize(),
        ],
        aggregateSortBys: [],
        mode: 'samples',
      })
    )!
  );
}

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

function SelectMetricWhenEmpty({index}: {index: number}) {
  const {metric, setTraceMetric} = useMultiMetricsQueryParams()[index]!;

  useEffect(() => {
    if (!metric.name) {
      setTraceMetric({name: `metric${index}`, type: 'counter'});
    }
  }, [index, metric.name, setTraceMetric]);

  return null;
}

function SelectMetricsWhenEmptyWrapper({children}: {children: ReactNode}) {
  return (
    <MultiMetricsQueryParamsProvider>
      <SelectMetricWhenEmpty index={0} />
      <SelectMetricWhenEmpty index={1} />
      {children}
    </MultiMetricsQueryParamsProvider>
  );
}

function LocalWrapper({children}: {children: ReactNode}) {
  return (
    <LocalMultiMetricsQueryParamsProvider
      initialQueries={['foo', 'bar', 'baz'].map(name =>
        decodeMetricsQueryParams(canonicalMetricQueryParam(name))!
      )}
    >
      {children}
    </LocalMultiMetricsQueryParamsProvider>
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

    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [new VisualizeFunction('p50(value,foo,counter,none)')],
        })
      )
    );

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

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'distribution'}));
    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [new VisualizeFunction('p50(value,foo,distribution,none)')],
        })
      )
    );
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'foo', type: 'distribution'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('p50(value,foo,distribution,none)')],
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

  it('keeps sum when changing to a gauge metric', () => {
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

    act(() => result.current[0]!.setTraceMetric({name: 'bar', type: 'gauge'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'bar', type: 'gauge'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('sum(value,bar,gauge,none)')],
        }),
      }),
    ]);
  });

  it('keeps count when changing to a gauge metric', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
    });

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'distribution'}));
    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [new VisualizeFunction('count(value,foo,distribution,none)')],
        })
      )
    );

    act(() => result.current[0]!.setTraceMetric({name: 'bar', type: 'gauge'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'bar', type: 'gauge'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('count(value,bar,gauge,none)')],
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
                    'p50(value,metricA,distribution,none)'
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
                    'equation|p50(value,metricA,distribution,none) + sum(value,metricB,distribution,none)'
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
                    'equation|p50(value,metricA,distribution,none) - sum(value,metricC,distribution,none)'
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

  it('keeps other queries referentially stable when one query changes', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {
            metric: ['foo', 'bar'].map(canonicalMetricQueryParam),
          },
        },
      },
    });
    const unchanged = result.current[1]!;

    act(() => result.current[0]!.setTraceMetric({name: 'baz', type: 'counter'}));

    expect(result.current[0]!.metric).toEqual({name: 'baz', type: 'counter'});
    expect(result.current[1]!.metric).toBe(unchanged.metric);
    expect(result.current[1]!.queryParams).toBe(unchanged.queryParams);
    expect(result.current[1]!.setQueryParams).toBe(unchanged.setQueryParams);
    expect(result.current[1]!.setTraceMetric).toBe(unchanged.setTraceMetric);
    expect(result.current[1]!.removeMetric).toBe(unchanged.removeMetric);
  });

  it('keeps both updates when two queries change in the same tick', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {metric: ['foo', 'bar'].map(canonicalMetricQueryParam)},
        },
      },
    });
    const [first, second] = result.current;

    act(() => {
      first!.setTraceMetric({name: 'baz', type: 'counter'});
      second!.setQueryParams(second!.queryParams.replace({query: 'span.op:db'}));
    });

    expect(result.current[0]!.metric).toEqual({name: 'baz', type: 'counter'});
    expect(result.current[1]!.queryParams.query).toBe('span.op:db');
  });

  it('does not share decoded queries between panels with identical URL values', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {metric: ['foo', 'foo'].map(canonicalMetricQueryParam)},
        },
      },
    });

    expect(result.current[1]!.queryParams).not.toBe(result.current[0]!.queryParams);
  });

  it('keeps every query referentially stable when an unrelated URL param changes', async () => {
    const metric = ['foo', 'bar'].map(canonicalMetricQueryParam);
    const {result, router} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/explore/metrics/', query: {metric}},
      },
    });
    const [first, second] = result.current;
    const search = new URLSearchParams(metric.map(value => ['metric', value]));
    search.set('unrelated', '1');

    router.navigate(`/organizations/org-slug/explore/metrics/?${search.toString()}`);
    await waitFor(() => expect(router.location.query.unrelated).toBe('1'));

    expect(result.current[0]).toBe(first);
    expect(result.current[1]).toBe(second);
  });

  it('applies a captured mutator to its own query after an earlier query is removed', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {metric: ['foo', 'bar', 'baz'].map(canonicalMetricQueryParam)},
        },
      },
    });
    const third = result.current[2]!;

    act(() => result.current[0]!.removeMetric());
    act(() => third.setQueryParams(third.queryParams.replace({query: 'span.op:db'})));

    expect(result.current.map(metricQuery => metricQuery.metric.name)).toEqual([
      'bar',
      'baz',
    ]);
    expect(result.current.map(metricQuery => metricQuery.queryParams.query)).toEqual([
      '',
      'span.op:db',
    ]);
  });

  it('updates only its own query when two queries share a label', async () => {
    const aggregate = canonicalMetricQueryParam('foo');
    const equation = JSON.stringify({
      metric: {name: '', type: ''},
      query: '',
      aggregateFields: [new VisualizeEquation('equation|A * 2').serialize()],
      aggregateSortBys: [],
      mode: 'aggregate',
    });
    const {result, router} = renderHookWithProviders(
      () => ({
        addMetricQuery: useAddMetricQuery(),
        metricQueries: useMultiMetricsQueryParams(),
      }),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {metric: [aggregate, canonicalMetricQueryParam('bar')]},
          },
        },
      }
    );
    const search = new URLSearchParams([
      ['metric', aggregate],
      ['metric', equation],
    ]);
    router.navigate(`/organizations/org-slug/explore/metrics/?${search.toString()}`);
    await waitFor(() =>
      expect(result.current.metricQueries[1]!.queryParams.visualizes[0]).toBeInstanceOf(
        VisualizeEquation
      )
    );
    act(() => result.current.addMetricQuery());
    const added = result.current.metricQueries[1]!;

    act(() => added.setQueryParams(added.queryParams.replace({query: 'span.op:db'})));

    expect(result.current.metricQueries.map(metricQuery => metricQuery.label)).toEqual([
      'A',
      'B',
      'B',
    ]);
    expect(
      result.current.metricQueries.map(metricQuery => metricQuery.queryParams.query)
    ).toEqual(['', 'span.op:db', '']);
    expect(result.current.metricQueries[2]!.queryParams.visualizes[0]).toBeInstanceOf(
      VisualizeEquation
    );
  });

  it('keeps every update made by panels as they mount', async () => {
    const emptyMetricQuery = encodeMetricQueryParams(defaultMetricQuery());
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: SelectMetricsWhenEmptyWrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {metric: [emptyMetricQuery, emptyMetricQuery]},
        },
      },
    });

    await waitFor(() =>
      expect(result.current.map(metricQuery => metricQuery.metric.name)).toEqual([
        'metric0',
        'metric1',
      ])
    );
  });

  it('builds on an external navigation after its own write lands', async () => {
    const {result, router} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {metric: ['foo', 'bar'].map(canonicalMetricQueryParam)},
        },
      },
    });

    act(() => result.current[0]!.setTraceMetric({name: 'written', type: 'counter'}));
    await waitFor(() =>
      expect(router.location.query.metric![0]).toContain('"name":"written"')
    );
    const search = new URLSearchParams(
      ['external', 'other'].map(name => ['metric', canonicalMetricQueryParam(name)])
    );
    router.navigate(`/organizations/org-slug/explore/metrics/?${search.toString()}`);
    await waitFor(() => expect(result.current[0]!.metric.name).toBe('external'));
    act(() => result.current[1]!.setTraceMetric({name: 'edited', type: 'counter'}));

    expect(result.current.map(metricQuery => metricQuery.metric.name)).toEqual([
      'external',
      'edited',
    ]);
  });

  it('applies same-tick updates in order when local state defers them', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: LocalWrapper,
    });
    const [first, , third] = result.current;

    act(() => {
      first!.setQueryParams(first!.queryParams.replace({query: 'span.op:http'}));
      third!.setQueryParams(third!.queryParams.replace({query: 'span.op:db'}));
      first!.removeMetric();
    });

    expect(result.current.map(metricQuery => metricQuery.metric.name)).toEqual([
      'bar',
      'baz',
    ]);
    expect(result.current.map(metricQuery => metricQuery.queryParams.query)).toEqual([
      '',
      'span.op:db',
    ]);
  });

  it('keeps other queries referentially stable after many edits to one query', () => {
    const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {metric: ['foo', 'bar'].map(canonicalMetricQueryParam)},
        },
      },
    });
    const unchanged = result.current[1]!;

    for (let i = 0; i < 150; i++) {
      act(() =>
        result.current[0]!.setQueryParams(
          result.current[0]!.queryParams.replace({query: `span.op:${i}`})
        )
      );
    }

    expect(result.current[0]!.queryParams.query).toBe('span.op:149');
    expect(result.current[1]!.queryParams).toBe(unchanged.queryParams);
  });

  describe.each([
    ['URL', Wrapper],
    ['local', LocalWrapper],
  ])('with %s state', (_, additionalWrapper) => {
    function expectSameQueries(actual: MetricQuery[], expected: MetricQuery[]) {
      expect(actual).toHaveLength(expected.length);
      actual.forEach((metricQuery, i) => {
        expect(metricQuery.queryParams).toBe(expected[i]!.queryParams);
        expect(metricQuery.setQueryParams).toBe(expected[i]!.setQueryParams);
        expect(metricQuery.setTraceMetric).toBe(expected[i]!.setTraceMetric);
        expect(metricQuery.removeMetric).toBe(expected[i]!.removeMetric);
      });
    }

    function renderMetricQueries() {
      return renderHookWithProviders(
        () => ({
          addMetricQuery: useAddMetricQuery(),
          metricQueries: useMultiMetricsQueryParams(),
          reorderMetricQueries: useReorderMetricQueries(),
        }),
        {
          additionalWrapper,
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/explore/metrics/',
              query: {metric: ['foo', 'bar', 'baz'].map(canonicalMetricQueryParam)},
            },
          },
        }
      );
    }

    it('keeps an earlier update when a query is added', () => {
      const {result} = renderMetricQueries();
      const third = result.current.metricQueries[2]!;

      act(() => {
        third.setQueryParams(third.queryParams.replace({query: 'span.op:db'}));
        result.current.addMetricQuery();
      });

      expect(
        result.current.metricQueries.map(metricQuery => metricQuery.queryParams.query)
      ).toEqual(['', '', 'span.op:db', 'span.op:db']);
      expect(result.current.metricQueries.map(metricQuery => metricQuery.label)).toEqual([
        'A',
        'B',
        'C',
        'D',
      ]);
    });

    it('keeps an earlier update when queries are reordered', () => {
      const {result} = renderMetricQueries();
      const first = result.current.metricQueries[0]!;

      act(() => {
        first.setQueryParams(first.queryParams.replace({query: 'span.op:db'}));
        result.current.reorderMetricQueries(0, 2);
      });

      expect(
        result.current.metricQueries.map(metricQuery => metricQuery.metric.name)
      ).toEqual(['bar', 'baz', 'foo']);
      expect(
        result.current.metricQueries.map(metricQuery => metricQuery.queryParams.query)
      ).toEqual(['', '', 'span.op:db']);
      expect(result.current.metricQueries.map(metricQuery => metricQuery.label)).toEqual([
        'B',
        'C',
        'A',
      ]);
    });

    it('keeps the remaining queries referentially stable when one is removed', () => {
      const {result} = renderMetricQueries();
      const [first, second, third] = result.current.metricQueries;

      act(() => first!.removeMetric());

      expectSameQueries(result.current.metricQueries, [second!, third!]);
    });

    it('keeps every query referentially stable when queries are reordered', () => {
      const {result} = renderMetricQueries();
      const [first, second, third] = result.current.metricQueries;

      act(() => result.current.reorderMetricQueries(0, 2));

      expectSameQueries(result.current.metricQueries, [second!, third!, first!]);
    });

    it('keeps existing queries referentially stable when one is added', () => {
      const {result} = renderMetricQueries();
      const existing = result.current.metricQueries;

      act(() => result.current.addMetricQuery());

      expectSameQueries(result.current.metricQueries.slice(0, 3), existing);
    });
  });

  describe('URL writes', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not write the URL when an update leaves the queries unchanged', () => {
      const onNuqsUrlUpdate = jest.fn();
      const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
        additionalWrapper: Wrapper,
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {metric: ['foo'].map(canonicalMetricQueryParam)},
          },
        },
      });

      act(() => result.current[0]!.setQueryParams(result.current[0]!.queryParams));
      act(() => jest.runAllTimers());

      expect(onNuqsUrlUpdate).not.toHaveBeenCalled();
    });

    it('pushes a history entry when an update changes the queries', () => {
      const onNuqsUrlUpdate = jest.fn();
      const {result} = renderHookWithProviders(useMultiMetricsQueryParams, {
        additionalWrapper: Wrapper,
        onNuqsUrlUpdate,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: {metric: ['foo'].map(canonicalMetricQueryParam)},
          },
        },
      });

      act(() =>
        result.current[0]!.setQueryParams(
          result.current[0]!.queryParams.replace({query: 'span.op:db'})
        )
      );
      act(() => jest.runAllTimers());

      expect(onNuqsUrlUpdate).toHaveBeenCalledTimes(1);
      expect(onNuqsUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({options: expect.objectContaining({history: 'push'})})
      );
    });
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
        result.current.reorder(0, 1);
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
    it('adds new metric at the end of the list when adding without equations', async () => {
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

      await waitFor(() => expect(router.location.query.metric).toHaveLength(2));

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

    it('duplicates the last metric when adding with equations', async () => {
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

      await waitFor(() => expect(router.location.query.metric).toHaveLength(3));

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

    it('adds equations to the end of the list', async () => {
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

      await waitFor(() => expect(router.location.query.metric).toHaveLength(3));

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
