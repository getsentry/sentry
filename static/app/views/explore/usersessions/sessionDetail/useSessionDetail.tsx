import {useCallback, useMemo} from 'react';
import {SESSION_ID} from '@sentry/conventions/attributes';
import {skipToken, useQueries} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import type {Row} from './rowConfig';
import {ROW_CONFIG} from './rowConfig';

const REFERRER = 'api.explore.user-session-detail';

/**
 * Per-dataset cap on timeline rows. Spans and errors are hard-capped at 100 by
 * the events endpoint, so this is the ceiling for a uniform request.
 */
export const MAX_ROWS_PER_DATASET = 100;

interface EventsResponse {
  data: Row[];
}

/**
 * Sort values are the ones the events endpoint takes, so they pass straight
 * through to the query. Newest first by default: the end of a session is
 * usually why someone opened it.
 */
const SORT_PARAM = 'sort';
const NEWEST_FIRST = '-timestamp';
const OLDEST_FIRST = 'timestamp';

/**
 * Timeline sort direction, held in the URL so a sorted view is linkable and
 * survives a reload.
 */
function useTimelineSort() {
  const location = useLocation();
  const navigate = useNavigate();

  const sort = location.query[SORT_PARAM] === OLDEST_FIRST ? OLDEST_FIRST : NEWEST_FIRST;
  // The arrow points at the direction of the timestamps, not of the param.
  const sortDirection = sort === NEWEST_FIRST ? ('desc' as const) : ('asc' as const);

  const toggleSort = useCallback(() => {
    navigate(
      {
        ...location,
        query: {
          ...location.query,
          [SORT_PARAM]: sort === NEWEST_FIRST ? OLDEST_FIRST : NEWEST_FIRST,
        },
      },
      {replace: true}
    );
  }, [location, navigate, sort]);

  return {sort, sortDirection, toggleSort};
}

export interface SessionEvent {
  detail: string | undefined;
  /** Dataset this row came from. */
  key: SessionDatasetKey;
  row: Row;
  /** Epoch ms, parsed from the uniform `timestamp` field. */
  timestamp: number | undefined;
  title: string;
}

export interface SessionTraceGroup {
  /** Spans of one trace, contiguous in the timeline and in its sort order. */
  spans: SessionEvent[];
  /** The leading span's timestamp, which is where the group sits in the timeline. */
  timestamp: number | undefined;
  trace: string;
}

/**
 * One timeline row: a single telemetry item, or a run of same-trace spans
 * collapsed into one expandable trace row.
 */
export type SessionTimelineItem =
  | {event: SessionEvent; kind: 'event'}
  | {group: SessionTraceGroup; kind: 'trace'};

export interface SessionDetail {
  counts: Record<SessionDatasetKey, number>;
  /** True when any dataset returned a full page, so the timeline may be truncated. */
  isTruncated: boolean;
  items: SessionTimelineItem[];
  totalEvents: number;
}

