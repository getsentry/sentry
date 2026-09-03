import type {Row} from './rowConfig';
import type {SessionRange} from './useSessionDetail';

/**
 * The span ops that mean "the user arrived somewhere new".
 *
 * A `pageload` is a fresh document and a `navigation` is a client-side route
 * change within one. `navigation.redirect` is the same event under a different
 * name: when the browser SDK sees a history change while another route span is
 * still open and no interaction preceded it, it records the arrival as a redirect
 * instead (`browserTracingIntegration`'s `startNavigationSpan`). The user still
 * ended up somewhere else, so the band has to count it.
 *
 * Matching is exact, not by prefix — `span.op:[a,b]` is an equality set — so every
 * variant has to be named here or it is silently invisible.
 */
export const ROUTE_OPS = ['pageload', 'navigation', 'navigation.redirect'] as const;

export type RouteOp = (typeof ROUTE_OPS)[number];

/**
 * The route band and what to trust about it.
 *
 * The two flags are why this is a shape rather than a bare array: a band that is
 * empty because the session visited nothing looks exactly like one that is empty
 * because its query 400'd, and the difference is the whole diagnosis.
 */
export interface RouteBand {
  /** The arrivals query failed. The band is unknown, not absent. */
  isError: boolean;
  /** The session had at least as many arrivals as were asked for. */
  isTruncated: boolean;
  visits: RouteVisit[];
}

/** One continuous stay on one route. */
export interface RouteVisit {
  /**
   * Which of the recycled route colors this one takes. Assigned per *distinct*
   * route rather than per visit, so coming back to `/cart` looks like `/cart`.
   */
  colorIndex: number;
  /** Epoch ms the user left: the next arrival, or the end of the session. */
  end: number;
  /** How the user got here. Worth saying: a pageload means a fresh document. */
  op: RouteOp;
  /** The route itself — parameterized, where the SDK could name one. */
  route: string;
  /** Epoch ms the user arrived, clamped into the session's extent. */
  start: number;
}

/**
 * How close two same-route arrivals have to be before they count as one.
 *
 * Sized to the artifact it exists to absorb — a re-render or a query-param change
 * firing a second navigation span, which follows the first within milliseconds —
 * rather than to anything a person could do. Note that `timestamp` comes back
 * truncated to the second on this dataset (`precise.start_ts` is where the
 * sub-second part lives), so in practice this collapses arrivals landing in the
 * same second or the one adjacent to it.
 */
const SAME_ARRIVAL_MS = 1000;

/** An arrival span, reduced to the three things a visit is built from. */
interface Arrival {
  op: RouteOp;
  route: string;
  timestamp: number;
}

function isRouteOp(value: unknown): value is RouteOp {
  return ROUTE_OPS.includes(value as RouteOp);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * Where the user ended up, read from the arrival span's *own* name.
 *
 * `transaction` is deliberately last, and it is the field this used to lead with.
 * On EAP it resolves to `sentry.segment_name`, which is a *segment*-level attribute
 * rather than the span's: `_add_segment_name` stamps one chosen segment span's name
 * across every span in the batch that lacks one, and `_find_segment_span` documents
 * that a batch holding more than one segment span "does not have defined behavior"
 * — it just walks backwards and takes the first it finds.
 *
 * So in a trace carrying both a `ui.action.click` segment and a `navigation`
 * segment, the navigation's `transaction` can be the *click's* route: the page the
 * user was leaving. Naming the arrival from it made the arrival look like a stay on
 * the route already showing, and the merge below then dropped it — a navigation
 * that drew no new route at all.
 *
 * `span.name` (`sentry.name`) is set per span from the payload's own `name` field
 * and never shared across a batch, so it is the destination whether the arrival is
 * a segment or a child span. For a route span that name *is* the route — the
 * parameterized one wherever a router integration supplied it.
 */
function readRoute(row: Row): string | undefined {
  return (
    str(row['span.name']) ??
    str(row['span.description']) ??
    // Only trustworthy when the trace holds a single segment, which is why it is
    // the last resort rather than the first choice.
    str(row.transaction)
  );
}

/**
 * One arrival span, or nothing if the row can't place itself on a route or in time.
 *
 * Read from the coarse `timestamp` field rather than from `precise.start_ts`,
 * deliberately: this band is drawn against the same axis as the trace lane below
 * it, and that lane positions by `timestamp`. Sub-second precision here would put
 * a route boundary a few pixels off the pageload bar that opened it — a visible
 * lie about which route a trace belongs to, bought for precision nothing at this
 * scale can use.
 */
function readArrival(row: Row): Arrival | undefined {
  const op = row['span.op'];
  if (!isRouteOp(op)) {
    return undefined;
  }

  const route = readRoute(row);
  const raw = str(row.timestamp);
  if (route === undefined || raw === undefined) {
    return undefined;
  }
  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }
  return {op, route, timestamp};
}

