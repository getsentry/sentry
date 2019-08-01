import {canIncludePreviousPeriod} from 'app/views/events/utils/canIncludePreviousPeriod';
import {getPeriod} from 'app/utils/getPeriod';
import {EventsStats, Organization} from 'app/types';

const BASE_URL = (org: Organization) => `/organizations/${org.slug}/events-stats/`;

type Options = {
  organization: Organization;
  project?: number[];
  environment?: string[];
  period?: string;
  start?: Date;
  end?: Date;
  interval?: string;
  includePrevious?: boolean;
  limit?: number;
  query?: string;
  yAxis?: 'event_count' | 'user_count';
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
  // TODO(ts): Update when we type `app/api`
  api: any,
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
  }: Options
): Promise<EventsStats> => {
  const shouldDoublePeriod = canIncludePreviousPeriod(includePrevious, period);
  const urlQuery = {
    interval,
    project,
    environment,
    query,
    yAxis,
  };

  // Doubling period for absolute dates is not accurate unless starting and
  // ending times are the same (at least for daily intervals). This is
  // the tradeoff for now.
  const periodObj = getPeriod({period, start, end}, {shouldDoublePeriod});

  return api.requestPromise(`${BASE_URL(organization)}`, {
    query: {
      ...urlQuery,
      ...periodObj,
    },
  });
};
