import type {DragEndEvent} from '@dnd-kit/core';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useSortableMetricQueries} from 'sentry/views/explore/metrics/hooks/useSortableMetricQueries';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

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
