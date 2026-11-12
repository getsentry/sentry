import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

import {defaultMetricQuery} from './metricQuery';
import {
  canUseScoreFormulas,
  getScoreFormula,
  getScoreFormulaByKey,
  isScoreFormulaMetric,
  isScoreFormulaQuery,
  isScoreFormulaVisualize,
  isScoreFormulaYAxis,
  OPPORTUNITY_SCORE_FIELD,
  PERFORMANCE_SCORE_FIELD,
  SCORE_FORMULA_METRIC,
  SCORE_FORMULA_METRICS,
} from './scoreFormulas';

describe('scoreFormulas', () => {
  it('recognizes the two score formulas by y-axis', () => {
    expect(isScoreFormulaYAxis(PERFORMANCE_SCORE_FIELD)).toBe(true);
    expect(isScoreFormulaYAxis(OPPORTUNITY_SCORE_FIELD)).toBe(true);
    expect(isScoreFormulaYAxis('sum(value,foo,counter,none)')).toBe(false);
    expect(isScoreFormulaYAxis('performance_score(measurements.score.lcp)')).toBe(false);
  });

  it('looks up a formula by y-axis or key', () => {
    expect(getScoreFormula(PERFORMANCE_SCORE_FIELD)).toEqual(
      expect.objectContaining({key: 'performance_score', yAxis: PERFORMANCE_SCORE_FIELD})
    );
    expect(getScoreFormulaByKey('opportunity_score')).toEqual(
      expect.objectContaining({key: 'opportunity_score', yAxis: OPPORTUNITY_SCORE_FIELD})
    );
    expect(getScoreFormula('avg(value,foo,gauge,none)')).toBeUndefined();
    expect(getScoreFormulaByKey('avg')).toBeUndefined();
  });

  it('only treats function visualizes as formulas', () => {
    expect(isScoreFormulaVisualize(new VisualizeFunction(PERFORMANCE_SCORE_FIELD))).toBe(
      true
    );
    expect(
      isScoreFormulaVisualize(
        new VisualizeEquation(`equation|${PERFORMANCE_SCORE_FIELD}`)
      )
    ).toBe(false);
    expect(
      isScoreFormulaVisualize(new VisualizeFunction('sum(value,foo,counter,none)'))
    ).toBe(false);
  });

  it('reads the formula off the first visualize of a query', () => {
    const query = defaultMetricQuery();
    expect(isScoreFormulaQuery(query)).toBe(false);
    expect(
      isScoreFormulaQuery({
        ...query,
        queryParams: query.queryParams.replace({
          aggregateFields: [new VisualizeFunction(OPPORTUNITY_SCORE_FIELD)],
        }),
      })
    ).toBe(true);
  });

  it('recognizes the stand-in metric by name alone', () => {
    expect(isScoreFormulaMetric(SCORE_FORMULA_METRIC)).toBe(true);
    expect(isScoreFormulaMetric({name: 'browser.web_vital'})).toBe(true);
    expect(isScoreFormulaMetric({name: 'browser.web_vital.lcp'})).toBe(false);
    expect(isScoreFormulaMetric({name: ''})).toBe(false);
  });

  it('lists one score metric per web vital', () => {
    expect(SCORE_FORMULA_METRICS.map(metric => metric.name)).toEqual([
      'browser.web_vital.lcp.score',
      'browser.web_vital.fcp.score',
      'browser.web_vital.inp.score',
      'browser.web_vital.cls.score',
      'browser.web_vital.ttfb.score',
    ]);
    expect(
      SCORE_FORMULA_METRICS.every(
        metric => metric.type === 'distribution' && metric.unit === 'ratio'
      )
    ).toBe(true);
  });

  it('is gated by the web vitals trace metrics flag', () => {
    expect(canUseScoreFormulas(OrganizationFixture({features: []}))).toBe(false);
    expect(
      canUseScoreFormulas(
        OrganizationFixture({features: ['dashboards-web-vitals-trace-metrics']})
      )
    ).toBe(true);
  });
});
