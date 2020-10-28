import {LocationDescriptor} from 'history';
import pick from 'lodash/pick';

import {Client} from 'app/api';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {canIncludePreviousPeriod} from 'app/components/charts/utils';
import {getPeriod} from 'app/utils/getPeriod';
import {
  EventsStats,
  DateString,
  OrganizationSummary,
  MultiSeriesEventsStats,
} from 'app/types';

function getBaseUrl(org: OrganizationSummary, keyTransactions: boolean | undefined) {
  if (keyTransactions) {
    return `/organizations/${org.slug}/key-transactions-stats/`;
  }

  return `/organizations/${org.slug}/events-stats/`;
}

type Options = {
  organization: OrganizationSummary;
  project?: number[];
  environment?: string[];
  period?: string;
  start?: DateString;
  end?: DateString;
  interval?: string;
  includePrevious?: boolean;
  limit?: number;
  query?: string;
  yAxis?: string | string[];
  field?: string[];
  keyTransactions?: boolean;
  topEvents?: number;
  orderby?: string;
};

/**
 * Make requests to `events-stats` endpoint
 *
 * @param {Object} api API client instance
 * @param {Object} options Request parameters
 * @param {Object} options.organization Organization object
 * @param {Number[]} options.project List of project ids
 * @param {String[]} options.environment List of environments to query for
 * @param {String} options.period Time period to query for, in the format: <integer><units> where units are "d" or "h"
 * @param {String} options.interval Time interval to group results in, in the format: <integer><units> where units are "d", "h", "m", "s"
 * @param {Boolean} options.includePrevious Should request also return reqsults for previous period?
 * @param {Number} options.limit The number of rows to return
 * @param {String} options.query Search query
 */
export const doEventsRequest = (
  api: Client,
  {
    organization,
    project,
    environment,
    period,
    start,
    end,
    interval,
    includePrevious,
    query,
    yAxis,
    field,
    keyTransactions,
    topEvents,
    orderby,
  }: Options
): Promise<EventsStats | MultiSeriesEventsStats> => {
  const shouldDoublePeriod = canIncludePreviousPeriod(includePrevious, period);
  const urlQuery = Object.fromEntries(
    Object.entries({
      interval,
      project,
      environment,
      query,
      yAxis,
      field,
      topEvents,
      orderby,
    }).filter(([, value]) => typeof value !== 'undefined')
  );

  // Doubling period for absolute dates is not accurate unless starting and
  // ending times are the same (at least for daily intervals). This is
  // the tradeoff for now.
  const periodObj = getPeriod({period, start, end}, {shouldDoublePeriod});

  return api.requestPromise(`${getBaseUrl(organization, keyTransactions)}`, {
    query: {
      ...urlQuery,
      ...periodObj,
    },
  });
};

export type EventQuery = {
  field: string[];
  project?: string | string[];
  sort?: string | string[];
  query: string;
  per_page?: number;
  referrer?: string;
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
  const urlParams = pick(query, Object.values(URL_PARAM));

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
  query: EventQuery
): Promise<number> {
  const urlParams = pick(query, Object.values(URL_PARAM));

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
