import {useCallback, useMemo, useState} from 'react';
import {SESSION_ID} from '@sentry/conventions/attributes';
import type {QueryFunctionContext} from '@tanstack/react-query';
import {skipToken, useQueries} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  SessionDataset,
  SessionDatasetKey,
} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';
import type {
  SessionIdentity,
  SessionName,
} from 'sentry/views/explore/usersessions/sessionName';
import {
  identityFields,
  mergeIdentities,
  readIdentity,
  resolveSessionName,
} from 'sentry/views/explore/usersessions/sessionName';

import type {Row} from './rowConfig';
import {ROW_CONFIG} from './rowConfig';

const REFERRER = 'api.explore.user-session-detail';

interface EventsResponse {
  data: Row[];
}

/** One dataset's timeline rows, gathered across however many pages it took. */
interface TimelineRows {
  /** True when the dataset holds more rows than `maxRows` let us load. */
  hasMore: boolean;
  rows: Row[];
}

/**
 * Reads up to `maxRows` rows for one dataset, following the `Link` header when
 * the dataset's page size can't cover that in a single request. Spans and errors
 * are capped at 100 rows per request by the events endpoint, so they take ten
 * passes to reach the same depth logs and metrics get in one.
 *
 * Pages are fetched one at a time rather than fanned out: the endpoint allows 15
 * concurrent requests per org and the page already spends 8 of them on its first
 * paint. It also lets a dataset stop as soon as the session runs out of rows,
 * which is the common case — a session with under 100 spans still costs exactly
 * one request.
 */
function fetchTimelineRows(config: SessionDataset) {
  return async (
    context: QueryFunctionContext<ApiQueryKey>
  ): Promise<ApiResponse<TimelineRows>> => {
    const [url, options] = context.queryKey;
    const rows: Row[] = [];
    let cursor: string | undefined;
    // Tracks whether the *last* page we read had a successor, so a dataset that
    // ends exactly on a page boundary isn't reported as truncated.
    let hasMore = false;

    // Bounded by page count as well as by row count: a page that advertises a
    // successor but returns nothing would otherwise never move `rows.length`,
    // and the loop would keep asking for the next page forever.
    const maxPages = Math.ceil(config.maxRows / config.pageSize);

    for (let page = 0; page < maxPages && rows.length < config.maxRows; page++) {
      const response = await apiFetch<EventsResponse>({
        ...context,
        queryKey: [
          url,
          {...options, query: {...options?.query, cursor}},
          {infinite: false},
        ],
      });
      rows.push(...response.json.data);

      const next = parseLinkHeader(response.headers.Link ?? null).next;
      hasMore = Boolean(next?.results);
      if (!next?.results) {
        break;
      }
      cursor = next.cursor;
    }

    // `headers` is unused downstream — the cursors it carries have already been
    // spent getting here.
    return {headers: {}, json: {rows: rows.slice(0, config.maxRows), hasMore}};
  };
}

/**
 * Sort values are the ones the events endpoint takes, so they pass straight
 * through to the query. Newest first by default: the end of a session is
 * usually why someone opened it.
 */
const SORT_PARAM = 'sort';
const NEWEST_FIRST = '-timestamp';
const OLDEST_FIRST = 'timestamp';

/** Direction the timestamps run in, which is not the direction of the sort param. */
export type SortDirection = 'asc' | 'desc';

/**
 * Timeline sort direction, held in the URL so a sorted view is linkable and
 * survives a reload.
 */
