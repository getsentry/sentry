import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {t} from 'sentry/locale';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

/**
 * Intervals (in seconds) that metric monitors support, so the anomaly
 * detection endpoint can score them.
 */
const SUPPORTED_INTERVAL_SECONDS = new Set([
  5 * 60,
  10 * 60,
  15 * 60,
  30 * 60,
  60 * 60,
  2 * 60 * 60,
  4 * 60 * 60,
  24 * 60 * 60,
]);

const MAX_RANGE_MINUTES = 7 * 24 * 60;

interface AnomalyDetectionChartState {
  datetime: DateTimeObject;
  groupBys: readonly string[];
  /**
   * The chart's interval, e.g. `5m`, `1h`
   */
  interval: string;
  projects: readonly number[];
  /**
   * Number of aggregate functions plotted on the chart
   */
  yAxisCount: number;
}

/**
 * Returns why anomaly detection can't run for a chart, or `null` when it can.
 */
export function getAnomalyDetectionDisabledReason({
  datetime,
  groupBys,
  interval,
  projects,
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
  if (!SUPPORTED_INTERVAL_SECONDS.has(intervalToMilliseconds(interval) / 1000)) {
    return t('Use a 5m, 10m, 15m, 30m, 1h, 2h, 4h or 1d interval');
  }
  if (getDiffInMinutes(datetime) > MAX_RANGE_MINUTES) {
    return t('Select a time range of 7 days or less');
  }
  return null;
}
