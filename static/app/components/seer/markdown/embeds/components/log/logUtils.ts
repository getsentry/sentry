import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getUtcDateString} from 'sentry/utils/dates';
import {LOGS_ROW_ID_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {logItemIdToTimestamp} from 'sentry/views/explore/logs/pinning/logItemId';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';

export const LOG_EMBED_REFERRER = 'seer-log-embed';

/**
 * Padding around the log's own timestamp when looking the single row up, to
 * absorb clock skew between when the SDK minted the id and when the log was
 * ingested. Matches the window the pinned-log lookup uses.
 */
export const LOG_LOOKUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * A single log's neighbourhood is too thin to break an attribute down over, so
 * the aggregate view widens to the hour around it. The Explore link uses the
 * same window, so the numbers there match the ones rendered here.
 */
export const LOG_AGGREGATE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Used only when neither Seer nor the id tells us when the log happened.
 */
export const LOG_FALLBACK_STATS_PERIOD = '14d';

/**
 * Seer may report a project id as a number, but everything downstream -- the
 * details endpoint's project lookup included -- keys off the string form.
 */
export function toProjectId(projectId: string | number | undefined) {
  return projectId === undefined ? undefined : String(projectId);
}

export interface LogEmbedIdentity {
  id: string;
  projectId?: string;
  timestamp?: string;
}

/**
 * Log ids are UUIDv7, so the id alone carries the creation time. Seer's
 * `timestamp` wins when it supplied one; otherwise decode the id so we can
 * still scan a tight window instead of the org's whole retention. The decoder
 * only reads unseparated hex, so try the dashed form stripped as well.
 */
export function getLogTimestampMs({id, timestamp}: LogEmbedIdentity): number | null {
  if (timestamp) {
    const parsed = new Date(timestamp).getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return logItemIdToTimestamp(id) ?? logItemIdToTimestamp(id.replace(/-/g, ''));
}

/**
 * The embed carries no page filters of its own, so every query and link it
 * builds is scoped to the log itself rather than to whatever the host page
 * happens to have selected.
 */
export function getLogPageFilters(
  identity: LogEmbedIdentity,
  windowMs: number
): PageFilters {
  const timestampMs = getLogTimestampMs(identity);
  const projectId = Number(identity.projectId);

  return {
    projects: Number.isInteger(projectId) ? [projectId] : [],
    environments: [],
    datetime:
      timestampMs === null
        ? {period: LOG_FALLBACK_STATS_PERIOD, start: null, end: null, utc: null}
        : {
            period: null,
            start: getUtcDateString(timestampMs - windowMs),
            end: getUtcDateString(timestampMs + windowMs),
            utc: true,
          },
  };
}

/**
 * Filters Explore down to this one row. `logsRowId` additionally highlights and
 * auto-expands it once the table loads.
 */
export function getLogRowUrl({
  organization,
  ...identity
}: LogEmbedIdentity & {organization: Organization}): string {
  const url = getLogsUrl({
    organization,
    selection: getLogPageFilters(identity, LOG_LOOKUP_WINDOW_MS),
    query: `${OurLogKnownFieldKey.ID}:${identity.id}`,
    mode: Mode.SAMPLES,
    referrer: LOG_EMBED_REFERRER,
  });

  return `${url}&${LOGS_ROW_ID_KEY}=${encodeURIComponent(identity.id)}`;
}

/**
 * Explore in aggregate mode, grouped by the attribute the block broke down.
 */
export function getLogAttributeUrl({
  organization,
  attribute,
  ...identity
}: LogEmbedIdentity & {attribute: string; organization: Organization}): string {
  return getLogsUrl({
    organization,
    selection: getLogPageFilters(identity, LOG_AGGREGATE_WINDOW_MS),
    mode: Mode.AGGREGATE,
    groupBy: [attribute],
    aggregateFn: 'count',
    aggregateParam: OurLogKnownFieldKey.MESSAGE,
    referrer: LOG_EMBED_REFERRER,
  });
}

/**
 * `PageFilters` datetime as the events endpoint wants it.
 */
export function toDateQueryParams(selection: PageFilters) {
  const {period, start, end} = selection.datetime;
  return period ? {statsPeriod: period} : {start, end, utc: true};
}