function useTimelineSort() {
  const location = useLocation();
  const navigate = useNavigate();

  const sort = location.query[SORT_PARAM] === OLDEST_FIRST ? OLDEST_FIRST : NEWEST_FIRST;
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

const QUERY_PARAM = 'query';
const TYPE_PARAM = 'telemetryType';

const ALL_TYPES: SessionDatasetKey[] = SESSION_DATASETS.map(config => config.key);

function isSessionDatasetKey(value: string): value is SessionDatasetKey {
  return ALL_TYPES.includes(value as SessionDatasetKey);
}

export interface TimelineFilters {
  /** Free text matched against a row's title and detail. Empty means no text filter. */
  query: string;
  setQuery: (query: string) => void;
  setTypes: (types: SessionDatasetKey[]) => void;
  /** Telemetry types to show. Every type, unless the URL narrows it. */
  types: SessionDatasetKey[];
}

/**
 * Timeline filters, held in the URL alongside the sort so a filtered view is
 * linkable and survives a reload.
 *
 * Filtering happens client-side, over the rows already fetched for the timeline.
 * The per-dataset queries are capped either way, so narrowing them server-side
 * would not surface more rows — and the counts above the timeline stay exact.
 */
function useTimelineFilters(): TimelineFilters {
  const location = useLocation();
  const navigate = useNavigate();

  const query = decodeScalar(location.query[QUERY_PARAM], '');

  const types = useMemo(() => {
    const selected = decodeList(location.query[TYPE_PARAM]).filter(isSessionDatasetKey);
    // No selection means every type, the way an empty project filter means all
    // projects. Deselecting the last type therefore shows everything again
    // rather than an unexplained empty timeline.
    return selected.length === 0 ? ALL_TYPES : selected;
  }, [location.query]);

  const setParam = useCallback(
    (param: string, value: string | string[] | undefined) => {
      navigate(
        {...location, query: {...location.query, [param]: value}},
        {replace: true}
      );
    },
    [location, navigate]
  );

  const setQuery = useCallback(
    (next: string) => setParam(QUERY_PARAM, next || undefined),
    [setParam]
  );

  const setTypes = useCallback(
    (next: SessionDatasetKey[]) =>
      // "All" is the default, so it needs no param.
      setParam(
        TYPE_PARAM,
        next.length === 0 || next.length === ALL_TYPES.length ? undefined : next
      ),
    [setParam]
  );

  return {query, types, setQuery, setTypes};
}

export interface SessionEvent {
  detail: string | undefined;
  /**
   * Duration in ms, for the datasets that report one. Logs, metrics and errors
   * are instants and leave this undefined — which is what decides whether a rail
   * row draws a duration bar.
   */
  duration: number | undefined;
  /** Dataset this row came from. */
  key: SessionDatasetKey;
  row: Row;
  /** Epoch ms, parsed from the uniform `timestamp` field. */
  timestamp: number | undefined;
  title: string;
}

export interface SessionTraceGroup {
  /** Wall-clock span from the run's first start to its last finish, in ms. */
  duration: number | undefined;
  /** Spans of one trace, contiguous in the timeline and in its sort order. */
  spans: SessionEvent[];
  /** The leading span's timestamp, which is where the group sits in the timeline. */
  timestamp: number | undefined;
  trace: string;
}

/** Epoch-ms range. Used both for the session's own extent and for a selection. */
export interface SessionRange {
  end: number;
  start: number;
}

/**
 * One timeline row: a single telemetry item, or a run of same-trace spans
 * collapsed into one expandable trace row.
 */
export type SessionTimelineItem =
  | {event: SessionEvent; kind: 'event'}
  | {group: SessionTraceGroup; kind: 'trace'};

export interface SessionDetail {
  /**
   * The session's extent, which is the domain every relative offset and every
   * density bar is measured against. Undefined only when the session has no
   * telemetry at all.
   */
  bounds: SessionRange | undefined;
  counts: Record<SessionDatasetKey, number>;
  /** True when a filter is hiding rows the session actually has. */
  isFiltered: boolean;
  /** True when any dataset returned a full page, so the timeline may be truncated. */
  isTruncated: boolean;
  items: SessionTimelineItem[];
  /** What to call this session, resolved from the telemetry it carries. */
  name: SessionName;
  /**
   * Timestamps of every fetched item, per dataset, for the scrubber's density
   * lanes. Narrowed by the text filter — so searching also shows *where* in the
   * session the matches are — but never by the selected window or the type
   * toggles, since those are what the lanes are used to drive.
   */
  timestampsByType: Record<SessionDatasetKey, number[]>;
  totalEvents: number;
  /** Per-dataset truncation, so a lane built from a capped page can say so. */
  truncatedByType: Record<SessionDatasetKey, boolean>;
  /** The selected sub-range, clamped to `bounds`. Null means the whole session. */
  window: SessionRange | null;
}

function toCount(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * A domain needs width to divide by. One instantaneous event, or a session whose
 * telemetry all landed in the same millisecond, would otherwise put every offset
 * at 0/0.
 */
const MIN_DOMAIN_MS = 1000;

function padRange({start, end}: SessionRange): SessionRange {
  return end - start >= MIN_DOMAIN_MS
    ? {start, end}
    : {start, end: start + MIN_DOMAIN_MS};
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
      group: {
        trace,
        spans: [event],
        timestamp: event.timestamp,
        duration: undefined,
      },
    });
  });

  // A group's extent has to be measured after its members are known, and it is
  // wall-clock — first start to last finish — not the sum of the spans, which
  // would double-count anything concurrent.
  items.forEach(item => {
    if (item.kind !== 'trace') {
      return;
    }
    const starts = item.group.spans
      .map(span => span.timestamp)
      .filter((value): value is number => value !== undefined);
    if (starts.length === 0) {
      return;
    }
    const ends = item.group.spans.map(span =>
      span.timestamp === undefined ? 0 : span.timestamp + (span.duration ?? 0)
    );
    const start = Math.min(...starts);
    const duration = Math.max(...ends) - start;
    item.group.timestamp = start;
    // A run with no measurable extent — one span, no reported duration — has no
    // duration to show rather than a duration of zero.
    item.group.duration = duration > 0 ? duration : undefined;
  });

  return items;
}

