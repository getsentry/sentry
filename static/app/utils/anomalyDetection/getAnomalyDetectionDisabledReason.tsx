import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {t} from 'sentry/locale';

import {hasSmoothing} from './anomalyTransformations';

/**
 * Seer's smallest interval. A shorter range wouldn't have a single bucket.
 */
const MIN_RANGE_MINUTES = 5;

interface AnomalyDetectionChartState {
  datetime: DateTimeObject;
  groupBys: readonly string[];
  projects: readonly number[];
  /**
   * The chart's fill and smooth transformations
   */
  transformations: readonly string[];
  /**
   * Number of aggregate functions plotted on the chart
   */
  yAxisCount: number;
}

/**
 * Returns why anomaly detection can't run for a chart, or `null` when it can.
 * Any interval and range works: see `getAnomalyScoringPlan` for how charts
 * Seer can't score as-is are handled.
 */
export function getAnomalyDetectionDisabledReason({
  datetime,
  groupBys,
  projects,
  transformations,
  yAxisCount,
}: AnomalyDetectionChartState): string | null {
  // An empty selection means "My Projects", which can be several projects.
  if (projects.length !== 1 || projects[0] === ALL_ACCESS_PROJECTS) {
    return t('Select a single project');
  }
  if (groupBys.some(groupBy => groupBy !== '')) {
    return t('Remove the group by');
  }
  if (yAxisCount > 1) {
    return t('Plot a single function');
  }
  if (getDiffInMinutes(datetime) < MIN_RANGE_MINUTES) {
    return t('Select a time range of at least 5 minutes');
  }
  if (hasSmoothing(transformations)) {
    return t('Remove smoothing to detect anomalies');
  }
  return null;
}
