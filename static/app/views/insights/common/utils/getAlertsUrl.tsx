import * as qs from 'query-string';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {getMetricMonitorUrl} from 'sentry/views/insights/common/utils/getMetricMonitorUrl';

export function getAlertsUrl({
  project,
  query,
  aggregate,
  organization,
  pageFilters,
  name,
  dataset = Dataset.GENERIC_METRICS,
  eventTypes,
  referrer,
}: {
  aggregate: string;
  organization: Organization;
  pageFilters: PageFilters;
  dataset?: Dataset;
  eventTypes?: EventTypes[];
  interval?: string;
  name?: string;
  project?: Project;
  query?: string;
  referrer?: string;
}) {
  const environment = pageFilters.environments;
  const loc = getMetricMonitorUrl({
    project,
    environment,
    aggregate,
    dataset,
    organization,
    name,
    query,
    referrer,
    eventTypes,
  });
  return `${loc.pathname}?${qs.stringify(loc.query)}`;
}
