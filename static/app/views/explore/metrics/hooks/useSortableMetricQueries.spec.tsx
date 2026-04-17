import type {DragEndEvent} from '@dnd-kit/core';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {useSortableMetricQueries} from 'sentry/views/explore/metrics/hooks/useSortableMetricQueries';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  isVisualizeEquation,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

function Wrapper({children}: {children: React.ReactNode}) {
  return <MultiMetricsQueryParamsProvider>{children}</MultiMetricsQueryParamsProvider>;
}

describe('useSortableMetricQueries', () => {
  it('uses stable labels as sortable ids', () => {
    const {result} = renderHookWithProviders(useSortableMetricQueries, {
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
                  new VisualizeFunction('sum(value,foo,counter,-)').serialize(),
                ],
                aggregateSortBys: [],
                mode: 'samples',
              }),
              JSON.stringify({
                metric: {name: 'bar', type: 'counter'},
                query: '',
                aggregateFields: [
                  new VisualizeFunction('sum(value,bar,counter,-)').serialize(),
                ],
                aggregateSortBys: [],
                mode: 'samples',
              }),
            ],
          },
        },
      },
    });

    expect(result.current.sortableItems.map(({id}) => id)).toEqual(['A', 'B']);
  });

  it('filters sortable items by query type and reorders within that section', () => {
    const {result} = renderHookWithProviders(
      () => {
        const sortable = useSortableMetricQueries({
          predicate: metricQuery =>
            !isVisualizeEquation(metricQuery.queryParams.visualizes[0]!),
        });
        const metricQueries = useMultiMetricsQueryParams();
        return {sortable, metricQueries};
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
                    new VisualizeFunction('sum(value,foo,counter,-)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
                JSON.stringify({
                  metric: {name: 'bar', type: 'counter'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('sum(value,bar,counter,-)').serialize(),
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
      }
    );

    expect(result.current.sortable.sortableItems.map(({id}) => id)).toEqual(['A', 'B']);
    expect(result.current.metricQueries.map(metricQuery => metricQuery.label)).toEqual([
      'A',
      'B',
      'ƒ1',
    ]);

    act(() => {
      result.current.sortable.onDragEnd({
        active: {id: 'B'},
        over: {id: 'A'},
      } as DragEndEvent);
    });

    expect(result.current.metricQueries.map(metricQuery => metricQuery.label)).toEqual([
      'B',
      'A',
      'ƒ1',
    ]);
  });

  it('ignores drops outside the current section', () => {
    const {result} = renderHookWithProviders(
      () => {
        const sortable = useSortableMetricQueries({
          predicate: metricQuery =>
            !isVisualizeEquation(metricQuery.queryParams.visualizes[0]!),
        });
        const metricQueries = useMultiMetricsQueryParams();
        return {sortable, metricQueries};
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
                    new VisualizeFunction('sum(value,foo,counter,-)').serialize(),
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
      }
    );

    act(() => {
      result.current.sortable.onDragEnd({
        active: {id: 'A'},
        over: {id: 'ƒ1'},
      } as DragEndEvent);
    });

    expect(result.current.metricQueries.map(metricQuery => metricQuery.label)).toEqual([
      'A',
      'ƒ1',
    ]);
  });

  it('reorders duplicate queries by label ids', () => {
    const duplicateQuery = JSON.stringify({
      metric: {name: 'foo', type: 'counter'},
      query: '',
      aggregateFields: [new VisualizeFunction('sum(value,foo,counter,-)').serialize()],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const {result} = renderHookWithProviders(useSortableMetricQueries, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {
            metric: [duplicateQuery, duplicateQuery],
          },
        },
      },
    });

    expect(
      result.current.sortableItems.map(({metricQuery}) => metricQuery.label)
    ).toEqual(['A', 'B']);

    act(() => {
      result.current.onDragEnd({
        active: {id: 'A'},
        over: {id: 'B'},
      } as DragEndEvent);
    });

    expect(
      result.current.sortableItems.map(({metricQuery}) => metricQuery.label)
    ).toEqual(['B', 'A']);
  });
});
