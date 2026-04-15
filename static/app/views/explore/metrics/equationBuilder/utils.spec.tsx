import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {syncEquationMetricQueries} from 'sentry/views/explore/metrics/equationBuilder/utils';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

describe('syncEquationMetricQueries', () => {
  it('updates every equation when a referenced metric changes', () => {
    const metricQueries: BaseMetricQuery[] = [
      {
        label: 'A',
        metric: {name: 'metricA', type: 'distribution', unit: 'none'},
        queryParams: new ReadableQueryParams({
          extrapolate: true,
          mode: Mode.SAMPLES,
          query: '',
          cursor: '',
          fields: ['id', 'timestamp'],
          sortBys: [],
          aggregateCursor: '',
          aggregateFields: [
            new VisualizeFunction('sum(value,metricA,distribution,none)'),
          ],
          aggregateSortBys: [],
        }),
      },
      {
        label: 'B',
        metric: {name: 'metricB', type: 'distribution', unit: 'none'},
        queryParams: new ReadableQueryParams({
          extrapolate: true,
          mode: Mode.SAMPLES,
          query: '',
          cursor: '',
          fields: ['id', 'timestamp'],
          sortBys: [],
          aggregateCursor: '',
          aggregateFields: [
            new VisualizeFunction('sum(value,metricB,distribution,none)'),
          ],
          aggregateSortBys: [],
        }),
      },
      {
        label: 'ƒ1',
        metric: {name: '', type: ''},
        queryParams: new ReadableQueryParams({
          extrapolate: true,
          mode: Mode.AGGREGATE,
          query: '',
          cursor: '',
          fields: ['id', 'timestamp'],
          sortBys: [],
          aggregateCursor: '',
          aggregateFields: [
            new VisualizeEquation(
              'equation|sum(value,metricA,distribution,none) + sum(value,metricB,distribution,none)'
            ),
          ],
          aggregateSortBys: [],
        }),
      },
      {
        label: 'ƒ2',
        metric: {name: '', type: ''},
        queryParams: new ReadableQueryParams({
          extrapolate: true,
          mode: Mode.AGGREGATE,
          query: '',
          cursor: '',
          fields: ['id', 'timestamp'],
          sortBys: [],
          aggregateCursor: '',
          aggregateFields: [
            new VisualizeEquation(
              'equation|sum(value,metricA,distribution,none) - sum(value,metricB,distribution,none)'
            ),
          ],
          aggregateSortBys: [],
        }),
      },
    ];

    const updatedQueries = syncEquationMetricQueries(
      metricQueries,
      {
        A: 'sum(value,metricA,distribution,none)',
        B: 'sum(value,metricB,distribution,none)',
      },
      {
        A: 'avg(value,metricA,distribution,none)',
        B: 'sum(value,metricB,distribution,none)',
      }
    );

    expect(updatedQueries[2]!.queryParams.visualizes[0]!.yAxis).toBe(
      'equation|avg(value,metricA,distribution,none) + sum(value,metricB,distribution,none)'
    );
    expect(updatedQueries[3]!.queryParams.visualizes[0]!.yAxis).toBe(
      'equation|avg(value,metricA,distribution,none) - sum(value,metricB,distribution,none)'
    );
  });
});
