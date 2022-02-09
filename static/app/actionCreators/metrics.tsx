import {Client} from 'sentry/api';
import {getInterval} from 'sentry/components/charts/utils';
import {DateString, MetricsApiResponse, Organization} from 'sentry/types';
import {getPeriod} from 'sentry/utils/getPeriod';

export type DoMetricsRequestOptions = {
  field: string[];
  orgSlug: Organization['slug'];
  cursor?: string;
  end?: DateString;
  environment?: Readonly<string[]>;
  groupBy?: string[];
  includeAllArgs?: boolean;
  interval?: string;
  limit?: number;
  orderBy?: string;
  project?: Readonly<number[]>;
  query?: string;
  start?: DateString;
  statsPeriod?: string | null;
  statsPeriodEnd?: string | null;
  statsPeriodStart?: string | null;
};

export const doMetricsRequest = (
  api: Client,
  {
    field,
    orgSlug,
    cursor,
    environment,
    groupBy,
    interval,
    limit,
    orderBy,
    project,
    query,
    includeAllArgs = false,
    statsPeriodStart,
    statsPeriodEnd,
    ...dateTime
  }: DoMetricsRequestOptions
): Promise<MetricsApiResponse> => {
  const {start, end, statsPeriod} =
    statsPeriodStart && statsPeriodEnd
      ? {start: undefined, end: undefined, statsPeriod: undefined}
      : getPeriod({
          period: dateTime.statsPeriod,
          start: dateTime.start,
          end: dateTime.end,
        });

  const urlQuery = Object.fromEntries(
    Object.entries({
      field,
      cursor,
      end,
      environment,
      groupBy,
      interval: interval || getInterval({start, end, period: dateTime.statsPeriod}),
      query: query || undefined,
      per_page: limit,
      project,
      orderBy,
      start,
      statsPeriod,
      statsPeriodStart,
      statsPeriodEnd,
    }).filter(([, value]) => typeof value !== 'undefined')
  );

  const pathname = `/organizations/${orgSlug}/metrics/data/`;

  return api.requestPromise(pathname, {includeAllArgs, query: urlQuery});
};
