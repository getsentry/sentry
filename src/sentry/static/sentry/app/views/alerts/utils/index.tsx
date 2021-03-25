import {Client} from 'app/api';
import {t} from 'app/locale';
import {NewQuery, Project} from 'app/types';
import {IssueAlertRule} from 'app/types/alerts';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {ALERT_RULE_PRESET_AGGREGATES} from 'app/views/settings/incidentRules/incidentRulePresets';
import {PRESET_AGGREGATES} from 'app/views/settings/incidentRules/presets';
import {
  Dataset,
  Datasource,
  EventTypes,
  IncidentRule,
  SavedIncidentRule,
} from 'app/views/settings/incidentRules/types';

import {Incident, IncidentStats, IncidentStatus} from '../types';

// Use this api for requests that are getting cancelled
const uncancellableApi = new Client();

export function fetchAlertRule(orgId: string, ruleId: string): Promise<IncidentRule> {
  return uncancellableApi.requestPromise(
    `/organizations/${orgId}/alert-rules/${ruleId}/`
  );
}

export function fetchIncidentsForRule(
  orgId: string,
  alertRule: string,
  start: string,
  end: string
): Promise<Incident[]> {
  return uncancellableApi.requestPromise(`/organizations/${orgId}/incidents/`, {
    query: {alertRule, start, end, expand: ['activities', 'seen_by']},
  });
}

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

export function getIncidentRuleMetricPreset(rule?: IncidentRule) {
  const aggregate = rule?.aggregate ?? '';
  const dataset = rule?.dataset ?? Dataset.ERRORS;

  return ALERT_RULE_PRESET_AGGREGATES.find(
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
  data: IssueAlertRule | SavedIncidentRule | IncidentRule
): data is IssueAlertRule {
  return !data.hasOwnProperty('triggers');
}

export const DATA_SOURCE_LABELS = {
  [Dataset.ERRORS]: t('Errors'),
  [Dataset.TRANSACTIONS]: t('Transactions'),
  [Datasource.ERROR_DEFAULT]: t('event.type:error OR event.type:default'),
  [Datasource.ERROR]: t('event.type:error'),
  [Datasource.DEFAULT]: t('event.type:default'),
  [Datasource.TRANSACTION]: t('event.type:transaction'),
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
  // transactions only has one datasource option regardless of event type
  if (dataset === Dataset.TRANSACTIONS) {
    return Datasource.TRANSACTION;
  }
  // if no event type was provided use the default datasource
  if (!eventTypes) {
    return Datasource.ERROR;
  }

  if (eventTypes.includes(EventTypes.DEFAULT) && eventTypes.includes(EventTypes.ERROR)) {
    return Datasource.ERROR_DEFAULT;
  } else if (eventTypes.includes(EventTypes.DEFAULT)) {
    return Datasource.DEFAULT;
  } else {
    return Datasource.ERROR;
  }
}

/**
 * Attempt to guess the data source of a discover query
 *
 * @returns An object containing the datasource and new query without the datasource.
 * Returns null on no datasource.
 */
export function getQueryDatasource(
  query: string
): {source: Datasource; query: string} | null {
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
  if (match && Datasource[match[2].toUpperCase()]) {
    return {
      source: Datasource[match[2].toUpperCase()],
      query: query.replace(match[0], '').trim(),
    };
  }

  return null;
}