/** Where an item sits on the time axis, spans included. */
function extentOf(event: SessionEvent): SessionRange | undefined {
  if (event.timestamp === undefined) {
    return undefined;
  }
  return {
    start: event.timestamp,
    end: event.timestamp + (event.duration ?? 0),
  };
}

/**
 * Free-text match over what the row actually shows: its title and its detail.
 * Case-insensitive substring, not search syntax — this filters rows already on
 * the page rather than issuing a query.
 */
function matchesQuery(event: SessionEvent, needle: string): boolean {
  return (
    event.title.toLowerCase().includes(needle) ||
    Boolean(event.detail?.toLowerCase().includes(needle))
  );
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
  const filters = useTimelineFilters();

  /**
   * The scrubber's selection. Deliberately *not* in the URL, unlike the sort and
   * the filters: it is a transient aiming gesture, and committing a drag to
   * history would either thrash the router or need a draft-and-commit dance.
   * `null` means the whole session.
   */
  const [selectedWindow, setSelectedWindow] = useState<SessionRange | null>(null);

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
          // The extent and naming aggregates ride along on a request that already
          // runs. They have to come from aggregates rather than from the fetched
          // rows: a truncated page's first and last row are not the session's,
          // and the row that carries the user may not be on the page at all.
          field: [
            config.countField,
            config.firstSeenField,
            config.lastSeenField,
            ...identityFields(config.key),
          ],
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
    queries: SESSION_DATASETS.map(config => ({
      ...apiOptions.as<TimelineRows>()('/organizations/$organizationIdOrSlug/events/', {
        path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          ...commonQuery,
          dataset: config.dataset,
          field: ['timestamp', ...ROW_CONFIG[config.key].fields],
          // Sorted server-side rather than only in the merge below, so a
          // truncated timeline keeps the end of the session the user is
          // actually looking at.
          sort,
          per_page: config.pageSize,
        },
        staleTime: 0,
      }),
      // Overridden so one query can span several pages. The key above still
      // describes the whole read, so the cache and `enabled` behave as usual.
      queryFn: enabled ? fetchTimelineRows(config) : skipToken,
    })),
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
    const truncatedByType: Record<SessionDatasetKey, boolean> = {
      logs: false,
      metrics: false,
      spans: false,
      errors: false,
    };
    const timestampsByType: Record<SessionDatasetKey, number[]> = {
      logs: [],
      metrics: [],
      spans: [],
      errors: [],
    };

    let aggregateBounds: SessionRange | undefined;
    // Sifted across datasets rather than taken from one: a session whose spans
    // carry only `user.id` and whose errors carry `user.email` should be named by
    // the email, and one dataset returning an empty or scrubbed value should not
    // stop another from filling that slot.
    const identities: SessionIdentity[] = [];

    countQueries.results.forEach((result, index) => {
      const config = SESSION_DATASETS[index]!;
      // An aggregate with no group-by returns a single row; no rows means zero.
      const row = result.data?.data[0];
      counts[config.key] = toCount(row?.[config.countField]);
      if (row) {
        identities.push(readIdentity(config.key, row));
      }

      const firstSeen = config.toEpochMs(row?.[config.firstSeenField]);
      const lastSeen = config.toEpochMs(row?.[config.lastSeenField]);
      if (firstSeen !== undefined) {
        aggregateBounds = {
          start: Math.min(aggregateBounds?.start ?? firstSeen, firstSeen),
          end: Math.max(aggregateBounds?.end ?? firstSeen, lastSeen ?? firstSeen),
        };
      }
    });

    const events: SessionEvent[] = [];
    let isTruncated = false;

    rowQueries.results.forEach((result, index) => {
      const config = SESSION_DATASETS[index]!;
      const rows = result.data?.rows ?? [];
      // Reported by the fetch rather than inferred from the row count, so a
      // dataset that happens to hold exactly `maxRows` isn't called truncated.
      if (result.data?.hasMore) {
        isTruncated = true;
        truncatedByType[config.key] = true;
      }
      const rowConfig = ROW_CONFIG[config.key];
      rows.forEach(row => {
        events.push({
          key: config.key,
          row,
          timestamp: parseTimestamp(row.timestamp),
          title: rowConfig.getTitle(row),
          detail: rowConfig.getDetail?.(row),
          duration: rowConfig.getDuration?.(row),
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

    // Filtered before grouping, so a run of same-trace spans is only collapsed
    // out of the rows that survive the filter.
    const selectedTypes = new Set(filters.types);
    const needle = filters.query.trim().toLowerCase();
    const matching = events.filter(event => needle === '' || matchesQuery(event, needle));

    matching.forEach(event => {
      if (event.timestamp !== undefined) {
        timestampsByType[event.key].push(event.timestamp);
      }
    });

    // Aggregates are exact and survive truncation, so they win. The fetched rows
    // are the fallback for a dataset that reports no extent aggregate.
    const eventBounds = matching.reduce<SessionRange | undefined>((range, event) => {
      const extent = extentOf(event);
      if (!extent) {
        return range;
      }
      return range === undefined
        ? extent
        : {
            start: Math.min(range.start, extent.start),
            end: Math.max(range.end, extent.end),
          };
    }, undefined);

    const rawBounds = aggregateBounds ?? eventBounds;
    const bounds = rawBounds === undefined ? undefined : padRange(rawBounds);

    // Clamped rather than reset: page filters can move under a selection, and a
    // window that no longer overlaps the session should read as "no selection"
    // instead of an empty rail with no way back.
    const window =
      selectedWindow === null || bounds === undefined
        ? null
        : selectedWindow.end < bounds.start || selectedWindow.start > bounds.end
          ? null
          : {
              start: Math.max(selectedWindow.start, bounds.start),
              end: Math.min(selectedWindow.end, bounds.end),
            };

    const visible = matching.filter(event => {
      if (!selectedTypes.has(event.key)) {
        return false;
      }
      if (window === null) {
        return true;
      }
      const extent = extentOf(event);
      // Overlap, not containment: a span that starts before the window but runs
      // into it is in the window.
      return (
        extent !== undefined && extent.start <= window.end && extent.end >= window.start
      );
    });

    return {
      bounds,
      counts,
      items: groupByTrace(visible),
      isFiltered: visible.length < events.length,
      isTruncated,
      name: resolveSessionName(sessionId, mergeIdentities(identities)),
      timestampsByType,
      truncatedByType,
      totalEvents: Object.values(counts).reduce((sum, count) => sum + count, 0),
      window,
    };
  }, [
    countQueries.results,
    rowQueries.results,
    sessionId,
    sort,
    filters.types,
    filters.query,
    selectedWindow,
  ]);

  return {
    ...detail,
    dateParams,
    filters,
    sortDirection,
    toggleSort,
    setWindow: setSelectedWindow,
    isPending: countQueries.isPending || rowQueries.isPending,
    isError: countQueries.isError || rowQueries.isError,
  };
}
