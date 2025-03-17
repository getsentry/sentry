import type {NewQuery, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import type {SavedQueryDatasets} from 'sentry/utils/discover/types';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {Dataset, TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {DEFAULT_PROJECT_THRESHOLD} from 'sentry/views/performance/data';

interface MetricRuleDiscoverUrlOptions {
  organization: Organization;
  projects: Project[];
  timePeriod: Omit<TimePeriodType, 'display' | 'label'>;
  extraQueryParams?: Partial<NewQuery>;
  openInDiscoverDataset?: SavedQueryDatasets;
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
  organization,
  openInDiscoverDataset,
  ...rest
}: MetricRuleDiscoverUrlOptions) {
  const discoverView = getMetricRuleDiscoverQuery(rest);
  if (!discoverView || !rest.rule) {
    return '';
  }

  const {query, ...toObject} = discoverView.getResultsViewUrlTarget(
    organization,
    false,
    hasDatasetSelector(organization) ? openInDiscoverDataset : undefined
  );
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
}: Omit<MetricRuleDiscoverUrlOptions, 'organization' | 'openInDiscoverDataset'>) {
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
    name: rule?.name || 'Transactions',
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
