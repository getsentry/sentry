import type {Client} from 'sentry/api';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {DateString} from 'sentry/types/core';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

export type DoSessionsRequestOptions = {
  field: string[];
  orgSlug: Organization['slug'];
  cursor?: string;
  end?: DateString;
  environment?: readonly string[];
  groupBy?: string[];
  includeAllArgs?: boolean;
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

export const doSessionsRequest = (
  api: Client,
  {
    field,
    orgSlug,
    cursor,
    environment,
    groupBy,
    interval,
    project,
    orderBy,
    query,
    includeAllArgs = false,
    includeSeries,
    includeTotals,
    statsPeriodStart,
    statsPeriodEnd,
    limit,
    ...dateTime
  }: DoSessionsRequestOptions
): Promise<SessionApiResponse> => {
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

  return api.requestPromise(`/organizations/${orgSlug}/sessions/`, {
    includeAllArgs,
    query: urlQuery,
  });
};
