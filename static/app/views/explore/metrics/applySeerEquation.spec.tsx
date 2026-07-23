import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {applySeerResultsToMetricQueries} from 'sentry/views/explore/metrics/applySeerEquation';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {decodeMetricsQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isVisualizeEquation,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

function makeQueryParams(
  overrides: Partial<{
    aggregateFields: readonly unknown[];
    mode: Mode;
    query: string;
  }> = {}
): ReadableQueryParams {
  return new ReadableQueryParams({
    extrapolate: true,
    mode: overrides.mode ?? Mode.SAMPLES,
    query: overrides.query ?? '',
    cursor: '',
    fields: ['id', 'timestamp'],
    sortBys: [{field: 'timestamp', kind: 'desc' as const}],
    aggregateCursor: '',
    aggregateFields: (overrides.aggregateFields ?? [
      new VisualizeFunction('sum(value)'),
    ]) as readonly never[],
    aggregateSortBys: [],
  });
}

function makeAggregate(
  yAxis: string,
  label: string,
  opts?: {metric?: {name: string; type: string; unit?: string}; query?: string}
): BaseMetricQuery {
  const qp = makeQueryParams({
    aggregateFields: [new VisualizeFunction(yAxis)],
    query: opts?.query,
  });
  return {
    label,
    metric: opts?.metric ?? {name: '', type: ''},
    queryParams: qp,
  };
}

function makeEquation(
  yAxis: string,
  label: string,
  internalExpression?: string
): BaseMetricQuery {
  const qp = makeQueryParams({
    mode: Mode.AGGREGATE,
    aggregateFields: [
      new VisualizeEquation(`${EQUATION_PREFIX}${yAxis}`, {internalExpression}),
    ],
  });
  return {label, metric: {name: '', type: ''}, queryParams: qp};
}

function runSeerEquationUpdate({
  currentMetricQueries,
  interactedQueryParams,
  seerEquationYAxis,
}: {
  currentMetricQueries: BaseMetricQuery[];
  interactedQueryParams: ReadableQueryParams;
  seerEquationYAxis: string;
}) {
  const parsed = parseAggregateExpression(seerEquationYAxis);
  const seerAggregates = parsed.metricQueries;
  const seerEquations = parsed.equationRow ? [parsed.equationRow] : [];

  return applySeerResultsToMetricQueries({
    metricQueries: currentMetricQueries,
    interactedQueryParams,
    seerMetricQueries: [...seerAggregates, ...seerEquations],
  });
}

/**
 * Decodes the final encoded metrics array into BaseMetricQuery objects and
 * pulls out the yAxis and internalExpression for each visualization so tests
 * can assert on the end result the caller navigates with.
 */
function decodeResults(encodedMetrics: string[]) {
  return encodedMetrics.map(encoded => {
    const decoded = decodeMetricsQueryParams(encoded);
    const viz = decoded?.queryParams.visualizes[0];
    return {
      metric: decoded?.metric,
      yAxis: viz?.yAxis,
      isEquation: viz ? isVisualizeEquation(viz) : false,
      internalExpression:
        viz && isVisualizeEquation(viz) ? viz.internalExpression : undefined,
    };
  });
}

describe('applySeerEquation', () => {
  it('replaces an aggregate row and splices equation components', () => {
    const aggA = makeAggregate('sum(value,metricA,counter,none)', 'A', {
      metric: {name: 'metricA', type: 'counter'},
    });

    const result = runSeerEquationUpdate({
      currentMetricQueries: [aggA],
      interactedQueryParams: aggA.queryParams,
      seerEquationYAxis:
        'equation|sum(value,metricX,counter,none) + avg(value,metricY,gauge,none)',
    });

    const decoded = decodeResults(result.encodedMetrics);
    expect(decoded).toHaveLength(3);

    // First two are aggregates, last is the equation
    expect(decoded[0]!.isEquation).toBe(false);
    expect(decoded[1]!.isEquation).toBe(false);
    expect(decoded[2]!.isEquation).toBe(true);
    expect(decoded[2]!.internalExpression).toBe('A + B');
  });

  it('assigns letter label when replacing an equation panel (ƒ1)', () => {
    const aggA = makeAggregate('sum(value,metricA,counter,none)', 'A', {
      metric: {name: 'metricA', type: 'counter'},
    });
    const aggB = makeAggregate('avg(value,metricB,gauge,none)', 'B', {
      metric: {name: 'metricB', type: 'gauge'},
    });
    const eqF1 = makeEquation(
      'sum(value,metricA,counter,none) + avg(value,metricB,gauge,none)',
      'ƒ1',
      'A + B'
    );
    const seerEquationYAxis =
      'equation|p50(value,metricC,distribution,none) * count(value,metricD,counter,none)';

    const result = runSeerEquationUpdate({
      currentMetricQueries: [aggA, aggB, eqF1],
      interactedQueryParams: eqF1.queryParams,
      seerEquationYAxis,
    });

    const decoded = decodeResults(result.encodedMetrics);

    // ƒ1 was replaced by an aggregate, extra aggregate + equation spliced in
    // Expect: [aggA, aggB, replacement(metricC), extra(metricD), newEquation]
    expect(decoded).toHaveLength(5);

    // The replacement row is an aggregate, not an equation
    expect(decoded[2]!.isEquation).toBe(false);
    expect(decoded[2]!.yAxis).toBe('p50(value,metricC,distribution,none)');

    // The new equation references letter labels, not ƒ labels
    // TODO: the new one should get the correct internalExpression, we can calculate that.
    // const newEq = decoded.find(d => d.isEquation && d.yAxis === seerEquationYAxis);
    // expect(newEq!.internalExpression).toBe('C * D');
  });

  it('preserves existing equation yAxis when replacing an aggregate', () => {
    const aggA = makeAggregate('sum(value,metricA,counter,none)', 'A', {
      metric: {name: 'metricA', type: 'counter'},
    });
    const aggB = makeAggregate('avg(value,metricB,gauge,none)', 'B', {
      metric: {name: 'metricB', type: 'gauge'},
    });
    const existingEq = makeEquation(
      'sum(value,metricA,counter,none) + avg(value,metricB,gauge,none)',
      'ƒ1',
      'A + B'
    );
    const seerEquationYAxis =
      'equation|p75(value,metricX,distribution,none) - count(value,metricY,counter,none)';

    const result = runSeerEquationUpdate({
      currentMetricQueries: [aggA, aggB, existingEq],
      interactedQueryParams: aggA.queryParams,
      seerEquationYAxis,
    });

    const decoded = decodeResults(result.encodedMetrics);
    const existingEqDecoded = decoded.find(
      d => d.isEquation && d.yAxis !== seerEquationYAxis
    );

    // The existing equation's internalExpression and resolved yAxis should
    // reference the updated A aggregate
    expect(existingEqDecoded).toBeDefined();
    expect(existingEqDecoded!.yAxis).toBe(
      'equation|p75(value,metricX,distribution,none) + avg(value,metricB,gauge,none)'
    );
  });

  it('handles equation with single aggregate (no extra aggregates)', () => {
    const aggA = makeAggregate('sum(value,metricA,counter,none)', 'A', {
      metric: {name: 'metricA', type: 'counter'},
    });

    const result = runSeerEquationUpdate({
      currentMetricQueries: [aggA],
      interactedQueryParams: aggA.queryParams,
      seerEquationYAxis: 'equation|sum(value,metricX,counter,none) / 2',
    });

    const decoded = decodeResults(result.encodedMetrics);
    expect(decoded).toHaveLength(2);

    expect(decoded[0]!.yAxis).toBe('sum(value,metricX,counter,none)');

    const eqn = decoded[1]!;
    expect(eqn.yAxis).toBe('equation|sum(value,metricX,counter,none) / 2');
    expect(eqn.internalExpression).toBe('A / 2');
  });

  it('no ƒ labels leak when equation panel is the only row', () => {
    const eqF1 = makeEquation('1 + 2', 'ƒ1', '1 + 2');

    const result = runSeerEquationUpdate({
      currentMetricQueries: [eqF1],
      interactedQueryParams: eqF1.queryParams,
      seerEquationYAxis:
        'equation|sum(value,metricA,counter,none) + avg(value,metricB,gauge,none)',
    });

    const decoded = decodeResults(result.encodedMetrics);

    expect(decoded[0]!.yAxis).toBe('sum(value,metricA,counter,none)');
    expect(decoded[1]!.yAxis).toBe('avg(value,metricB,gauge,none)');

    const eqn = decoded[2]!;
    expect(eqn.yAxis).toBe(
      'equation|sum(value,metricA,counter,none) + avg(value,metricB,gauge,none)'
    );
    expect(eqn.internalExpression).toBe('A + B');
  });

  it('maps extra Seer aggregates to correct insertion positions', () => {
    const aggA = makeAggregate('sum(value,metricA,counter,none)', 'A', {
      metric: {name: 'metricA', type: 'counter'},
    });
    const aggB = makeAggregate('avg(value,metricB,gauge,none)', 'B', {
      metric: {name: 'metricB', type: 'gauge'},
    });

    const result = runSeerEquationUpdate({
      currentMetricQueries: [aggA, aggB],
      interactedQueryParams: aggA.queryParams,
      seerEquationYAxis:
        'equation|p50(value,metricX,distribution,none) + p99(value,metricY,distribution,none) + count(value,metricZ,counter,none)',
    });

    const decoded = decodeResults(result.encodedMetrics);
    expect(decoded[0]!.yAxis).toBe('p50(value,metricX,distribution,none)');
    expect(decoded[1]!.yAxis).toBe('avg(value,metricB,gauge,none)');
    expect(decoded[2]!.yAxis).toBe('p99(value,metricY,distribution,none)');
    expect(decoded[3]!.yAxis).toBe('count(value,metricZ,counter,none)');
    const eqn = decoded[4]!;
    expect(eqn.yAxis).toBe(
      'equation|p50(value,metricX,distribution,none) + p99(value,metricY,distribution,none) + count(value,metricZ,counter,none)'
    );
    // "B" was left untouched because it was not interacted with and preexisting
    expect(eqn.internalExpression).toBe('A + C + D');
  });

  it('never produces ƒ labels with mixed aggregates and equations', () => {
    const aggA = makeAggregate('sum(value,m1,counter,none)', 'A', {
      metric: {name: 'm1', type: 'counter'},
    });
    const aggB = makeAggregate('avg(value,m2,gauge,none)', 'B', {
      metric: {name: 'm2', type: 'gauge'},
    });
    const aggC = makeAggregate('count(value,m3,counter,none)', 'C', {
      metric: {name: 'm3', type: 'counter'},
    });
    const eqF1 = makeEquation(
      'sum(value,m1,counter,none) + avg(value,m2,gauge,none)',
      'ƒ1',
      'A + B'
    );
    const eqF2 = makeEquation('count(value,m3,counter,none) * 100', 'ƒ2', 'C * 100');

    const result = runSeerEquationUpdate({
      currentMetricQueries: [aggA, aggB, aggC, eqF1, eqF2],
      interactedQueryParams: eqF2.queryParams,
      seerEquationYAxis:
        'equation|p50(value,metricNew,distribution,none) / count(value,metricNew,distribution,none)',
    });

    const decoded = decodeResults(result.encodedMetrics);
    expect(decoded).toHaveLength(7);

    expect(decoded[0]!.yAxis).toBe('sum(value,m1,counter,none)');
    expect(decoded[1]!.yAxis).toBe('avg(value,m2,gauge,none)');
    expect(decoded[2]!.yAxis).toBe('count(value,m3,counter,none)');
    expect(decoded[3]!.yAxis).toBe('count(value,metricNew,distribution,none)');
    expect(decoded[4]!.yAxis).toBe(
      'equation|sum(value,m1,counter,none) + avg(value,m2,gauge,none)'
    );

    // TODO: Should this be in the proper order by this point? Or is it aggregated downstream?
    expect(decoded[5]!.yAxis).toBe('p50(value,metricNew,distribution,none)');
    expect(decoded[6]!.yAxis).toBe(
      'equation|p50(value,metricNew,distribution,none) / count(value,metricNew,distribution,none)'
    );
  });

  it('deduped aggregates produce repeated label references', () => {
    const aggA = makeAggregate('sum(value,metricA,counter,none)', 'A', {
      metric: {name: 'metricA', type: 'counter'},
    });
    const seerEquationYAxis =
      'equation|sum(value,metricX,counter,none) + sum(value,metricX,counter,none)';

    const result = runSeerEquationUpdate({
      currentMetricQueries: [aggA],
      interactedQueryParams: aggA.queryParams,
      seerEquationYAxis,
    });

    const decoded = decodeResults(result.encodedMetrics);
    expect(decoded).toHaveLength(2);

    expect(decoded[0]!.yAxis).toBe('sum(value,metricX,counter,none)');
    expect(decoded[1]!.yAxis).toBe(seerEquationYAxis);
    expect(decoded[1]!.internalExpression).toBe('A + A');
  });

  // TODO: This is kind of clunky, maybe we can do something general and pass in a type of replacement to applySeerEquation?
  it('nonEquationReplacement is applied when Seer returns no equation', () => {
    const aggA = makeAggregate('sum(value,metricA,counter,none)', 'A', {
      metric: {name: 'metricA', type: 'counter'},
    });
    const newQp = makeQueryParams({
      aggregateFields: [new VisualizeFunction('avg(value,metricX,gauge,none)')],
    });

    const result = applySeerResultsToMetricQueries({
      metricQueries: [aggA],
      interactedQueryParams: aggA.queryParams,
      seerMetricQueries: [],
      seerAggregateReplacement: {
        metric: {name: 'metricX', type: 'gauge'},
        queryParams: newQp,
      },
    });

    const decoded = decodeResults(result.encodedMetrics);
    expect(decoded).toHaveLength(1);
    expect(decoded[0]!.yAxis).toBe('avg(value,metricX,gauge,none)');
    expect(decoded[0]!.metric).toEqual({name: 'metricX', type: 'gauge'});
  });

  it('counts only aggregate rows when computing replacement label position', () => {
    // Layout: [agg, eq, agg, eq, agg, eq(interacted)]
    const queries: BaseMetricQuery[] = [
      makeAggregate('sum(value,m1,counter,none)', 'A', {
        metric: {name: 'm1', type: 'counter'},
      }),
      makeAggregate('avg(value,m2,gauge,none)', 'B', {
        metric: {name: 'm2', type: 'gauge'},
      }),
      makeAggregate('count(value,m3,counter,none)', 'C', {
        metric: {name: 'm3', type: 'counter'},
      }),
      makeEquation('sum(value,m1,counter,none) * 2', 'ƒ1', 'A * 2'),
      makeEquation('avg(value,m2,gauge,none) * 3', 'ƒ2', 'B * 3'),
      makeEquation('count(value,m3,counter,none) / 10', 'ƒ3', 'C / 10'),
    ];

    const result = runSeerEquationUpdate({
      currentMetricQueries: queries,
      interactedQueryParams: queries[2]!.queryParams,
      seerEquationYAxis:
        'equation|p50(value,metricNew,distribution,none) + p99(value,metricNew,distribution,none)',
    });

    const decoded = decodeResults(result.encodedMetrics);
    expect(decoded).toHaveLength(8);

    expect(decoded[0]!.yAxis).toBe('sum(value,m1,counter,none)');
    expect(decoded[1]!.yAxis).toBe('avg(value,m2,gauge,none)');
    expect(decoded[2]!.yAxis).toBe('p50(value,metricNew,distribution,none)');
    expect(decoded[3]!.yAxis).toBe('p99(value,metricNew,distribution,none)');

    // Every equation should use only letter labels
    expect(decoded[4]!.yAxis).toBe('equation|sum(value,m1,counter,none) * 2');
    expect(decoded[4]!.internalExpression).toBe('A * 2');
    expect(decoded[5]!.yAxis).toBe('equation|avg(value,m2,gauge,none) * 3');
    expect(decoded[5]!.internalExpression).toBe('B * 3');
    expect(decoded[6]!.yAxis).toBe(
      'equation|p50(value,metricNew,distribution,none) / 10'
    );
    expect(decoded[6]!.internalExpression).toBe('C / 10');
    expect(decoded[7]!.yAxis).toBe(
      'equation|p50(value,metricNew,distribution,none) + p99(value,metricNew,distribution,none)'
    );
    expect(decoded[7]!.internalExpression).toBe('C + D');
  });

  it('returns requires_clear when there are not enough slots', () => {
    const queries = Array.from({length: 8}, (_, i) =>
      makeAggregate(`sum(value,metric,counter,none)`, String.fromCharCode(65 + i), {
        metric: {name: `metric${i}`, type: 'counter'},
      })
    );

    const result = runSeerEquationUpdate({
      currentMetricQueries: queries,
      interactedQueryParams: queries[0]!.queryParams,
      seerEquationYAxis:
        'equation|sum(value,metricX,counter,none) + avg(value,metricY,gauge,none)',
    });

    expect(result.spliceResult).toBe('requires_clear');
  });
});
