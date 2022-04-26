import {Client} from 'sentry/api';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DateString, Organization, SessionApiResponse} from 'sentry/types';
import {defined} from 'sentry/utils';

export type DoSessionsRequestOptions = {
  field: string[];
  orgSlug: Organization['slug'];
  cursor?: string;
  end?: DateString;
  environment?: Readonly<string[]>;
  groupBy?: string[];
  interval?: string;
  orderBy?: string;
  project?: Readonly<number[]>;
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
    statsPeriodStart,
    statsPeriodEnd,
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
      query: query || undefined,
      project,
      start,
      statsPeriod,
      statsPeriodStart,
      statsPeriodEnd,
    }).filter(([, value]) => defined(value) && value !== '')
  );

  return api.requestPromise(`/organizations/${orgSlug}/sessions/`, {query: urlQuery});
};
