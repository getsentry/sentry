import round from 'lodash/round';

import type {Organization} from 'sentry/types/organization';
import {SessionFieldWithOperation} from 'sentry/types/organization';
import {toArray} from 'sentry/utils/array/toArray';
import {defined} from 'sentry/utils/defined';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {formatMetricUsingUnit} from 'sentry/utils/number/formatMetricUsingUnit';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {SessionsAggregate} from 'sentry/views/alerts/rules/metric/types';
import type {Incident} from 'sentry/views/alerts/types';
import {AlertRuleStatus} from 'sentry/views/alerts/types';

export function hasMetricAlerts(organization: Organization): boolean {
  return organization.features.includes('incidents');
}

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

export function alertDetailsLink(organization: Organization, incident: Incident) {
  return makeAlertsPathname({
    path: `/rules/details/${
      incident.alertRule.status === AlertRuleStatus.SNAPSHOT &&
      incident.alertRule.originalAlertRuleId
        ? incident.alertRule.originalAlertRuleId
        : incident.alertRule.id
    }/`,
    organization,
  });
}

/**
 * Noramlizes a status string
 */
export function getQueryStatus(status: string | string[]): string {
  if (Array.isArray(status) || status === '') {
    return 'all';
  }

  return ['open', 'closed'].includes(status) ? status : 'all';
}

const ALERT_LIST_QUERY_DEFAULT_TEAMS = ['myteams', 'unassigned'];

/**
 * Noramlize a team slug from the query
 */
export function getTeamParams(team?: string | string[]): string[] {
  if (team === undefined) {
    return ALERT_LIST_QUERY_DEFAULT_TEAMS;
  }

  if (team === '') {
    return [];
  }

  return toArray(team);
}
