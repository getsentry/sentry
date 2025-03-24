import moment from 'moment-timezone';

import {getInterval} from 'sentry/components/charts/utils';
import {getUtcDateString} from 'sentry/utils/dates';
import {
  API_INTERVAL_POINTS_LIMIT,
  API_INTERVAL_POINTS_MIN,
  TIME_WINDOWS,
  type TimePeriodType,
} from 'sentry/views/alerts/rules/metric/details/constants';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {Dataset, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import type {Incident} from 'sentry/views/alerts/types';

import {isCrashFreeAlert} from '../utils/isCrashFreeAlert';

/**
 * Retrieve start/end date of a metric alert incident for the events graph
 * Will show at least 150 and no more than 10,000 data points
 */
export function buildMetricGraphDateRange(incident: Incident): {
  end: string;
  start: string;
} {
  const timeWindowMillis = incident.alertRule.timeWindow * 60 * 1000;
  const minRange = timeWindowMillis * API_INTERVAL_POINTS_MIN;
  const maxRange = timeWindowMillis * API_INTERVAL_POINTS_LIMIT;
  const now = moment.utc();
  const startDate = moment.utc(incident.dateStarted);
  // make a copy of now since we will modify endDate and use now for comparing
  const endDate = incident.dateClosed ? moment.utc(incident.dateClosed) : moment(now);
  const incidentRange = Math.max(endDate.diff(startDate), 3 * timeWindowMillis);
  const range = Math.min(maxRange, Math.max(minRange, incidentRange));
  const halfRange = moment.duration(range / 2);

  return {
    start: getUtcDateString(startDate.subtract(halfRange)),
    end: getUtcDateString(moment.min(endDate.add(halfRange), now)),
  };
}

export function getPeriodInterval(timePeriod: TimePeriodType, rule: MetricRule) {
  const startDate = moment.utc(timePeriod.start);
  const endDate = moment.utc(timePeriod.end);
  const timeWindow = rule?.timeWindow;
  const startEndDifferenceMs = endDate.diff(startDate);

  if (
    timeWindow &&
    (startEndDifferenceMs < API_INTERVAL_POINTS_LIMIT * timeWindow * 60 * 1000 ||
      // Special case 7 days * 1m interval over the api limit
      startEndDifferenceMs === TIME_WINDOWS[TimePeriod.SEVEN_DAYS])
  ) {
    return `${timeWindow}m`;
  }

  return getInterval({start: timePeriod.start, end: timePeriod.end}, 'high');
}

export function getFilter(rule: MetricRule): string[] | null {
  const {dataset, query} = rule;

  if (isCrashFreeAlert(dataset) || dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return query.trim().split(' ');
  }

  const eventType = extractEventTypeFilterFromRule(rule);
  return (query ? `(${eventType}) AND (${query.trim()})` : eventType).split(' ');
}

export function getViableDateRange({
  interval,
  rule: {timeWindow, dataset},
  timePeriod: rawTimePeriod,
}: {
  interval: string;
  rule: MetricRule;
  timePeriod: TimePeriodType;
}) {
  const timePeriod = {...rawTimePeriod};

  // Fix for 7 days * 1m interval being over the max number of results from events api
  // 10k events is the current max
  if (
    timePeriod.usingPeriod &&
    timePeriod.period === TimePeriod.SEVEN_DAYS &&
    interval === '1m'
  ) {
    timePeriod.start = getUtcDateString(
      // -5 minutes provides a small cushion for rounding up minutes. This might be able to be smaller
      moment(moment.utc(timePeriod.end).subtract(10000 - 5, 'minutes'))
    );
  }

  // If the chart duration isn't as long as the rollup duration the events-stats
  // endpoint will return an invalid timeseriesData dataset
  let viableStartDate = getUtcDateString(
    moment.min(
      moment.utc(timePeriod.start),
      moment.utc(timePeriod.end).subtract(timeWindow, 'minutes')
    )
  );

  // Events Analytics Platform Span queries only support up to 2016 buckets.
  // 14 day 10m and 7 day 5m interval queries actually exceed this limit because we always extend the end date by an extra bucket.
  // We push forward the start date by a bucket to counteract this and return to 2016 buckets.
  if (
    dataset === Dataset.EVENTS_ANALYTICS_PLATFORM &&
    timePeriod.usingPeriod &&
    ((timePeriod.period === TimePeriod.FOURTEEN_DAYS && interval === '10m') ||
      (timePeriod.period === TimePeriod.SEVEN_DAYS && interval === '5m'))
  ) {
    viableStartDate = getUtcDateString(
      moment.utc(viableStartDate).add(timeWindow, 'minutes')
    );
  }

  const viableEndDate = getUtcDateString(
    moment.utc(timePeriod.end).add(timeWindow, 'minutes')
  );
  return {
    start: viableStartDate,
    end: viableEndDate,
  };
}
