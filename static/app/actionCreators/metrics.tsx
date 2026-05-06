import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {DateString} from 'sentry/types/core';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';

type DoReleaseHealthRequestOptions = {
  field: string[];
  orgSlug: Organization['slug'];
  cursor?: string;
  end?: DateString;
  environment?: readonly string[];
  groupBy?: string[];
  includeSeries?: number;
  includeTotals?: number;
  interval?: string;
  limit?: number;
  orderBy?: string;
  project?: readonly number[];
  query?: string;
  start?: DateString;
  statsPeriod?: string | null;
  statsPeriodEnd?: string;
  statsPeriodStart?: string;
};

function buildReleaseHealthUrlQuery({
  field,
  cursor,
  environment,
  groupBy,
  includeSeries,
  includeTotals,
  interval,
  limit,
  orderBy,
  project,
  query,
  statsPeriodStart,
  statsPeriodEnd,
  ...dateTime
}: Omit<DoReleaseHealthRequestOptions, 'orgSlug'>): Record<string, unknown> {
  const {start, end, statsPeriod} = normalizeDateTimeParams(dateTime, {
    allowEmptyPeriod: true,
  });

  return Object.fromEntries(
    Object.entries({
      field: field.filter(f => !!f),
      cursor,
      end,
      environment,
      groupBy: groupBy?.filter(g => !!g),
      includeSeries,
      includeTotals,
      interval: interval || getInterval({start, end, period: statsPeriod}),
      query: query || undefined,
      per_page: limit,
      project,
      orderBy,
      start,
      statsPeriod,
      statsPeriodStart,
      statsPeriodEnd,
    }).filter(([, value]) => defined(value) && value !== '')
  );
}

export function releaseHealthApiOptions({
  orgSlug,
  ...options
}: DoReleaseHealthRequestOptions) {
  return apiOptions.as<SessionApiResponse>()(
    '/organizations/$organizationIdOrSlug/metrics/data/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: buildReleaseHealthUrlQuery(options),
      staleTime: 0,
    }
  );
}
