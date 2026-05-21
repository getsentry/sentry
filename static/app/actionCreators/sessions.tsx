import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {DateString} from 'sentry/types/core';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';

type DoSessionsRequestOptions = {
  field: string[];
  orgSlug: Organization['slug'];
  cursor?: string;
  end?: DateString;
  environment?: readonly string[];
  groupBy?: string[];
  includeSeries?: boolean;
  includeTotals?: boolean;
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

export function sessionsApiOptions({
  field,
  orgSlug,
  cursor,
  environment,
  groupBy,
  interval,
  project,
  orderBy,
  query,
  includeSeries,
  includeTotals,
  statsPeriodStart,
  statsPeriodEnd,
  limit,
  ...dateTime
}: DoSessionsRequestOptions) {
  const {start, end, statsPeriod} = normalizeDateTimeParams(dateTime, {
    allowEmptyPeriod: true,
  });

  const urlQuery = Object.fromEntries(
    Object.entries({
      field: field.filter(f => !!f),
      cursor,
      end,
      environment,
      groupBy: groupBy?.filter(g => !!g),
      interval: interval || getInterval({start, end, period: statsPeriod}),
      orderBy,
      per_page: limit,
      query: query || undefined,
      project,
      start,
      statsPeriod,
      statsPeriodStart,
      statsPeriodEnd,
      includeSeries: includeSeries === false ? '0' : '1',
      includeTotals: includeTotals === false ? '0' : '1',
    }).filter(([, value]) => defined(value) && value !== '')
  );

  return apiOptions.as<SessionApiResponse>()(
    '/organizations/$organizationIdOrSlug/sessions/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: urlQuery,
      staleTime: 0,
    }
  );
}
