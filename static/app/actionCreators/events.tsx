import {LocationDescriptor} from 'history';
import pick from 'lodash/pick';

import {Client} from 'sentry/api';
import {canIncludePreviousPeriod} from 'sentry/components/charts/utils';
import {
  DateString,
  EventsStats,
  MultiSeriesEventsStats,
  OrganizationSummary,
} from 'sentry/types';
import {LocationQuery} from 'sentry/utils/discover/eventView';
import {getPeriod} from 'sentry/utils/getPeriod';
import {PERFORMANCE_URL_PARAM} from 'sentry/utils/performance/constants';
import {QueryBatching} from 'sentry/utils/performance/contexts/genericQueryBatcher';

type Options = {
  organization: OrganizationSummary;
  project?: Readonly<number[]>;
  environment?: Readonly<string[]>;
  team?: Readonly<string | string[]>;
  period?: string | null;
  start?: DateString;
  end?: DateString;
  interval?: string;
  comparisonDelta?: number;
  includePrevious?: boolean;
  limit?: number;
  query?: string;
  yAxis?: string | string[];
  field?: string[];
  topEvents?: number;
  orderby?: string;
  partial: boolean;
  withoutZerofill?: boolean;
  referrer?: string;
  queryBatching?: QueryBatching;
  queryExtras?: Record<string, string>;
  generatePathname?: (org: OrganizationSummary) => string;
};

/**
 * Make requests to `events-stats` endpoint
 *
 * @param {Object} api API client instance
 * @param {Object} options Request parameters
 * @param {Object} options.organization Organization object
 * @param {Number[]} options.project List of project ids
 * @param {String[]} options.environment List of environments to query for
 * @param {String[]} options.team List of teams to query for
 * @param {String} options.period Time period to query for, in the format: <integer><units> where units are "d" or "h"
 * @param {String} options.interval Time interval to group results in, in the format: <integer><units> where units are "d", "h", "m", "s"
 * @param {Number} options.comparisonDelta Comparison delta for change alert event stats to include comparison stats
 * @param {Boolean} options.includePrevious Should request also return reqsults for previous period?
 * @param {Number} options.limit The number of rows to return
 * @param {String} options.query Search query
 * @param {QueryBatching} options.queryBatching A container for batching functions from a provider
 * @param {Record<string, string>} options.queryExtras A list of extra query parameters
 * @param {(org: OrganizationSummary) => string} options.generatePathname A function that returns an override for the pathname
 */
export const doEventsRequest = (
  api: Client,
  {
    organization,
    project,
    environment,
    team,
    period,
    start,
    end,
    interval,
    comparisonDelta,
    includePrevious,
    query,
    yAxis,
    field,
    topEvents,
    orderby,
    partial,
    withoutZerofill,
    referrer,
    queryBatching,
    generatePathname,
    queryExtras,
  }: Options
): Promise<EventsStats | MultiSeriesEventsStats> => {
  const shouldDoublePeriod = canIncludePreviousPeriod(includePrevious, period);
  const urlQuery = Object.fromEntries(
    Object.entries({
      interval,
      comparisonDelta,
      project,
      environment,
      team,
      query,
      yAxis,
      field,
      topEvents,
      orderby,
      partial: partial ? '1' : undefined,
      withoutZerofill: withoutZerofill ? '1' : undefined,
      referrer: referrer ? referrer : 'api.organization-event-stats',
    }).filter(([, value]) => typeof value !== 'undefined')
  );

  // Doubling period for absolute dates is not accurate unless starting and
  // ending times are the same (at least for daily intervals). This is
  // the tradeoff for now.
  const periodObj = getPeriod({period, start, end}, {shouldDoublePeriod});

  const queryObject = {
    query: {
      ...urlQuery,
      ...periodObj,
      ...queryExtras,
    },
  };

  const pathname =
    generatePathname?.(organization) ??
    `/organizations/${organization.slug}/events-stats/`;

  if (queryBatching?.batchRequest) {
    return queryBatching.batchRequest(api, pathname, queryObject);
  }

  return api.requestPromise(pathname, queryObject);
};

export type EventQuery = {
  field: string[];
  equation?: string[];
  team?: string | string[];
  project?: string | string[];
  sort?: string | string[];
  query: string;
  per_page?: number;
  referrer?: string;
  environment?: string[];
  noPagination?: boolean;
};

export type TagSegment = {
  count: number;
  name: string;
  value: string;
  url: LocationDescriptor;
  isOther?: boolean;
  key?: string;
};

export type Tag = {
  key: string;
  topValues: Array<TagSegment>;
};

/**
 * Fetches tag facets for a query
 */
export async function fetchTagFacets(
  api: Client,
  orgSlug: string,
  query: EventQuery
): Promise<Tag[]> {
  const urlParams = pick(query, Object.values(PERFORMANCE_URL_PARAM));

  const queryOption = {...urlParams, query: query.query};

  return api.requestPromise(`/organizations/${orgSlug}/events-facets/`, {
    query: queryOption,
  });
}

/**
 * Fetches total count of events for a given query
 */
export async function fetchTotalCount(
  api: Client,
  orgSlug: String,
  query: EventQuery & LocationQuery
): Promise<number> {
  const urlParams = pick(query, Object.values(PERFORMANCE_URL_PARAM));

  const queryOption = {...urlParams, query: query.query};

  type Response = {
    count: number;
  };

  return api
    .requestPromise(`/organizations/${orgSlug}/events-meta/`, {
      query: queryOption,
    })
    .then((res: Response) => res.count);
}
