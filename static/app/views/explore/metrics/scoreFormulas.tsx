import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {FractionUnit} from 'sentry/utils/discover/fields';
import {
  isVisualizeFunction,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import {ORDER} from 'sentry/views/insights/browser/webVitals/types';

import type {BaseMetricQuery, TraceMetric} from './metricQuery';

export const PERFORMANCE_SCORE_FIELD = 'performance_score(measurements.score.total)';
export const OPPORTUNITY_SCORE_FIELD = 'opportunity_score(measurements.score.total)';

export type ScoreFormulaKey = 'performance_score' | 'opportunity_score';

/**
 * A derived web vital score the backend computes from every
 * `browser.web_vital.*.score` metric. Its y-axis is fixed and names no metric.
 */
export interface ScoreFormula {
  description: string;
  key: ScoreFormulaKey;
  yAxis: string;
}

export const SCORE_FORMULAS: readonly ScoreFormula[] = [
  {
    key: 'performance_score',
    yAxis: PERFORMANCE_SCORE_FIELD,
    description: t(
      'The weighted average of the web vital scores, where only vitals with data contribute their weight.'
    ),
  },
  {
    key: 'opportunity_score',
    yAxis: OPPORTUNITY_SCORE_FIELD,
    description: t(
      'How much the overall performance score would improve if the web vitals in this group were perfect.'
    ),
  },
];

export const DEFAULT_SCORE_FORMULA: ScoreFormula = SCORE_FORMULAS[0]!;

/**
 * A stand-in metric the formulas hang off. Nothing is stored under this name:
 * it exists so the scores have a home in the metric list and the only
 * functions offered on it are the formulas.
 */
export const SCORE_FORMULA_METRIC: TraceMetric = {
  name: 'browser.web_vital',
  type: 'distribution',
  unit: FractionUnit.RATIO,
};

export const SCORE_FORMULA_METRIC_DESCRIPTION = t(
  'Scores derived from every web vital score metric. It has no samples of its own.'
);

/** Every stored web vital metric starts with this, whichever vital it is for. */
export const WEB_VITAL_METRIC_PREFIX = 'browser.web_vital.';

export function isWebVitalMetricName(name: string): boolean {
  return name.startsWith(WEB_VITAL_METRIC_PREFIX);
}

/** The metrics every score formula reads, for queries that need an explicit filter. */
export const SCORE_FORMULA_METRICS: readonly TraceMetric[] = ORDER.map(vital => ({
  name: `browser.web_vital.${vital}.score`,
  type: 'distribution',
  unit: FractionUnit.RATIO,
}));

export function canUseScoreFormulas(organization: Organization): boolean {
  return organization.features.includes('dashboards-web-vitals-trace-metrics');
}

export function isScoreFormulaMetric(traceMetric: Pick<TraceMetric, 'name'>): boolean {
  return traceMetric.name === SCORE_FORMULA_METRIC.name;
}

export function getScoreFormula(yAxis: string): ScoreFormula | undefined {
  return SCORE_FORMULAS.find(formula => formula.yAxis === yAxis);
}

export function getScoreFormulaByKey(key: string): ScoreFormula | undefined {
  return SCORE_FORMULAS.find(formula => formula.key === key);
}

export function isScoreFormulaYAxis(yAxis: string): boolean {
  return getScoreFormula(yAxis) !== undefined;
}

export function isScoreFormulaVisualize(visualize: Visualize): boolean {
  return isVisualizeFunction(visualize) && isScoreFormulaYAxis(visualize.yAxis);
}

export function isScoreFormulaQuery(metricQuery: BaseMetricQuery): boolean {
  const visualize = metricQuery.queryParams.visualizes[0];
  return visualize !== undefined && isScoreFormulaVisualize(visualize);
}
