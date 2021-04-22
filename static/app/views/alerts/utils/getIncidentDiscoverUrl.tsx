import {NewQuery, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {Incident, IncidentStats} from 'app/views/alerts/types';
import {getStartEndFromStats} from 'app/views/alerts/utils';
import {Dataset} from 'app/views/settings/incidentRules/types';
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
