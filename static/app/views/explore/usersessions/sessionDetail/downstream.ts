import {itemKey} from './itemKey';
import {ROUTE_OPS} from './routeVisits';
import type {Row} from './rowConfig';
import {ROW_CONFIG} from './rowConfig';
import type {SessionEvent, SessionRange} from './useSessionDetail';

/**
 * How a downstream span is titled and measured. The same config the rail's trace
 * rows use, so a server segment reads as the same kind of thing wherever it is
 * shown — which is the point of giving it the `traces` kind at all.
 */
const TRACE_ROW = ROW_CONFIG.traces;

/**
 * How many of the session's traces the services band is built from: the first
 * ten and the last ten.
 *
 * The cap is on the *join*, not on what the endpoint will serve. Downstream work
 * is reached by asking for every server span in a set of trace ids, and that set
 * has to travel in the query string — a thousand of them is 32KB of URL, which no
 * GET survives. Twenty keeps the clause small enough to send and selective enough
 * that widening the query to every project (see `useSessionDetail`) still reads a
 * narrow slice.
 *
 * Split across both ends rather than taken from one: the start of a session is
 * where its setup calls are and the end is where whatever went wrong usually is,
 * and a band drawn from only one of those would be a band about half a session.
 */
export const BAND_TRACES_PER_END = 10;
const MAX_BAND_TRACES = BAND_TRACES_PER_END * 2;

/**
 * What makes a segment span *downstream*, as a query fragment.
 *
 * An inverted allowlist, and deliberately so. The set of client segment ops is
 * small and stable — a browser arrives somewhere or the user interacts — while
 * the set of backend ops is unbounded and grows with every integration. Naming
 * the ones to exclude therefore stays correct as new server ops appear, where
 * naming the ones to include would silently drop them.
 *
 * This is also the only thing that separates client from server in a
 * meta-framework. A Next.js app ships both halves to the same project under the
 * same `sdk.name`, so `project.id` and SDK metadata both fail to tell a pageload
 * from the server action beneath it. Their ops never collide.
 *
 * `is_transaction:true` narrows to segment spans for the same reason the trace
 * lane does: a session's individual spans run into the thousands, and the segment
 * is the one that stands for a unit of server work.
 */
export const DOWNSTREAM_FILTER = [
  'is_transaction:true',
  `!span.op:[${ROUTE_OPS.join(',')}]`,
  // Interaction traces. Matched by prefix because the op carries the interaction
  // (`ui.action.click`), unlike the arrival ops above, which are an exact set.
  '!span.op:ui.action*',
].join(' ');

/**
 * Fields the band's query reads.
 *
 * More than the band itself draws, because a bar is clickable: selecting one opens
 * the same details panel a rail row does, and that panel resolves an item the way
 * it resolves any other — through `ROW_CONFIG.traces`. So the row has to carry
 * what a trace row carries: an `id` to be addressed by, a `project.id` to resolve
 * a slug from, and the three fields the config titles a trace with.
 */
export const DOWNSTREAM_FIELDS = [
  'id',
  'project',
  'project.id',
  'timestamp',
  'transaction',
  'span.op',
  'span.description',
  'span.duration',
  'span.status',
  'trace',
];

/**
 * Span statuses that are not a failure.
 *
 * `unknown` is in here rather than out of it: it is what a span carries when
 * nothing set a status, which is the common case for backend work that completed
 * normally. Treating it as bad would paint most of the band red.
 */
const HEALTHY_STATUSES = new Set(['ok', 'unknown', 'unset', '']);

/** The traces the band is joined on, and what asking for only those cost us. */
export interface BandTraces {
  ids: string[];
  /**
   * How many of the session's traces fall between the two ends and were never
   * asked for. Zero when the session has `MAX_BAND_TRACES` or fewer.
   */
  skipped: number;
  /**
   * The stretch of the session the band knows nothing about, or null when nothing
   * was skipped. Rendered explicitly: a hole drawn as empty track would say no
   * backend work happened there, which is the one thing we cannot know.
   */
  unloaded: SessionRange | null;
}

export const NO_BAND_TRACES: BandTraces = {
  ids: [],
  skipped: 0,
  unloaded: null,
};

