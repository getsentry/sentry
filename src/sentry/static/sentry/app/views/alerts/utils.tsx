import {Client} from 'app/api';
import {t} from 'app/locale';
import {Project, NewQuery} from 'app/types';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {Dataset, SavedIncidentRule} from 'app/views/settings/incidentRules/types';
import {PRESET_AGGREGATES} from 'app/views/settings/incidentRules/presets';
import {IssueAlertRule} from 'app/types/alerts';

import {Incident, IncidentStats, IncidentStatus} from './types';

export function fetchIncident(
  api: Client,
  orgId: string,
  alertId: string
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/`);
}

export function fetchIncidentStats(
  api: Client,
  orgId: string,
  alertId: string
): Promise<IncidentStats> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/stats/`);
}

export function updateSubscription(
  api: Client,
  orgId: string,
  alertId: string,
  isSubscribed?: boolean
): Promise<Incident> {
  const method = isSubscribed ? 'POST' : 'DELETE';
  return api.requestPromise(
    `/organizations/${orgId}/incidents/${alertId}/subscriptions/`,
    {
      method,
    }
  );
}

export function updateStatus(
  api: Client,
  orgId: string,
  alertId: string,
  status: IncidentStatus
): Promise<Incident> {
  return api.requestPromise(`/organizations/${orgId}/incidents/${alertId}/`, {
    method: 'PUT',
    data: {
      status,
    },
  });
}

/**
 * Is incident open?
 *
 * @param {Object} incident Incident object
 * @returns {Boolean}
 */
export function isOpen(incident: Incident): boolean {
  switch (incident.status) {
    case IncidentStatus.CLOSED:
      return false;
    default:
      return true;
  }
}

export function getIncidentMetricPreset(incident: Incident) {
  const alertRule = incident?.alertRule;
  const aggregate = alertRule?.aggregate ?? '';
  const dataset = alertRule?.dataset ?? Dataset.ERRORS;

  return PRESET_AGGREGATES.find(
    p => p.validDataset.includes(dataset) && p.match.test(aggregate)
  );
}

/**
 * Gets start and end date query parameters from stats
 */
export function getStartEndFromStats(stats: IncidentStats) {
  const start = getUtcDateString(stats.eventStats.data[0][0] * 1000);
  const end = getUtcDateString(
    stats.eventStats.data[stats.eventStats.data.length - 1][0] * 1000
  );

  return {start, end};
}

/**
 * Gets the URL for a discover view of the incident with the following default
 * parameters:
 *
 * - Ordered by the incident aggregate, descending
 * - yAxis maps to the aggregate
 * - The following fields are displayed:
 *   - For Error dataset alerts: [issue, count(), count_unique(user)]
 *   - For Transaction dataset alerts: [transaction, count()]
 * - Start and end are scoped to the same period as the alert rule
 */
export function getIncidentDiscoverUrl(opts: {
  orgSlug: string;
  projects: Project[];
  incident?: Incident;
  stats?: IncidentStats;
  extraQueryParams?: Partial<NewQuery>;
}) {
  const {orgSlug, projects, incident, stats, extraQueryParams} = opts;

  if (!projects || !projects.length || !incident || !stats) {
    return '';
  }

  const timeWindowString = `${incident.alertRule.timeWindow}m`;
  const {start, end} = getStartEndFromStats(stats);

  const discoverQuery: NewQuery = {
    id: undefined,
    name: (incident && incident.title) || '',
    orderby: `-${getAggregateAlias(incident.alertRule.aggregate)}`,
    yAxis: incident.alertRule.aggregate,
    query: incident?.discoverQuery ?? '',
    projects: projects
      .filter(({slug}) => incident.projects.includes(slug))
      .map(({id}) => Number(id)),
    version: 2,
    fields:
      incident.alertRule.dataset === Dataset.ERRORS
        ? ['issue', 'count()', 'count_unique(user)']
        : ['transaction', incident.alertRule.aggregate],
    start,
    end,
    ...extraQueryParams,
  };

  const discoverView = EventView.fromSavedQuery(discoverQuery);
  const {query, ...toObject} = discoverView.getResultsViewUrlTarget(orgSlug);

  return {
    query: {...query, interval: timeWindowString},
    ...toObject,
  };
}

export function isIssueAlert(
  data: IssueAlertRule | SavedIncidentRule
): data is IssueAlertRule {
  return !data.hasOwnProperty('triggers');
}

export const DATA_SOURCE_LABELS = {
  [Dataset.ERRORS]: t('Errors'),
  [Dataset.TRANSACTIONS]: t('Transactions'),
};
