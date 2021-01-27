import {NewQuery, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {Dataset, IncidentRule} from 'app/views/settings/incidentRules/types';
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
  rule?: IncidentRule;
  start?: string;
  end?: string;
  extraQueryParams?: Partial<NewQuery>;
}) {
  const {orgSlug, projects, rule, start, end, extraQueryParams} = opts;

  if (!projects || !projects.length || !rule || (!start && !end)) {
    return '';
  }

  const timeWindowString = `${rule.timeWindow}m`;

  const discoverQuery: NewQuery = {
    id: undefined,
    name: (rule && rule.name) || '',
    orderby: `-${getAggregateAlias(rule.aggregate)}`,
    yAxis: rule.aggregate,
    query: rule?.query ?? '',
    projects: projects
      .filter(({slug}) => rule.projects.includes(slug))
      .map(({id}) => Number(id)),
    version: 2,
    fields:
      rule.dataset === Dataset.ERRORS
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
