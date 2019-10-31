import {Client} from 'app/api';
import {canIncludePreviousPeriod} from 'app/views/events/utils/canIncludePreviousPeriod';
import {getPeriod} from 'app/utils/getPeriod';
import {EventsStats, Organization} from 'app/types';

const getBaseUrl = (org: Organization) => `/organizations/${org.slug}/events-stats/`;

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
  yAxis?: string;
  field?: string[];
  referenceEvent?: string;
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
    referenceEvent,
  }: Options
): Promise<EventsStats> => {
  const shouldDoublePeriod = canIncludePreviousPeriod(includePrevious, period);
  const urlQuery = Object.fromEntries(
    Object.entries({
      interval,
      project,
      environment,
      query,
      yAxis,
      field,
      referenceEvent,
    }).filter(([, value]) => typeof value !== 'undefined')
  );

  // Doubling period for absolute dates is not accurate unless starting and
  // ending times are the same (at least for daily intervals). This is
  // the tradeoff for now.
  const periodObj = getPeriod({period, start, end}, {shouldDoublePeriod});

  return api.requestPromise(`${getBaseUrl(organization)}`, {
    query: {
      ...urlQuery,
      ...periodObj,
    },
  });
};
