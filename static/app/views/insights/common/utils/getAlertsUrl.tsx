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
}: {
  aggregate: string;
  orgSlug: string;
  pageFilters: PageFilters;
  project: Project;
  name?: string;
  query?: string;
}) {
  const statsPeriod = getStatsPeriod(pageFilters);
  const environment = pageFilters.environments;
  const queryParams = {
    aggregate: aggregate,
    dataset: Dataset.GENERIC_METRICS,
    project: project.slug,
    eventTypes: 'transaction',
    query,
    statsPeriod,
    environment,
    name,
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
    default:
      return '7d';
  }
}
