import type {NewQuery, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {Dataset, MetricRule, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {DEFAULT_PROJECT_THRESHOLD} from 'sentry/views/performance/data';

interface MetricRuleDiscoverUrlOptions {
  orgSlug: string;
  projects: Project[];
  timePeriod: Omit<TimePeriodType, 'display' | 'label'>;
  extraQueryParams?: Partial<NewQuery>;
  query?: string;
  rule?: MetricRule;
}

/**
 * Gets the URL for a discover view of the rule with the following default
 * parameters:
 *
 * - Ordered by the rule aggregate, descending
 * - yAxis maps to the aggregate
 * - Start and end are the period's values selected in the chart header
 */
export function getMetricRuleDiscoverUrl({
  orgSlug,
  ...rest
}: MetricRuleDiscoverUrlOptions) {
  const discoverView = getMetricRuleDiscoverQuery(rest);
  if (!discoverView || !rest.rule) {
    return '';
  }

  const {query, ...toObject} = discoverView.getResultsViewUrlTarget(orgSlug);
  const timeWindowString = `${rest.rule.timeWindow}m`;

  return {
    query: {...query, interval: timeWindowString},
    ...toObject,
  };
}

export function getMetricRuleDiscoverQuery({
  projects,
  rule,
  timePeriod,
  query,
  extraQueryParams,
}: Omit<MetricRuleDiscoverUrlOptions, 'orgSlug'>) {
  if (!projects || !projects.length || !rule) {
    return null;
  }

  const aggregateAlias = getAggregateAlias(rule.aggregate);

  const timePeriodFields = timePeriod.usingPeriod
    ? {range: timePeriod.period === TimePeriod.SEVEN_DAYS ? '7d' : timePeriod.period}
    : {start: timePeriod.start, end: timePeriod.end};

  const fields =
    rule.dataset === Dataset.ERRORS
      ? ['issue', 'count()', 'count_unique(user)']
      : [
          'transaction',
          'project',
          `${rule.aggregate}`,
          'count_unique(user)',
          `user_misery(${DEFAULT_PROJECT_THRESHOLD})`,
        ];

  const eventQuery: NewQuery = {
    id: undefined,
    name: (rule && rule.name) || 'Transactions',
    fields,
    orderby: `-${aggregateAlias}`,
    query: query ?? rule.query ?? '',
    version: 2,
    projects: projects
      .filter(({slug}) => rule.projects.includes(slug))
      .map(project => Number(project.id)),
    environment: rule.environment ? [rule.environment] : undefined,
    ...timePeriodFields,
    ...extraQueryParams,
  };

  return EventView.fromSavedQuery(eventQuery);
}
