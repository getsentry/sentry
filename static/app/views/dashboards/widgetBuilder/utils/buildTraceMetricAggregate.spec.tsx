import {explodeFieldString, generateFieldAsString} from 'sentry/utils/discover/fields';

import {
  applyTraceMetricAggregateFilter,
  buildTraceMetricAggregate,
  extractTraceMetricFromColumn,
  getTraceMetricFunctionParts,
} from './buildTraceMetricAggregate';

const METRIC = {name: 'foo', type: 'counter', unit: 'none'};

describe('buildTraceMetricAggregate', () => {
  it('builds a plain aggregate', () => {
    const column = buildTraceMetricAggregate('sum', METRIC);
    expect(generateFieldAsString(column)).toBe('sum(value,foo,counter,none)');
    expect(getTraceMetricFunctionParts(column)).toEqual({
      aggregation: 'sum',
      args: ['value', 'foo', 'counter', 'none'],
      filter: '',
    });
  });

  it('builds a conditional aggregate when given a filter', () => {
    const column = buildTraceMetricAggregate('sum', METRIC, 'status:500');
    expect(generateFieldAsString(column)).toBe(
      'sum_if(`status:500`,value,foo,counter,none)'
    );
    expect(getTraceMetricFunctionParts(column)).toEqual({
      aggregation: 'sum',
      args: ['value', 'foo', 'counter', 'none'],
      filter: 'status:500',
    });
  });

  it('extracts the metric from a conditional aggregate', () => {
    const column = explodeFieldString('sum_if(`status:500`,value,foo,counter,none)');
    expect(extractTraceMetricFromColumn(column)).toEqual(METRIC);
  });

  it('sets and clears the filter on an existing aggregate', () => {
    const column = explodeFieldString('sum(value,foo,counter,none)');
    const filtered = applyTraceMetricAggregateFilter(column, 'status:500');
    expect(generateFieldAsString(filtered)).toBe(
      'sum_if(`status:500`,value,foo,counter,none)'
    );
    expect(generateFieldAsString(applyTraceMetricAggregateFilter(filtered, ''))).toBe(
      'sum(value,foo,counter,none)'
    );
  });
});
