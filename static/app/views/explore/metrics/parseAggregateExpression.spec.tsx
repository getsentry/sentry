import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

describe('parseAggregateExpression', () => {
  it('parses a single aggregate into one row with label A', () => {
    const result = parseAggregateExpression('sum(value,foo,counter,-)');

    expect(result.compactExpression).toBeNull();
    expect(result.equationRow).toBeNull();
    expect(result.metricQueries).toHaveLength(1);
    expect(result.metricQueries[0]).toEqual(
      expect.objectContaining({
        label: 'A',
        metric: {name: 'foo', type: 'counter', unit: undefined},
      })
    );
    expect(result.metricQueries[0]!.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('sum(value,foo,counter,-)'),
    ]);
  });

  it('parses an equation with two distinct metrics into two labeled rows', () => {
    const result = parseAggregateExpression(
      'equation|sum(value,metricA,counter,-) + avg(value,metricB,gauge,-)'
    );

    expect(result.metricQueries).toHaveLength(2);
    expect(result.metricQueries[0]).toEqual(
      expect.objectContaining({
        label: 'A',
        metric: {name: 'metricA', type: 'counter', unit: undefined},
      })
    );
    expect(result.metricQueries[1]).toEqual(
      expect.objectContaining({
        label: 'B',
        metric: {name: 'metricB', type: 'gauge', unit: undefined},
      })
    );
    expect(result.compactExpression).toBe('A + B');
    expect(result.equationRow?.queryParams.aggregateFields).toEqual([
      new VisualizeEquation(
        'equation|sum(value,metricA,counter,-) + avg(value,metricB,gauge,-)'
      ),
    ]);
  });

  it('dedupes identical function calls into a single row', () => {
    const result = parseAggregateExpression(
      'equation|sum(value,metricA,counter,-) + sum(value,metricA,counter,-)'
    );

    expect(result.metricQueries).toHaveLength(1);
    expect(result.metricQueries[0]).toEqual(
      expect.objectContaining({
        label: 'A',
        metric: {name: 'metricA', type: 'counter', unit: undefined},
      })
    );
    expect(result.compactExpression).toBe('A + A');
  });

  it('preserves numeric literals alongside references', () => {
    const result = parseAggregateExpression('equation|sum(value,metricA,counter,-) / 2');

    expect(result.metricQueries).toHaveLength(1);
    expect(result.compactExpression).toBe('A / 2');
  });

  it('assigns labels in order of first appearance within nested parens', () => {
    const result = parseAggregateExpression(
      'equation|(sum(value,metricB,counter,-) + sum(value,metricA,counter,-)) / sum(value,metricC,counter,-)'
    );

    expect(result.metricQueries).toHaveLength(3);
    expect(result.metricQueries.map(q => q.metric.name)).toEqual([
      'metricB',
      'metricA',
      'metricC',
    ]);
    expect(result.metricQueries.map(q => q.label)).toEqual(['A', 'B', 'C']);
  });

  it('returns empty rows for an equation with no function calls', () => {
    const result = parseAggregateExpression('equation|1 + 2');

    expect(result.metricQueries).toHaveLength(0);
    expect(result.compactExpression).toBe('1 + 2');
    expect(result.equationRow).not.toBeNull();
  });

  it('parses units when present', () => {
    const result = parseAggregateExpression(
      'avg(value,latency,distribution,millisecond)'
    );

    expect(result.metricQueries[0]).toEqual(
      expect.objectContaining({
        metric: {name: 'latency', type: 'distribution', unit: 'millisecond'},
      })
    );
  });

  it('normalizes _if function into plain aggregate + query', () => {
    const result = parseAggregateExpression(
      'sum_if(`status:ok`,value,requests,counter,none)'
    );

    expect(result.metricQueries[0]).toEqual(
      expect.objectContaining({
        label: 'A',
        metric: {name: 'requests', type: 'counter', unit: 'none'},
      })
    );
    expect(result.metricQueries[0]!.queryParams.query).toBe('status:ok');
    expect(result.metricQueries[0]!.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('sum(value,requests,counter,none)'),
    ]);
  });

  it('preserves complex _if filter query', () => {
    const result = parseAggregateExpression(
      'equation|sum_if(`agent_name:["Agent Run","Assisted Query"] AND environment:prod`,value,errors,counter,none) / sum(value,total,counter,none)'
    );

    expect(result.metricQueries).toHaveLength(2);
    expect(result.metricQueries[0]!.queryParams.query).toBe(
      'agent_name:["Agent Run","Assisted Query"] AND environment:prod'
    );
    expect(result.metricQueries[0]!.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('sum(value,errors,counter,none)'),
    ]);
    expect(result.metricQueries[1]!.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('sum(value,total,counter,none)'),
    ]);
    expect(result.metricQueries[1]!.queryParams.query).toBe('');
  });

  it('dedupes identical _if calls and distinguishes different filters', () => {
    const result = parseAggregateExpression(
      'equation|sum_if(`env:prod`,value,metricA,counter,-) + sum_if(`env:dev`,value,metricA,counter,-) + sum_if(`env:prod`,value,metricA,counter,-)'
    );

    expect(result.metricQueries).toHaveLength(2);
    expect(result.metricQueries[0]!.queryParams.query).toBe('env:prod');
    expect(result.metricQueries[1]!.queryParams.query).toBe('env:dev');
    expect(result.compactExpression).toBe('A + B + A');
  });
});
