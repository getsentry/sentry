import {useCallback, useMemo, useState} from 'react';
import {SESSION_ID} from '@sentry/conventions/attributes';
import type {QueryFunctionContext} from '@tanstack/react-query';
import {skipToken, useQueries, useQuery} from '@tanstack/react-query';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
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
import {
  SESSION_DATASETS,
  withBaseFilter,
  withDatasetFilter,
} from 'sentry/views/explore/usersessions/datasets';
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

import type {BandTraces, ServiceBand} from './downstream';
import {
  buildServiceBand,
  DOWNSTREAM_FIELDS,
  DOWNSTREAM_FILTER,
  downstreamEventsByKey,
  NO_BAND_TRACES,
  selectBandTraces,
} from './downstream';
import {itemKey} from './itemKey';
import type {RouteBand} from './routeVisits';
import {buildRouteVisits, ROUTE_OPS} from './routeVisits';
import type {Row} from './rowConfig';
import {ROW_CONFIG} from './rowConfig';
import type {IdleAnalysis} from './timeScale';
import {findIdlePeriods} from './timeScale';

const REFERRER = 'api.explore.user-session-detail';

/**
 * The spans config, which the route band borrows for its dataset and page size.
 * Not for its `filter` — see the route query below for why arrivals cannot be
 * narrowed to segments the way the trace rows are.
 */
const TRACES = SESSION_DATASETS.find(config => config.key === 'traces')!;

/**
 * How many route arrivals to load.
 *
 * Pinned to the spans page size rather than chosen: the events endpoint *rejects*
 * a `per_page` over a dataset's cap instead of clamping it, so anything higher
 * here 400s every request rather than returning fewer rows. A hundred route
 * changes is a band of 10px segments anyway — far past what it can show — so this
 * costs nothing real, but it does mean the band can be capped, and it says so
 * when it is.
 */
const MAX_ARRIVALS = TRACES.pageSize;

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
 * the dataset's page size can't cover that in a single request. Traces and errors
 * are capped at 100 rows per request by the events endpoint, so they take ten
 * passes to reach the same depth logs and metrics get in one.
 *
 * Pages are fetched one at a time rather than fanned out: the endpoint allows 15
 * concurrent requests per org and the page already spends 8 of them on its first
 * paint. It also lets a dataset stop as soon as the session runs out of rows,
 * which is the common case — a session with under 100 traces still costs exactly
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
    return {
      headers: {},
      json: {rows: rows.slice(0, config.maxRows), hasMore},
    };
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
 * would not surface more rows — and the scrubber's lane counts stay exact.
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

/**
 * One timeline item. Every row on the rail is one of these — a trace (via the
 * segment span standing for it), a log, a metric or an error.
 */
export interface SessionEvent {
  detail: string | undefined;
  /**
   * Duration in ms, for the kinds that report one. Only traces do: logs, metrics
   * and errors are instants and leave this undefined, which is what decides
   * whether a rail row draws a duration bar and whether a swimlane draws this
   * item as a span of time rather than a dot.
   */
  duration: number | undefined;
  /** Telemetry kind this row came from. */
  key: SessionDatasetKey;
  row: Row;
  /** Epoch ms, parsed from the uniform `timestamp` field. */
  timestamp: number | undefined;
  title: string;
}

/** Epoch-ms range. Used both for the session's own extent and for a selection. */
export interface SessionRange {
  end: number;
  start: number;
}

