import moment from 'moment';

import {getUtcDateString} from 'sentry/utils/dates';
import {
  API_INTERVAL_POINTS_LIMIT,
  API_INTERVAL_POINTS_MIN,
} from 'sentry/views/alerts/rules/metric/details/constants';
import type {Incident} from 'sentry/views/alerts/types';

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
