import round from 'lodash/round';

import {SessionFieldWithOperation} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {formatMetricUsingUnit} from 'sentry/utils/number/formatMetricUsingUnit';
import {SessionsAggregate} from 'sentry/views/alerts/rules/metric/types';

// Maps a datasource to the relevant dataset and event_types for the backend to use

export function isSessionAggregate(aggregate: string) {
  return Object.values(SessionsAggregate).includes(aggregate as SessionsAggregate);
}

export const SESSION_AGGREGATE_TO_FIELD: Record<string, SessionFieldWithOperation> = {
  [SessionsAggregate.CRASH_FREE_SESSIONS]: SessionFieldWithOperation.SESSIONS,
  [SessionsAggregate.CRASH_FREE_USERS]: SessionFieldWithOperation.USERS,
};

export function alertAxisFormatter(value: number, seriesName: string, aggregate: string) {
  if (isSessionAggregate(aggregate)) {
    return defined(value) ? `${round(value, 2)}%` : '\u2015';
  }

  const type = aggregateOutputType(seriesName);

  if (type === 'duration') {
    return formatMetricUsingUnit(value, 'milliseconds');
  }

  return axisLabelFormatter(value, type);
}

export function alertTooltipValueFormatter(
  value: number,
  seriesName: string,
  aggregate: string
) {
  if (isSessionAggregate(aggregate)) {
    return defined(value) ? `${value}%` : '\u2015';
  }

  return tooltipFormatter(value, aggregateOutputType(seriesName));
}

export const ALERT_CHART_MIN_MAX_BUFFER = 1.03;

export function shouldScaleAlertChart(aggregate: string) {
  // We want crash free rate charts to be scaled because they are usually too
  // close to 100% and therefore too fine to see the spikes on 0%-100% scale.
  return isSessionAggregate(aggregate);
}