export interface SessionDetail {
  /**
   * The session's extent, which is the domain every relative offset and every
   * density bar is measured against. Undefined only when the session has no
   * telemetry at all.
   */
  bounds: SessionRange | undefined;
  counts: Record<SessionDatasetKey, number>;
  /**
   * Every fetched item by {@link itemKey}, so a selection can be resolved from
   * the URL. Indexes the same set as {@link eventsByType} — text-filtered, but
   * not narrowed by the window or the type toggles, so a linked item still opens
   * when its lane happens to be switched off.
   */
  eventsByKey: Map<string, SessionEvent>;
  /**
   * Every fetched item, per dataset, ascending by timestamp. Backs the
   * scrubber's density lanes and the hit testing over them. Narrowed by the text
   * filter — so searching also shows *where* in the session the matches are —
   * but never by the selected window or the type toggles, since those are what
   * the lanes are used to drive.
   */
  eventsByType: Record<SessionDatasetKey, SessionEvent[]>;
  /**
   * Where the session was idle, and how busy it was in between.
   *
   * Built from every fetched row rather than from the filtered ones, because the
   * axis it feeds is a property of the session: one that reflowed as someone typed
   * in the search box would change the session's shape mid-query, and the shape is
   * what they are searching *within*.
   */
  idle: IdleAnalysis;
  /** True when a filter is hiding rows the session actually has. */
  isFiltered: boolean;
  /** True when any dataset returned a full page, so the timeline may be truncated. */
  isTruncated: boolean;
  /** The rows the rail renders: what survived the filters and the window. */
  items: SessionEvent[];
  /**
   * Every row that was fetched, before any filter or window narrowed it. The
   * denominator for `items`, and deliberately not `totalEvents`: that one is a sum
   * of aggregates, and `count_unique(trace)` counts distinct traces while the rail
   * draws one row per segment span. A trace with a pageload and a server
   * transaction is one there and two here, so the two are not comparable.
   */
  loadedEvents: number;
  /** What to call this session, resolved from the telemetry it carries. */
  name: SessionName;
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

/** The range covering both, or whichever one exists. */
function unionRanges(
  a: SessionRange | undefined,
  b: SessionRange | undefined
): SessionRange | undefined {
  if (a === undefined) {
    return b;
  }
  if (b === undefined) {
    return a;
  }
  return {start: Math.min(a.start, b.start), end: Math.max(a.end, b.end)};
}

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

/** Where an item sits on the time axis, its duration included. */
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
          query: withBaseFilter(config, commonQuery.query),
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
      // Feedback rides on issuePlatform and is best-effort: a failure there must
      // not blank a timeline the other four datasets can still fill.
      isError: results.some(
        (result, index) => SESSION_DATASETS[index]!.key !== 'feedback' && result.isError
      ),
    }),
  });

  /**
   * The session's route arrivals — the `pageload` and `navigation` segment spans
   * the route band is built from.
   *
   * A query of its own rather than a filter over the trace rows already fetched,
   * for two reasons. Those rows are capped at `maxRows` and sorted newest-first,
   * so a chatty session would silently lose its *earliest* arrivals — and the
   * first one is the one that establishes which route the session began on. They
   * are also narrowed by the text filter, and the band is context for the whole
   * session rather than a view of what matched a search. Arrivals are a few rows
   * either way, so asking for them exactly is cheaper than it looks.
   *
   * Ascending, unlike the rows: if this ever does truncate, the beginning of the
   * journey is the half worth keeping.
   */
  const routeQuery = useQuery(
    apiOptions.as<EventsResponse>()('/organizations/$organizationIdOrSlug/events/', {
      path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        ...commonQuery,
        dataset: TRACES.dataset,
        // Narrowed by op alone — deliberately *not* by `is_transaction:true` the
        // way the trace rows are.
        //
        // A `navigation.redirect` is recorded as a plain child span rather than a
        // segment (the SDK ends it inline instead of promoting it to a
        // transaction), so a segment filter drops the very arrivals this band is
        // missing. The op set is already the discriminator: nothing but a route
        // span carries these ops, so `is_transaction` adds no precision here —
        // only a blind spot. It comes back as a *field* instead, because how a row
        // names its route depends on whether it is a segment.
        query: `${commonQuery.query} span.op:[${ROUTE_OPS.join(',')}]`,
        // `span.name` first among the naming fields because it is the only one that
        // is per-span: `transaction` resolves to the *segment's* name and can belong
        // to a different segment in the same trace. See `readRoute`.
        field: ['timestamp', 'span.op', 'span.name', 'span.description', 'transaction'],
        sort: 'timestamp',
        per_page: MAX_ARRIVALS,
      },
      staleTime: 0,
    })
  );

  const rowQueries = useQueries({
    queries: SESSION_DATASETS.map(config => ({
      ...apiOptions.as<TimelineRows>()('/organizations/$organizationIdOrSlug/events/', {
        path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          ...commonQuery,
          dataset: config.dataset,
          // The rows are narrowed further than the counts above: `traces` renders
          // one row per segment span, while its count stays over every span.
          query: withDatasetFilter(config, withBaseFilter(config, commonQuery.query)),
          field: ['timestamp', 'project.id', ...ROW_CONFIG[config.key].fields],
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
      // Feedback rides on issuePlatform and is best-effort: a failure there must
      // not blank a timeline the other four datasets can still fill.
      isError: results.some(
        (result, index) => SESSION_DATASETS[index]!.key !== 'feedback' && result.isError
      ),
    }),
  });

  /** Where the trace rows sit in the fan-out, so the band can read them back. */
  const tracesIndex = SESSION_DATASETS.findIndex(config => config.key === 'traces');

  /**
   * The traces the services band joins on, and the stretch the cap skipped.
   *
   * Derived from the raw query results rather than from `detail` on purpose. The
   * band's query is keyed on these ids, and `detail` moves with the text filter,
   * the type toggles, the sort and the scrubber's window — none of which should
   * cost a refetch of the backend half of the page.
   */
  const bandTraces = useMemo((): BandTraces => {
    const rows = rowQueries.results[tracesIndex]?.data?.rows;
    return rows === undefined ? NO_BAND_TRACES : selectBandTraces(rows);
  }, [rowQueries.results, tracesIndex]);

  /**
   * The session's downstream work: every server segment span in the traces the
   * frontend started.
   *
   * Two things separate this from every other query on the page. It carries no
   * `session.id` term — backend SDKs never see one, and the trace id the frontend
   * *does* propagate is the whole join. And it is not scoped to the page's project
   * filter: a trace can end up in any project in the org, which is exactly what
   * this band exists to show. `ALL_ACCESS_PROJECTS` is how the trace endpoint
   * solves the same problem server-side, and permissions still apply — a service
   * the reader cannot see is silently absent, which is why the band's header says
   * "reached" rather than claiming to be complete.
   */
  const servicesQuery = useQuery(
    apiOptions.as<EventsResponse>()('/organizations/$organizationIdOrSlug/events/', {
      path:
        enabled && bandTraces.ids.length > 0
          ? {organizationIdOrSlug: organization.slug}
          : skipToken,
      query: {
        ...commonQuery,
        project: [ALL_ACCESS_PROJECTS],
        dataset: TRACES.dataset,
        query: `trace:[${bandTraces.ids.join(',')}] ${DOWNSTREAM_FILTER}`,
        field: DOWNSTREAM_FIELDS,
        sort: 'timestamp',
        per_page: TRACES.pageSize,
      },
      staleTime: 0,
    })
  );

  const detail = useMemo((): SessionDetail => {
    const counts: Record<SessionDatasetKey, number> = {
      logs: 0,
      metrics: 0,
      traces: 0,
      errors: 0,
      feedback: 0,
    };
    const truncatedByType: Record<SessionDatasetKey, boolean> = {
      logs: false,
      metrics: false,
      traces: false,
      errors: false,
      feedback: false,
    };
    const eventsByType: Record<SessionDatasetKey, SessionEvent[]> = {
      logs: [],
      metrics: [],
      traces: [],
      errors: [],
      feedback: [],
    };
    const eventsByKey = new Map<string, SessionEvent>();

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
      // An empty aggregate still returns one row: on `issuePlatform` its
      // `min(timestamp)` comes back as the epoch-0 string rather than null, which
      // would otherwise drag the session's start back to 1970. A dataset with no
      // events has no extent to contribute.
      if (counts[config.key] > 0 && firstSeen !== undefined) {
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

    // Every fetched item's extent, which is what the idle stretches are the
    // complement of. Deliberately upstream of the filters below: see `idle`.
    const activity: SessionRange[] = [];
    events.forEach(event => {
      const extent = extentOf(event);
      if (extent !== undefined) {
        activity.push(extent);
      }
    });

    // Filtered before grouping, so a run of same-trace spans is only collapsed
    // out of the rows that survive the filter.
    const selectedTypes = new Set(filters.types);
    const needle = filters.query.trim().toLowerCase();
    const matching = events.filter(event => needle === '' || matchesQuery(event, needle));

    matching.forEach(event => {
      const key = itemKey(event);
      if (key !== undefined) {
        eventsByKey.set(key, event);
      }
      if (event.timestamp !== undefined) {
        eventsByType[event.key].push(event);
      }
    });

    // The merged list runs in whichever direction the user sorted; the lanes read
    // left to right either way, and hit testing wants one stable order.
    Object.values(eventsByType).forEach(lane =>
      lane.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    );

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

    /**
     * The union of both, not one or the other.
     *
     * The aggregates are exact and survive truncation, so they carry the session's
     * real extent — a capped page's first and last row are not the session's. But
     * they are read from different columns than the rows are plotted by:
     * `precise.start_ts` is sub-second while a row's `timestamp` is coarser, so a
     * row can sit a fraction of a second *outside* an extent taken from
     * aggregates alone. Anything drawn has to be inside the domain it is
     * positioned against, or it lands at a negative offset and a trace's bar
     * reaches back over the lane labels.
     */
    const rawBounds = unionRanges(aggregateBounds, eventBounds);
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
      eventsByKey,
      eventsByType,
      idle:
        bounds === undefined
          ? {gaps: [], regions: []}
          : findIdlePeriods(activity, bounds),
      items: visible,
      loadedEvents: events.length,
      isFiltered: visible.length < events.length,
      isTruncated,
      name: resolveSessionName(sessionId, mergeIdentities(identities)),
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

  /**
   * Derived here rather than in the scrubber because it needs `bounds`, which the
   * pass above is what establishes — a visit's extent is only meaningful against
   * the session's own.
   */
  const routes = useMemo((): RouteBand => {
    const rows = routeQuery.data?.data ?? [];
    return {
      visits: buildRouteVisits(rows, detail.bounds),
      // Inferred from the row count rather than read off the `Link` header, which
      // would cost this query the pagination handling the row queries need. It can
      // therefore cry truncation for a session holding exactly `MAX_ARRIVALS`
      // arrivals — a hundred route changes, where an over-cautious marker is not
      // the problem.
      isTruncated: rows.length >= MAX_ARRIVALS,
      isError: routeQuery.isError,
    };
  }, [routeQuery.data, routeQuery.isError, detail.bounds]);

  /**
   * Derived here rather than in the scrubber for the same reason the routes are:
   * a service's activity is only meaningful clamped against the session's own
   * extent, and `bounds` is what the pass above establishes.
   */
  const services = useMemo(
    (): ServiceBand =>
      buildServiceBand(servicesQuery.data?.data ?? [], detail.bounds, {
        isError: servicesQuery.isError,
        // Inferred from the row count rather than read off the `Link` header,
        // which would cost this query the pagination handling the row queries
        // need. A session that lands on exactly a full page is called truncated,
        // which is the over-cautious direction.
        isTruncated: (servicesQuery.data?.data.length ?? 0) >= TRACES.pageSize,
        unloaded: bandTraces.unloaded,
      }),
    [servicesQuery.data, servicesQuery.isError, detail.bounds, bandTraces.unloaded]
  );

  /**
   * The timeline's items plus the band's, under one index.
   *
   * Unioned here rather than inside `detail` because the band is a second wave —
   * it is keyed on trace ids that only exist once the rows have landed, so it
   * cannot be part of the pass that produces them. The selection, the `item` URL
   * param and the details panel all read this one map, which is what lets a
   * service bar open the same panel a rail row does.
   */
  const eventsByKey = useMemo(
    () => new Map([...detail.eventsByKey, ...downstreamEventsByKey(services)]),
    [detail.eventsByKey, services]
  );

  return {
    ...detail,
    eventsByKey,
    routes,
    services,
    /** How many traces the band's cap skipped, for its footnote. */
    skippedBandTraces: bandTraces.skipped,
    dateParams,
    filters,
    sortDirection,
    toggleSort,
    setWindow: setSelectedWindow,
    // The route query is in here so the chart is drawn at its final height once
    // rather than growing a row under the pointer. It is the cheapest of the
    // five — one page, no pagination loop — so it is rarely the straggler.
    isPending: countQueries.isPending || rowQueries.isPending || routeQuery.isPending,
    /**
     * Deliberately *not* folded into `isPending` the way the route query is.
     *
     * It cannot be: it is keyed on trace ids that only exist once the rows have
     * landed, so waiting on it would hold the whole chart behind a second wave.
     * The band grows in underneath instead, which is a row appearing below
     * everything rather than the chart reflowing around it.
     */
    isServicesPending: servicesQuery.isPending,
    // Deliberately *not* in `isError`: a band that failed to load is a missing
    // band, not a broken timeline, and the rail below still reads fine. It is not
    // swallowed either — each band's own label carries its failure, or a
    // permanently broken query would look exactly like a session that never
    // navigated anywhere and never called a server.
    isError: countQueries.isError || rowQueries.isError,
  };
}