function toCount(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** The trace a row belongs to, when it carries one. */
function traceOf(row: Row): string | undefined {
  return typeof row.trace === 'string' && row.trace ? row.trace : undefined;
}

/**
 * Collapses each run of same-trace spans into a single trace row. One traced
 * interaction can emit dozens of spans, which would otherwise bury the logs and
 * errors around it, and the spans of a trace say more together than apart.
 *
 * Only spans group: the other datasets carry a trace id too, but they read as
 * individual items. A span with no trace id can't be addressed as a trace, so it
 * stays on its own row.
 */
function groupByTrace(events: SessionEvent[]): SessionTimelineItem[] {
  const items: SessionTimelineItem[] = [];

  events.forEach(event => {
    const trace = event.key === 'spans' ? traceOf(event.row) : undefined;
    if (trace === undefined) {
      items.push({kind: 'event', event});
      return;
    }

    const previous = items.at(-1);
    if (previous?.kind === 'trace' && previous.group.trace === trace) {
      previous.group.spans.push(event);
      return;
    }

    items.push({
      kind: 'trace',
      group: {trace, spans: [event], timestamp: event.timestamp},
    });
  });

  return items;
}

/**
 * Loads one session: per-dataset counts, plus the individual events merged into
 * a single chronological list.
 *
 * Both halves fan out over the four datasets because no endpoint queries more
 * than one at a time. Unlike the list view this needs no two-phase pass — the
 * session id is already known, so every query filters to it directly.
 */
export function useSessionDetail(sessionId: string) {
  const organization = useOrganization();
  const {selection, isReady: arePageFiltersReady} = usePageFilters();
  const {sort, sortDirection, toggleSort} = useTimelineSort();

  const dateParams = useMemo(
    () => normalizeDateTimeParams(selection.datetime),
    [selection.datetime]
  );

  const commonQuery = useMemo(
    () => ({
      ...dateParams,
      project: selection.projects,
      environment: selection.environments,
      referrer: REFERRER,
      query: `${SESSION_ID}:${sessionId}`,
    }),
    [dateParams, selection.projects, selection.environments, sessionId]
  );

  const enabled = arePageFiltersReady && Boolean(sessionId);

  const countQueries = useQueries({
    queries: SESSION_DATASETS.map(config =>
      apiOptions.as<EventsResponse>()('/organizations/$organizationIdOrSlug/events/', {
        path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          ...commonQuery,
          dataset: config.dataset,
          field: [config.countField],
          per_page: 1,
        },
        staleTime: 0,
      })
    ),
    combine: results => ({
      results,
      isPending: results.some(result => result.isPending),
      isError: results.some(result => result.isError),
    }),
  });

  const rowQueries = useQueries({
    queries: SESSION_DATASETS.map(config =>
      apiOptions.as<EventsResponse>()('/organizations/$organizationIdOrSlug/events/', {
        path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          ...commonQuery,
          dataset: config.dataset,
          field: ['timestamp', ...ROW_CONFIG[config.key].fields],
          // Sorted server-side rather than only in the merge below, so a
          // truncated timeline keeps the end of the session the user is
          // actually looking at.
          sort,
          per_page: MAX_ROWS_PER_DATASET,
        },
        staleTime: 0,
      })
    ),
    combine: results => ({
      results,
      isPending: results.some(result => result.isPending),
      isError: results.some(result => result.isError),
    }),
  });

  const detail = useMemo((): SessionDetail => {
    const counts: Record<SessionDatasetKey, number> = {
      logs: 0,
      metrics: 0,
      spans: 0,
      errors: 0,
    };

    countQueries.results.forEach((result, index) => {
      const config = SESSION_DATASETS[index]!;
      // An aggregate with no group-by returns a single row; no rows means zero.
      counts[config.key] = toCount(result.data?.data[0]?.[config.countField]);
    });

    const events: SessionEvent[] = [];
    let isTruncated = false;

    rowQueries.results.forEach((result, index) => {
      const config = SESSION_DATASETS[index]!;
      const rows = result.data?.data ?? [];
      if (rows.length >= MAX_ROWS_PER_DATASET) {
        isTruncated = true;
      }
      const rowConfig = ROW_CONFIG[config.key];
      rows.forEach(row => {
        events.push({
          key: config.key,
          row,
          timestamp: parseTimestamp(row.timestamp),
          title: rowConfig.getTitle(row),
          detail: rowConfig.getDetail?.(row),
        });
      });
    });

    // The four datasets each come back sorted; this merges them into one order.
    const order = sort === NEWEST_FIRST ? -1 : 1;
    events.sort((a, b) => {
      // Rows without a parseable timestamp go last in either direction.
      if (a.timestamp === undefined) {
        return b.timestamp === undefined ? 0 : 1;
      }
      if (b.timestamp === undefined) {
        return -1;
      }
      return (a.timestamp - b.timestamp) * order;
    });

    return {
      counts,
      items: groupByTrace(events),
      isTruncated,
      totalEvents: Object.values(counts).reduce((sum, count) => sum + count, 0),
    };
  }, [countQueries.results, rowQueries.results, sort]);

  return {
    ...detail,
    dateParams,
    sortDirection,
    toggleSort,
    isPending: countQueries.isPending || rowQueries.isPending,
    isError: countQueries.isError || rowQueries.isError,
  };
}
