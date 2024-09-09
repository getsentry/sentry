import * as qs from 'query-string';

import type {Project} from 'sentry/types/project';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function getAlertsUrl({
  project,
  query,
  aggregate,
  orgSlug,
}: {
  aggregate: string;
  orgSlug: string;
  project: Project;
  query?: string;
}) {
  const queryParams = {
    aggregate: aggregate,
    dataset: Dataset.GENERIC_METRICS,
    project: project.slug,
    eventTypes: 'transaction',
    query,
  };
  return normalizeUrl(
    `/organizations/${orgSlug}/alerts/new/metric/?${qs.stringify(queryParams)}`
  );
}
