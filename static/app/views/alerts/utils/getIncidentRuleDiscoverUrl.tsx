import {NewQuery, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {Dataset, IncidentRule} from 'sentry/views/alerts/incidentRules/types';
/**
 * Gets the URL for a discover view of the rule with the following default
 * parameters:
 *
 * - Ordered by the rule aggregate, descending
 * - yAxis maps to the aggregate
 * - The following fields are displayed:
 *   - For Error dataset alert rules: [issue, count(), count_unique(user)]
 *   - For Transaction dataset alert rules: [transaction, count()]
 * - Start and end are the period's values selected in the chart header
 */
export function getIncidentRuleDiscoverUrl(opts: {
  orgSlug: string;
  projects: Project[];
  end?: string;
  eventType?: string;
  extraQueryParams?: Partial<NewQuery>;
  fields?: string[];
  rule?: IncidentRule;
  start?: string;
}) {
  const {orgSlug, projects, rule, eventType, start, end, extraQueryParams, fields} = opts;
  const eventTypeTagFilter = eventType && rule?.query ? eventType : '';

  if (!projects || !projects.length || !rule || (!start && !end)) {
    return '';
  }

  const timeWindowString = `${rule.timeWindow}m`;

  const discoverQuery: NewQuery = {
    id: undefined,
    name: (rule && rule.name) || '',
    orderby: `-${getAggregateAlias(rule.aggregate)}`,
    yAxis: rule.aggregate ? [rule.aggregate] : undefined,
    query: (eventTypeTagFilter || rule?.query || eventType) ?? '',
    projects: projects
      .filter(({slug}) => rule.projects.includes(slug))
      .map(({id}) => Number(id)),
    version: 2,
    fields: fields
      ? fields
      : rule.dataset === Dataset.ERRORS
      ? ['issue', 'count()', 'count_unique(user)']
      : ['transaction', rule.aggregate],
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