/**
 * One stretch of server work: where to draw it, and the item it stands for.
 *
 * The event is what makes a bar clickable. It is a `traces` item like any other —
 * a segment span with a trace behind it — so the details panel opens it with the
 * same waterfall and the same "Open Full Trace" it gives a rail row, and the URL
 * addresses it with the same `itemKey`.
 */
export interface ServiceActivity {
  event: SessionEvent;
  /**
   * This span came back with a failing status.
   *
   * Carried per stretch rather than per row, because that is the grain the failure
   * happened at. A service that answered a hundred calls and dropped one did not
   * fail — one call did, and colouring the whole row would lose the difference
   * between a service that is broken and a service that had a bad request.
   */
  hasFailure: boolean;
  /** `itemKey(event)`, resolved once here since the bar is addressed by it. */
  key: string;
  range: SessionRange;
}

/** One downstream service, and when it was working. */
export interface ServiceLane {
  /** Every stretch this service was busy, ascending, clamped into the session. */
  activity: ServiceActivity[];
  /** The project slug, which is both the lane's identity and its label. */
  project: string;
}

/**
 * The services band, and what to trust about it.
 *
 * The flags are why this is a shape rather than a bare array, for the same reason
 * `RouteBand` carries its own: a band that is empty because the session touched no
 * backend looks exactly like one that is empty because its query 400'd, and the
 * difference is the whole diagnosis.
 */
