import {Client, ResponseMeta} from 'sentry/api';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DateString, MetricsApiResponse, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getDateTimeParams, getMetricsInterval, parseMRI} from 'sentry/utils/metrics';

export type DoReleaseHealthRequestOptions = {
  field: string[];
  orgSlug: Organization['slug'];
  cursor?: string;
  end?: DateString;
  environment?: Readonly<string[]>;
  groupBy?: string[];
  includeAllArgs?: boolean;
  includeSeries?: number;
  includeTotals?: number;
  interval?: string;
  limit?: number;
  orderBy?: string;
  project?: Readonly<number[]>;
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
): Promise<MetricsApiResponse | [MetricsApiResponse, string, ResponseMeta]> => {
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

export type DoMetricsRequestOptions = {
  field: string[];
  orgSlug: Organization['slug'];
  cursor?: string;
  end?: DateString;
  environment?: Readonly<string[]>;
  groupBy?: string[];
  includeAllArgs?: boolean;
  includeSeries?: number;
  includeTotals?: number;
  interval?: string;
  limit?: number;
  orderBy?: string;
  project?: Readonly<number[]>;
  query?: string;
  start?: DateString;
  statsPeriod?: string | null;
  statsPeriodEnd?: string;
  statsPeriodStart?: string;
};

export const doMetricsRequest = (
  api: Client,
  {
    field,
    orgSlug,
    environment,
    groupBy,
    interval,
    limit,
    project,
    query,
    includeAllArgs = false,
    ...dateTime
  }: DoReleaseHealthRequestOptions
): Promise<MetricsApiResponse | [MetricsApiResponse, string, ResponseMeta]> => {
  const {useCase} = parseMRI(field[0]) ?? {useCase: 'custom'};

  const {start, end, statsPeriod, utc} = normalizeDateTimeParams(dateTime, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: true,
    allowAbsolutePageDatetime: true,
  });

  // @ts-expect-error
  const datetime = getDateTimeParams({start, end, period: statsPeriod, utc});

  const metricsInterval = getMetricsInterval(datetime, useCase);

  const urlQuery = {
    ...datetime,
    query,
    project,
    environment,
    field,
    useCase,
    interval: interval || metricsInterval,
    groupBy,
    per_page: limit,
    useNewMetricsLayer: false,
  };

  const pathname = `/organizations/${orgSlug}/metrics/data/`;

  return api.requestPromise(pathname, {includeAllArgs, query: urlQuery});
};
