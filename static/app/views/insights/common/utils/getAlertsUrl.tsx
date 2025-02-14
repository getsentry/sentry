import * as qs from 'query-string';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function getAlertsUrl({
  project,
  query,
  aggregate,
  organization,
  pageFilters,
  name,
  interval,
  dataset = Dataset.GENERIC_METRICS,
}: {
  aggregate: string;
  organization: Organization;
  pageFilters: PageFilters;
  dataset?: Dataset;
  interval?: string;
  name?: string;
  project?: Project;
  query?: string;
}) {
  const statsPeriod = getStatsPeriod(pageFilters);
  const environment = pageFilters.environments;
  const supportedInterval = getInterval(interval);
  const queryParams = {
    aggregate,
    dataset,
    project: project?.slug,
    eventTypes: 'transaction',
    query,
    statsPeriod,
    environment,
    name,
    interval: supportedInterval,
  };

  return (
    makeAlertsPathname({
      path: `/new/metric/`,
      organization,
    }) + `?${qs.stringify(queryParams)}`
  );
}

// Alert rules only support 24h, 3d, 7d, 14d periods
function getStatsPeriod(pageFilters: PageFilters) {
  const {period} = pageFilters.datetime;
  switch (period) {
    case '24h':
    case '3d':
    case '7d':
      return period;
    case '1h':
      return '24h'; // Explore allows 1h, but alerts only allows 24h minimum
    default:
      return '7d';
  }
}

function getInterval(interval?: string) {
  switch (interval) {
    case '5m':
    case '15m':
    case '30m':
    case '1h':
    case '3h':
    case '4h':
    case '6h':
    case '24h':
      return interval;
    case '1m':
      return '5m'; // Explore allows 1m, but alerts only allows 5m minimum
    default:
      return '1h';
  }
}
