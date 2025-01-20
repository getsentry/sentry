import round from 'lodash/round';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {SessionFieldWithOperation} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import toArray from 'sentry/utils/array/toArray';
import {getUtcDateString} from 'sentry/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {
  formatMetricUsingFixedUnit,
  formatMetricUsingUnit,
} from 'sentry/utils/metrics/formatters';
import {parseField, parseMRI} from 'sentry/utils/metrics/mri';
import {
  Dataset,
  Datasource,
  EventTypes,
  SessionsAggregate,
} from 'sentry/views/alerts/rules/metric/types';
import {isCustomMetricAlert} from 'sentry/views/alerts/rules/metric/utils/isCustomMetricAlert';

import type {CombinedAlerts, Incident, IncidentStats} from '../types';
import {AlertRuleStatus, CombinedAlertType} from '../types';

/**
 * Gets start and end date query parameters from stats
 */
export function getStartEndFromStats(stats: IncidentStats) {
  const start = getUtcDateString(stats.eventStats.data[0]![0] * 1000);
  const end = getUtcDateString(
    stats.eventStats.data[stats.eventStats.data.length - 1]![0] * 1000
  );

  return {start, end};
}

export function isIssueAlert(data: CombinedAlerts) {
  return data.type === CombinedAlertType.ISSUE;
}

export const DATA_SOURCE_LABELS = {
  [Dataset.ERRORS]: t('Errors'),
  [Dataset.TRANSACTIONS]: t('Transactions'),
  [Datasource.ERROR_DEFAULT]: 'event.type:error OR event.type:default',
  [Datasource.ERROR]: 'event.type:error',
  [Datasource.DEFAULT]: 'event.type:default',
  [Datasource.TRANSACTION]: 'event.type:transaction',
};

// Maps a datasource to the relevant dataset and event_types for the backend to use
export const DATA_SOURCE_TO_SET_AND_EVENT_TYPES = {
  [Datasource.ERROR_DEFAULT]: {
    dataset: Dataset.ERRORS,
    eventTypes: [EventTypes.ERROR, EventTypes.DEFAULT],
  },
  [Datasource.ERROR]: {
    dataset: Dataset.ERRORS,
    eventTypes: [EventTypes.ERROR],
  },
  [Datasource.DEFAULT]: {
    dataset: Dataset.ERRORS,
    eventTypes: [EventTypes.DEFAULT],
  },
  [Datasource.TRANSACTION]: {
    dataset: Dataset.TRANSACTIONS,
    eventTypes: [EventTypes.TRANSACTION],
  },
};

// Converts the given dataset and event types array to a datasource for the datasource dropdown
export function convertDatasetEventTypesToSource(
  dataset: Dataset,
  eventTypes: EventTypes[]
) {
  // transactions and generic_metrics only have one datasource option regardless of event type
  if (dataset === Dataset.TRANSACTIONS || dataset === Dataset.GENERIC_METRICS) {
    return Datasource.TRANSACTION;
  }
  // if no event type was provided use the default datasource
  if (!eventTypes) {
    return Datasource.ERROR;
  }

  if (eventTypes.includes(EventTypes.DEFAULT) && eventTypes.includes(EventTypes.ERROR)) {
    return Datasource.ERROR_DEFAULT;
  }
  if (eventTypes.includes(EventTypes.DEFAULT)) {
    return Datasource.DEFAULT;
  }
  return Datasource.ERROR;
}

/**
 * Attempt to guess the data source of a discover query
 *
 * @returns An object containing the datasource and new query without the datasource.
 * Returns null on no datasource.
 */
export function getQueryDatasource(
  query: string
): {query: string; source: Datasource} | null {
  let match = query.match(
    /\(?\bevent\.type:(error|default|transaction)\)?\WOR\W\(?event\.type:(error|default|transaction)\)?/i
  );
  if (match) {
    // should be [error, default] or [default, error]
    const eventTypes = match.slice(1, 3).sort().join(',');
    if (eventTypes !== 'default,error') {
      return null;
    }

    return {source: Datasource.ERROR_DEFAULT, query: query.replace(match[0], '').trim()};
  }

  match = query.match(/(^|\s)event\.type:(error|default|transaction)/i);
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  if (match && Datasource[match[2]!.toUpperCase()]) {
    return {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      source: Datasource[match[2]!.toUpperCase()],
      query: query.replace(match[0], '').trim(),
    };
  }

  return null;
}

export function isSessionAggregate(aggregate: string) {
  return Object.values(SessionsAggregate).includes(aggregate as SessionsAggregate);
}

export const SESSION_AGGREGATE_TO_FIELD = {
  [SessionsAggregate.CRASH_FREE_SESSIONS]: SessionFieldWithOperation.SESSIONS,
  [SessionsAggregate.CRASH_FREE_USERS]: SessionFieldWithOperation.USERS,
};

export function alertAxisFormatter(value: number, seriesName: string, aggregate: string) {
  if (isSessionAggregate(aggregate)) {
    return defined(value) ? `${round(value, 2)}%` : '\u2015';
  }

  if (isCustomMetricAlert(aggregate)) {
    const {mri, aggregation} = parseField(aggregate)!;
    const {unit} = parseMRI(mri)!;
    return formatMetricUsingFixedUnit(value, unit, aggregation);
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

  if (isCustomMetricAlert(aggregate)) {
    const {mri, aggregation} = parseField(aggregate)!;
    const {unit} = parseMRI(mri)!;
    return formatMetricUsingFixedUnit(value, unit, aggregation);
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
  return `/organizations/${organization.slug}/alerts/rules/details/${
    incident.alertRule.status === AlertRuleStatus.SNAPSHOT &&
    incident.alertRule.originalAlertRuleId
      ? incident.alertRule.originalAlertRuleId
      : incident.alertRule.id
  }/`;
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
