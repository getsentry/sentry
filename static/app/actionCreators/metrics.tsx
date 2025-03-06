import type {ApiResult, Client} from 'sentry/api';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {DateString} from 'sentry/types/core';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

export type DoReleaseHealthRequestOptions = {
  field: string[];
  orgSlug: Organization['slug'];
  cursor?: string;
  end?: DateString;
  environment?: readonly string[];
  groupBy?: string[];
  includeAllArgs?: boolean;
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

export const doReleaseHealthRequest = (
  api: Client,
  {
    field,
    orgSlug,
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
    includeAllArgs = false,
    statsPeriodStart,
    statsPeriodEnd,
    ...dateTime
  }: DoReleaseHealthRequestOptions
): Promise<ApiResult<SessionApiResponse>> => {
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

  const pathname = `/organizations/${orgSlug}/metrics/data/`;

  return api.requestPromise(pathname, {includeAllArgs, query: urlQuery});
};
