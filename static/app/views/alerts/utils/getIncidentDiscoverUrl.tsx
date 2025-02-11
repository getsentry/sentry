import type {NewQuery, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import type {Incident, IncidentStats} from 'sentry/views/alerts/types';
import {getStartEndFromStats} from 'sentry/views/alerts/utils';
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
  organization: Organization;
  projects: Project[];
  extraQueryParams?: Partial<NewQuery>;
  incident?: Incident;
  stats?: IncidentStats;
}) {
  const {organization, projects, incident, stats, extraQueryParams} = opts;

  if (!projects || !projects.length || !incident || !stats) {
    return '';
  }

  const timeWindowString = `${incident.alertRule.timeWindow}m`;
  const {start, end} = getStartEndFromStats(stats);

  const discoverQuery: NewQuery = {
    id: undefined,
    name: incident?.title || '',
    orderby: `-${getAggregateAlias(incident.alertRule.aggregate)}`,
    yAxis: incident.alertRule.aggregate ? [incident.alertRule.aggregate] : undefined,
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
  const {query, ...toObject} = discoverView.getResultsViewUrlTarget(organization);

  return {
    query: {...query, interval: timeWindowString},
    ...toObject,
  };
}
