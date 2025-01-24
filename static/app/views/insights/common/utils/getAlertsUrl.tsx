import * as qs from 'query-string';

import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function getAlertsUrl({
  project,
  query,
  aggregate,
  orgSlug,
  pageFilters,
  name,
  interval,
  dataset = Dataset.GENERIC_METRICS,
}: {
  aggregate: string;
  orgSlug: string;
  pageFilters: PageFilters;
  dataset?: Dataset;
  interval?: string;
  name?: string;
  project?: Project;
  query?: string;
}) {
  const statsPeriod = getStatsPeriod(pageFilters);
  const environment = pageFilters.environments;
  const queryParams = {
    aggregate,
    dataset,
    project: project?.slug,
    eventTypes: 'transaction',
    query,
    statsPeriod,
    environment,
    name,
    interval,
  };
  return normalizeUrl(
    `/organizations/${orgSlug}/alerts/new/metric/?${qs.stringify(queryParams)}`
  );
}

// Alert rules only support 24h, 3d, 7d, 14d periods
function getStatsPeriod(pageFilters: PageFilters) {
  const {period} = pageFilters.datetime;
  switch (period) {
    case '24h':
    case '3d':
    case '7d':
    case '14d':
      return period;
    case '1h':
      return '24h'; // Explore allows 1h, but alerts only allows 24h minimum
    default:
      return '7d';
  }
}