export interface ServiceBand {
  /** The band's query failed. Downstream is unknown, not absent. */
  isError: boolean;
  /** The query returned a full page, so a service may be missing entirely. */
  isTruncated: boolean;
  lanes: ServiceLane[];
  /** The stretch between the two ends of the trace cap. */
  unloaded: SessionRange | null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * A span row's `timestamp` as epoch ms.
 *
 * The coarse field rather than `precise.start_ts`, deliberately: the band is drawn
 * against the same axis as the trace lane above it, and that lane positions by
 * `timestamp`. Sub-second precision here would put a service's bar a few pixels
 * off the trace that called it — a visible disagreement bought for precision
 * nothing at this scale can use.
 */
function epochMs(value: unknown): number | undefined {
  const timestamp = str(value);
  if (timestamp === undefined) {
    return undefined;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Which traces to join on: the first ten and the last ten the session started.
 *
 * Built from the trace rows already on the page rather than from a query of its
 * own, so the band costs one request rather than two waves of them. The rows are
 * capped at `maxRows` though, so a session past that cap has a row set that is
 * itself truncated and its "last ten" can be short of the session's real last —
 * which is the case `truncatedByType.traces` already marks on the trace lane.
 *
 * Ordered by time rather than by the rail's sort. The sort is a toggle and the
 * query key is not allowed to move under it, or flipping the rail would refetch
 * the whole band.
 */
export function selectBandTraces(rows: Row[]): BandTraces {
  /** Earliest sighting per trace, since a trace can carry several segments. */
  const firstSeen = new Map<string, number>();
  /** Latest end per trace, which is where the unloaded stretch begins. */
  const lastSeen = new Map<string, number>();

  rows.forEach(row => {
    const trace = str(row.trace);
    const start = epochMs(row.timestamp);
    if (trace === undefined || start === undefined) {
      return;
    }
    const duration = row['span.duration'];
    const end = start + (typeof duration === 'number' && duration > 0 ? duration : 0);
    firstSeen.set(trace, Math.min(firstSeen.get(trace) ?? start, start));
    lastSeen.set(trace, Math.max(lastSeen.get(trace) ?? end, end));
  });

  const ordered = [...firstSeen.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([trace]) => trace);

  if (ordered.length <= MAX_BAND_TRACES) {
    return {ids: ordered, skipped: 0, unloaded: null};
  }

  const head = ordered.slice(0, BAND_TRACES_PER_END);
  const tail = ordered.slice(-BAND_TRACES_PER_END);
  const lastOfHead = head[head.length - 1]!;
  const firstOfTail = tail[0]!;

  return {
    ids: [...head, ...tail],
    skipped: ordered.length - MAX_BAND_TRACES,
    // From the end of the last trace we asked for to the start of the next one we
    // did, so the marker covers exactly the time no query looked at.
    unloaded: {
      start: lastSeen.get(lastOfHead) ?? firstSeen.get(lastOfHead)!,
      end: firstSeen.get(firstOfTail)!,
    },
  };
}

/** The stretch a span occupied, clamped into the session's own extent. */
function activityOf(row: Row, bounds: SessionRange): SessionRange | undefined {
  const start = epochMs(row.timestamp);
  if (start === undefined) {
    return undefined;
  }
  const duration = row['span.duration'];
  const end = start + (typeof duration === 'number' && duration > 0 ? duration : 0);
  // Clamped rather than dropped: a server span can outrun the session's extent,
  // which is defined by the frontend's telemetry and deliberately does not grow to
  // cover downstream work.
  if (end < bounds.start || start > bounds.end) {
    return undefined;
  }
  return {
    start: Math.max(start, bounds.start),
    end: Math.min(Math.max(end, start), bounds.end),
  };
}

/**
 * Groups the band's spans into one row per project.
 *
 * Rows are ordered by when the session first reached them, so the band reads top
 * to bottom as the order things were called rather than alphabetically — which is
 * the same reading the lanes above it already have.
 */
export function buildServiceBand(
  rows: Row[],
  bounds: SessionRange | undefined,
  {isError, isTruncated, unloaded}: Omit<ServiceBand, 'lanes'>
): ServiceBand {
  if (bounds === undefined) {
    return {lanes: [], isError, isTruncated, unloaded};
  }

  const byProject = new Map<string, ServiceLane>();

  rows.forEach(row => {
    const project = str(row.project);
    if (project === undefined) {
      return;
    }
    const range = activityOf(row, bounds);
    if (range === undefined) {
      return;
    }
    // A `traces` item, because that is what a server segment span is — the same
    // kind the rail's trace rows are, reached through a different query. Giving it
    // its own kind would need a lane icon, a severity rule and a detail renderer
    // for something the existing three already describe.
    const event: SessionEvent = {
      key: 'traces',
      row,
      timestamp: range.start,
      title: TRACE_ROW.getTitle(row),
      detail: TRACE_ROW.getDetail?.(row),
      duration: TRACE_ROW.getDuration?.(row),
    };
    const key = itemKey(event);
    if (key === undefined) {
      // No span id means nothing to address the bar by, and an unclickable bar in
      // a band where every other one opens something is worse than one less bar.
      return;
    }
    let lane = byProject.get(project);
    if (lane === undefined) {
      lane = {project, activity: []};
      byProject.set(project, lane);
    }
    const status = str(row['span.status']);
    lane.activity.push({
      event,
      key,
      range,
      hasFailure: status !== undefined && !HEALTHY_STATUSES.has(status),
    });
  });

  const lanes = [...byProject.values()];
  lanes.forEach(lane => lane.activity.sort((a, b) => a.range.start - b.range.start));
  lanes.sort(
    (a, b) => (a.activity[0]?.range.start ?? 0) - (b.activity[0]?.range.start ?? 0)
  );

  return {lanes, isError, isTruncated, unloaded};
}

/**
 * Every downstream item by `itemKey`, so a selected bar resolves the same way a
 * selected rail row does.
 *
 * Merged into the timeline's own index rather than kept beside it: the details
 * panel, the URL's `item` param and the scrubber's selection all read one map, and
 * a second lookup path for downstream items would be three places to keep in step.
 */
export function downstreamEventsByKey(band: ServiceBand): Map<string, SessionEvent> {
  const byKey = new Map<string, SessionEvent>();
  band.lanes.forEach(lane => {
    lane.activity.forEach(({key, event}) => byKey.set(key, event));
  });
  return byKey;
}

/**
 * Which shortfall the band's footnote is about, or null when there is none.
 *
 * One marker for three different shortfalls, the way the route band's is one
 * marker for two: they are all "this band is not the whole story", and which one
 * it is belongs in the tooltip rather than in three competing glyphs. The copy
 * itself lives with the component, which is where the interpolation can be a node
 * rather than a string.
 */
export type BandCaveat = 'error' | 'truncated' | 'skipped';

export function bandCaveat(band: ServiceBand, skipped: number): BandCaveat | null {
  if (band.isError) {
    return 'error';
  }
  if (band.isTruncated) {
    return 'truncated';
  }
  return skipped > 0 ? 'skipped' : null;
}