/**
 * The session's journey: contiguous route visits tiling the session's extent.
 *
 * A visit runs from its arrival to the *next* arrival, which is the only way to
 * answer "how long was the user on this route". An arrival span's own duration
 * cannot: a pageload's duration is how long the page took to load, and a
 * navigation's is how long the route transition took — both are a fraction of a
 * second inside a stay that may run for minutes.
 *
 * Two arrivals on the same route are only merged when they land within
 * {@link SAME_ARRIVAL_MS} of each other — a re-render or a query-param change
 * firing a second navigation span, where a boundary really would mark nothing.
 *
 * Beyond that window they stay two visits, *even on the same route*. Navigating
 * back to where you just were is a real arrival, and name equality cannot tell it
 * apart from a duplicate: collapsing on the name alone made a genuine
 * `router.push` vanish whenever the route before it happened to resolve the same
 * way. Two abutting segments of one color, divided by a rule, is the honest
 * drawing of that — the route did not change, but something happened.
 *
 * The band is only ever as complete as the arrivals it was given. A session whose
 * first arrival landed after `bounds.start` — telemetry from before the SDK saw a
 * pageload — gets a leading gap rather than a guess, because the route in that
 * stretch is genuinely unknown.
 */
export function buildRouteVisits(
  rows: Row[],
  bounds: SessionRange | undefined
): RouteVisit[] {
  if (bounds === undefined) {
    return [];
  }

  const arrivals = rows
    .map(readArrival)
    .filter((arrival): arrival is Arrival => arrival !== undefined)
    // An arrival past the session's extent has no room to be drawn in. Ones
    // *before* it are kept and clamped below: the user was already on that route
    // when the extent opened.
    .filter(arrival => arrival.timestamp <= bounds.end)
    .sort((a, b) => a.timestamp - b.timestamp);

  const colorIndexes = new Map<string, number>();
  const visits: RouteVisit[] = [];

  arrivals.forEach(arrival => {
    const previous = visits.at(-1);
    if (
      previous?.route === arrival.route &&
      arrival.timestamp - previous.start <= SAME_ARRIVAL_MS
    ) {
      return;
    }

    const start = Math.max(arrival.timestamp, bounds.start);
    // Every visit is opened running to the end of the session, and closed again
    // by whichever arrival turns out to follow it. The last one is never closed,
    // which is exactly right — the user was still there when the session ended.
    if (previous) {
      previous.end = start;
    }
    if (!colorIndexes.has(arrival.route)) {
      colorIndexes.set(arrival.route, colorIndexes.size);
    }
    visits.push({
      colorIndex: colorIndexes.get(arrival.route)!,
      end: bounds.end,
      op: arrival.op,
      route: arrival.route,
      start,
    });
  });

  // Two arrivals in the same millisecond, or several clamped to the same start,
  // leave a stay with no width. Dropping them closes no gap — the visit that
  // followed already starts where they did.
  return visits.filter(visit => visit.end > visit.start);
}
