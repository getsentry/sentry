import {Fragment, memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconStack, IconWindow} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/platform';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useProjects} from 'sentry/utils/useProjects';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import type {ServiceActivity, ServiceBand, ServiceLane} from './downstream';
import {BAND_TRACES_PER_END, bandCaveat} from './downstream';
import {itemKey} from './itemKey';
import type {RouteBand, RouteVisit} from './routeVisits';
import {formatDurationMs, formatOffset} from './sessionTime';
import {graphicsColor} from './severity';
import {TelemetryTypeIcon} from './telemetryTypeIcon';
import {TimelineSettings} from './timelineSettings';
import type {IdleAnalysis, ScaleSegment, TimeScale} from './timeScale';
import {BREAK_PX, buildTimeScale} from './timeScale';
import type {SessionEvent, SessionRange} from './useSessionDetail';

/**
 * Every lane a session can have, most-severe first rather than in dataset order:
 * an error lane at the top is the first thing scanned, and it is most often what
 * explains the session.
 *
 * Which of them a *given* session draws is decided at render, since a lane holding
 * nothing is left out; see `visibleLanes`.
 */
const LANE_ORDER: SessionDatasetKey[] = [
  'errors',
  'feedback',
  'traces',
  'logs',
  'metrics',
];

const LANES = LANE_ORDER.map(key => SESSION_DATASETS.find(config => config.key === key)!);

const HEADER_HEIGHT = 28;
const LANE_HEIGHT = 40;
/** Kept whole: split across lines by the formatter, `repeat (…)` is not CSS. */
function laneRows(count: number) {
  return `repeat(${count}, ${LANE_HEIGHT}px)`;
}

/**
 * The overview strip: the whole session, however far the lanes are zoomed into it.
 *
 * Short on purpose. It is not a lane and has nothing to say about what happened —
 * only where in the session the lanes below are currently pointed, and roughly
 * where else there would be something worth pointing at.
 */
const OVERVIEW_HEIGHT = 20;

/**
 * The route band. Shorter than a telemetry lane: it holds one row of text rather
 * than markers that need vertical room to differ in size.
 */
const ROUTE_HEIGHT = 30;

/**
 * The services band: its heading, and one row per service under it.
 *
 * A service row is shorter than a telemetry lane because it holds less. A lane
 * has to fit markers that differ in height — that difference is how it says how
 * much landed where — while a service row carries flat bars that only differ in
 * width, and vertical room they cannot use just pushes the rail further down the
 * page.
 *
 * The heading is what keeps the band from reading as five more lanes. Everything
 * above it is the client's own telemetry, sorted by kind; everything below it is
 * somewhere else entirely, sorted by who did the work. That is a different axis,
 * and it needs a rule and a name rather than just a gap.
 */
const SERVICE_HEADER_HEIGHT = 22;
const SERVICE_HEIGHT = 26;

/**
 * A service bar. Flatter than a trace bar in the lanes above, because it is
 * carrying less: a lane's bar is one item you can click, while these are the shape
 * of a service's working time and nothing more.
 */
const SERVICE_BAR_HEIGHT = 8;
/** A server call can be shorter than a pixel of session. It still happened. */
const SERVICE_BAR_MIN_PX = 3;

/**
 * The heading, plus a row per service. `repeat(0, …)` is invalid, so a band that
 * has only its heading to show — which is what a failed query leaves — emits the
 * heading alone.
 */
function serviceRows(count: number) {
  const rows = count > 0 ? ` repeat(${count}, ${SERVICE_HEIGHT}px)` : '';
  return `${SERVICE_HEADER_HEIGHT}px${rows}`;
}

/**
 * Which of the chart palettes the route band recycles. This one is eleven distinct
 * hues, which is more distinct routes than a readable band holds anyway — past
 * that they repeat, and two same-coloured segments far apart is a much smaller lie
 * than two indistinguishable ones side by side. (The palettes are addressed by
 * `length - 1`, hence 10 for eleven colors.)
 */
const ROUTE_PALETTE = 10;

/** A route segment narrower than this has no room for its own name. */
const ROUTE_LABEL_MIN_PX = 44;

/**
 * Marker extremes for the density lanes. The floor is a dot rather than a sliver:
 * a lone error and a burst of forty are both worth seeing, and a one-pixel tick is
 * not seen.
 */
const MARKER_MIN = 8;
const MARKER_MAX = 26;

/**
 * The duration lanes draw one bar per item instead. A fixed height, because the
 * axis it is being read against is time — a bar that also varied in height would
 * invite comparing two things at once.
 */
const BAR_HEIGHT = 12;
/** A trace can be shorter than a pixel of session. It still happened. */
const BAR_MIN_PX = 3;
/**
 * How far a highlight sits outside the mark it is calling out, on every side. Used
 * by the bar outline in both directions, so the box it draws is the painted bar
 * grown evenly rather than a wider box pinned to one of its edges.
 */
const HIGHLIGHT_INSET = 2;
/** The bar's corner. A literal now that a paint rather than CSS applies it. */
const BAR_RADIUS_PX = 4;

/** A chart with no route band still paints its lanes; it just has no wash. */
const EMPTY_VISITS: RouteVisit[] = [];

/** Target width of one density bucket. Wider reads as a bar chart, narrower as noise. */
const BUCKET_WIDTH = 6;
const MIN_BUCKETS = 24;
const MAX_BUCKETS = 160;

/**
 * Width to assume before the track has been measured (first paint, and jsdom).
 *
 * Everything answered in pixels reads this until a real measurement lands — the
 * bucket count, and whether compressing an idle stretch buys more width than the
 * break costs — so a chart's first frame is drawn the way its second one will be.
 */
const FALLBACK_WIDTH = 800;

/** Roughly the width one axis label needs before its neighbour crowds it. */
const TICK_SPACING = 130;
const MAX_TICKS = 7;

/**
 * How wide a break can be drawn before it stops being one.
 *
 * A break says "time was taken out here", and past a few times its own width that
 * is no longer what is happening: the viewport has been zoomed far enough into the
 * stretch that the axis is showing it at an ordinary rate again. So the hatch and
 * its label drop out, and the emptiness speaks for itself — by then the ticks
 * across it are labelled in real elapsed time.
 */
const BREAK_MAX_PX = 3 * BREAK_PX;

/**
 * How much room a break's label claims either side of it in the axis row. Both it
 * and a tick's label are centred on their own position, so this is half of one plus
 * half of the other — enough that the tick nearest a break is dropped rather than
 * printed half underneath it.
 */
const TICK_CLEARANCE_PX = 32;

/**
 * How much of a break's own duration is kept either side of it when it is clicked
 * open, and how much of what is left of the session that margin may eat.
 *
 * A stretch expanded to exactly its own bounds is a screen with nothing on it, so a
 * tenth at each end brings in the items that bracket it. The second number is what
 * keeps that from swallowing the session: a stretch that *is* most of the session
 * has very little either side of it, and a margin measured only against the stretch
 * would reach past both ends — which `clampWindow` reads as no selection at all,
 * leaving the click looking broken on exactly the sessions this feature exists for.
 */
const BREAK_MARGIN = 0.1;
const BREAK_MARGIN_SHARE = 0.25;

/** A drag shorter than this is a click, which means something else. */
const MIN_DRAG_PX = 4;

/**
 * How much of the viewport one pixel of wheel travel is worth, as an exponent — so
 * a notch is the same *proportional* step at every scale, and zooming into a
 * ten-minute session takes as many turns as zooming into a ten-second one.
 */
const ZOOM_PER_PIXEL = 0.0022;

/** Firefox reports wheel deltas in lines rather than pixels. */
const LINE_HEIGHT_PX = 16;

/**
 * The floor on a viewport. Small enough for one fast span to fill the width, large
 * enough that the axis still has two distinguishable ends.
 */
const MIN_VIEW_MS = 5;

/**
 * How long the wheel has to go quiet before the viewport is handed up. A gesture is
 * dozens of events and every committed one rebuilds the rail, so the lanes follow
 * the wheel while the rail follows the gesture.
 */
const ZOOM_COMMIT_MS = 70;

/**
 * How far outside an item a click still counts as hitting it. Sized to the
 * smallest shape rather than to the pointer: a density marker is drawn at the
 * centre of the bucket it fell into, so it can sit a few pixels off the timestamp
 * it stands for, and a very short bar is smaller than a comfortable target.
 */
const HIT_TOLERANCE_PX = 8;

/**
 * How far past the overview's frame a press still counts as grabbing it. Sized to
 * the frame at its narrowest rather than to the pointer: a deep zoom draws it two
 * pixels wide, which is legible and not aimable.
 */
const GRAB_TOLERANCE_PX = 5;

/**
 * How much of the frame each end claims as a resize handle, and how far outside it
 * the same handle reaches. Capped at a third of the frame apiece by the code that
 * uses it, so a frame too thin to have a middle is still one you can pick up:
 * carrying is the one gesture the strip has that the lanes below do not, and a
 * wheel notch down there resizes anyway.
 */
const RESIZE_HANDLE_PX = 4;

/**
 * What a press on the overview's frame takes hold of: one of its ends, or the whole
 * of it. Anywhere else on the strip is not a grip at all — it is a fresh selection.
 */
type OverviewGrip = 'move' | 'start' | 'end';

/**
 * How a grip announces itself. The pointer is the only thing the strip has to say
 * this with: it is twenty pixels tall, pointer-only, and has no room for a handle
 * drawn large enough to be read as one.
 */
function cursorFor(grip: OverviewGrip | null, isHeld = false): string {
  if (grip === 'start' || grip === 'end') {
    return 'ew-resize';
  }
  if (grip === 'move') {
    return isHeld ? 'grabbing' : 'grab';
  }
  return 'crosshair';
}

/** An item under the pointer, and which lane it was found in. */
interface LaneHit {
  event: SessionEvent;
  key: string;
  laneIndex: number;
}

/** The same, for the services band, which indexes its own rows. */
interface ServiceHit {
  activity: ServiceActivity;
  laneIndex: number;
}

interface Props {
  bounds: SessionRange;
  /**
   * Exact per-type totals for the whole session. These come from the aggregates
   * rather than from the plotted items, so a capped lane's label still reports
   * everything the session holds — which is what the truncation marker beside it
   * is for.
   *
   * Only used while the whole session is in view. Narrow to a window and the
   * labels count that window's markers instead; see {@link useLaneCounts}.
   */
  counts: Record<SessionDatasetKey, number>;
  /** Every plotted item per type, ascending, which is also what a click hits. */
  eventsByType: Record<SessionDatasetKey, SessionEvent[]>;
  /**
   * Where the session was idle, and how busy it was between those stretches. What
   * the axis is built from — see {@link buildTimeScale} for which of these stretches
   * actually get compressed, and why most sessions have none.
   */
  idle: IdleAnalysis;
  onChangeWindow: (window: SessionRange | null) => void;
  onSelectItem: (key: string) => void;
  onToggleType: (key: SessionDatasetKey) => void;
  /**
   * The route the user was on over time, contiguous across the session. No visits
   * and no failure means a session with no `pageload` or `navigation` spans — a
   * backend service, say — and the band is left out rather than drawn empty.
   */
  routes: RouteBand;
  /** The item whose details are open, marked in its lane. */
  selectedKey: string | null;
  /** Telemetry types currently shown. A type that is off dims its lane. */
  selectedTypes: SessionDatasetKey[];
  /**
   * The backend the session reached, one row per project. No services and no
   * failure means a session that called nothing we can see, and the band is left
   * out rather than drawn empty.
   */
  services: ServiceBand;
  /** How many traces the band's cap skipped, which its footnote qualifies. */
  skippedBandTraces: number;
  truncatedByType: Record<SessionDatasetKey, boolean>;
  /**
   * The range in view, or null for the whole session.
   *
   * One value doing two jobs, deliberately: it is the domain the lanes are drawn
   * against *and* what the rail below is narrowed to. Zooming and selecting are the
   * same act here — a selection you cannot see the inside of is not worth making,
   * and a zoom that left the rail showing the whole session would put two different
   * answers on one screen.
   */
  window: SessionRange | null;
}

/** Where an item begins and ends on the axis. */
function extentOf(event: SessionEvent): {end: number; start: number} | undefined {
  if (event.timestamp === undefined) {
    return undefined;
  }
  return {
    start: event.timestamp,
    end: event.timestamp + (event.duration ?? 0),
  };
}

/**
 * The session at a glance: one lane per telemetry type the session holds, across
 * whatever range is in view, over a strip showing where in the session that range
 * sits.
 *
 * The lanes answer "where in this session did anything happen" before a single
 * row has been read, which is the one question a flat list cannot answer. Time
 * runs horizontally only here, where the axis carries no text — the rail keeps
 * reading vertically, because that is where the payload is.
 *
 * Narrowing the range *rescales* the lanes rather than veiling the rest of them.
 * A session is minutes long and the things worth looking at inside one last
 * milliseconds, so a fixed scale can show you that a burst exists and never what
 * is in it. Scroll to zoom, anchored on the pointer; drag across the lanes to take
 * a range in one go; drag the strip to move the range you have. All three land on
 * the same value, which is also what narrows the rail below — the chart and the
 * list are always answering about the same slice of time.
 *
 * How a lane draws depends on what its items are. Logs, metrics and errors are
 * instants, so they get density: bucketed markers whose height is how much landed
 * there. A trace occupies time, so it gets a bar across the time it occupied —
 * which turns that lane into the shape of the session's activity rather than a row
 * of dots that happen to be near each other.
 *
 * Over all of them sits the route band: which page the user was actually looking
 * at, and for how long. It is the one lane that tiles rather than dots, because
 * the user is always somewhere — and it is what makes the lanes below answerable
 * as "this error happened on /checkout" rather than "this error happened at 4:12".
 * The route is carried in three channels: the band's own coloured, labelled
 * segments; a rule down every lane wherever it changed; and an alternating wash
 * between those rules, so an item can be placed on one side or the other without
 * tracing a line back up to the band.
 *
 * The lanes are also an index into the rail: clicking an item opens its details
 * and selects its row below. That makes this a pointer affordance only — a
 * density marker is an aggregate shape, not one element per item — so the rail's
 * own per-row button stays the way there without one.
 */
export function SessionScrubber({
  bounds,
  counts,
  eventsByType,
  idle,
  routes,
  services,
  skippedBandTraces,
  truncatedByType,
  selectedTypes,
  onToggleType,
  window,
  onChangeWindow,
  selectedKey,
  onSelectItem,
}: Props) {
  const theme = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: trackRef});

  /**
   * The window being dragged. Held locally so the rail below is not rebuilt on
   * every pointer move; it is handed up on release.
   */
  const [draft, setDraft] = useState<SessionRange | null>(null);
  /**
   * The viewport a wheel gesture is still moving. Same reason as `draft`, but a
   * gesture has no release to commit on, so it is flushed once the wheel is quiet.
   */
  const [pendingView, setPendingView] = useState<SessionRange | null>(null);
  const flush = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Where a wheel gesture has reached, ahead of what has been drawn — and the guide
   * position that goes with it. Null between gestures, which is what hands the next
   * notch back to the rendered viewport.
   */
  const wheelView = useRef<{
    hoverAt: number;
    next: SessionRange | null;
  } | null>(null);
  const wheelFrame = useRef<number | null>(null);
  const [hoverAt, setHoverAt] = useState<number | null>(null);
  const [hover, setHover] = useState<LaneHit | null>(null);
  /** The route segment under the pointer, which is a different aim than an item. */
  const [hoverRoute, setHoverRoute] = useState<RouteVisit | null>(null);
  const [hoverService, setHoverService] = useState<ServiceHit | null>(null);
  const anchor = useRef<{clientX: number; timestamp: number} | null>(null);
  /**
   * How the chart is drawn, as opposed to what it is drawn from. Both come from the
   * settings menu below the lanes, and both are on by default: the shapes are what
   * the timeline is read for, and the defaults are what give them the most width.
   *
   * Held here rather than in the URL or in local storage. It is a preference about
   * reading charts rather than a property of the session, so it has no business in a
   * link to one — and until the pair has settled it is not worth outliving the page.
   */
  const [compressIdle, setCompressIdle] = useState(true);
  const [hideEmptyLanes, setHideEmptyLanes] = useState(true);

  /**
   * The range in view — the whole session, until one is zoomed into. `bounds` stays
   * what it always was: the session itself, which is what every range is clamped to
   * and what the overview strip draws.
   */
  const view = pendingView ?? window ?? bounds;
  const isZoomed = view.start > bounds.start || view.end < bounds.end;

  const trackWidth = width > 0 ? width : FALLBACK_WIDTH;
  const buckets = Math.min(
    MAX_BUCKETS,
    Math.max(MIN_BUCKETS, Math.floor(trackWidth / BUCKET_WIDTH))
  );

  /**
   * The axis the chart is drawn against, which is not necessarily a straight line:
   * a session that spent most of itself idle has those stretches compressed to a
   * marked break, so the width goes to the parts that have something in them.
   *
   * Built from the session rather than from the viewport, and deliberately so. The
   * alternative — re-deciding what counts as idle for whatever is currently on
   * screen — would reflow the axis under every zoom notch, and a chart whose shape
   * changes as you look into it cannot be read. Held this way it is a property of
   * the session: zooming into a break simply magnifies its shallow slope, which
   * hands the stretch back at an ordinary rate.
   */
  const compressed = useMemo(
    () => buildTimeScale({bounds, idle, width: trackWidth, buckets}),
    [bounds, buckets, idle, trackWidth]
  );

  /**
   * The straight axis, kept alongside the compressed one rather than rebuilt when
   * the toggle flips. Both are cheap and neither depends on the setting, so holding
   * the pair makes switching between them a re-render rather than a recompute.
   */
  const linear = useMemo(
    () =>
      buildTimeScale({
        bounds,
        idle: {gaps: [], regions: []},
        width: trackWidth,
        buckets,
      }),
    [bounds, buckets, trackWidth]
  );

  const scale = compressIdle ? compressed : linear;

  /**
   * The viewport, in axis units. Every position on the chart is measured from these
   * two rather than from `view` directly — the axis is what the pixels belong to,
   * and the timestamps only reach them through it.
   */
  const viewStart = scale.toRatio(view.start);
  // Floored so a viewport that has collapsed to an instant cannot divide by zero.
  const viewSpan = Math.max(scale.toRatio(view.end) - viewStart, 1e-9);
  const enabled = useMemo(() => new Set(selectedTypes), [selectedTypes]);
  /**
   * What the lane counts and their truncation notes are talking about: a drag's own
   * selection while it is being made, and otherwise whatever the zoom is showing.
   * Null means the whole session, where the exact aggregates apply.
   */
  const scoped = draft ?? (isZoomed ? view : null);
  const laneCounts = useLaneCounts(counts, eventsByType, scoped);

  /**
   * The lanes this session has anything in.
   *
   * An empty lane answers nothing and spends forty pixels of the one thing a
   * timeline is short of, so it is left out rather than drawn flat: a backend
   * session gets no feedback lane, a session that logs nothing gets no log lane.
   *
   * Decided by the session's exact aggregates rather than by the plotted items,
   * because the items move with the text filter and with the zoom — a lane that
   * disappeared as you typed would take the chart's height, and everything below
   * it, along with it. `counts` is the one figure here that is a property of the
   * session itself.
   *
   * Nothing counted anywhere leaves every lane in place. That is rows without
   * aggregates, which only a failed count query produces, and five empty lanes are
   * a better answer there than a chart with no lanes at all.
   *
   * Switchable from the settings menu, because the omission is not free either: a
   * lane that is absent and a lane that is empty look the same until you know the
   * chart drops them, and "did this session log anything at all" is a question the
   * flat lane answers and a missing one does not.
   */
  const visibleLanes = useMemo(() => {
    if (!hideEmptyLanes) {
      return LANES;
    }
    const present = LANES.filter(config => counts[config.key] > 0);
    return present.length > 0 ? present : LANES;
  }, [counts, hideEmptyLanes]);

  /**
   * Every plotted item of every enabled type, for the overview strip's single row.
   * Merged rather than laned: in twenty pixels the strip is answering "where in
   * this session did anything happen at all", and four rows of five pixels each
   * answers nothing.
   */
  const overviewEvents = useMemo(
    () =>
      visibleLanes
        .filter(config => enabled.has(config.key))
        .flatMap(config => eventsByType[config.key]),
    [enabled, eventsByType, visibleLanes]
  );

  /**
   * Each lane reduced to what painting it needs. Held by identity so a hover, which
   * changes none of it, does not repaint the lanes.
   */
  const laneMarks = useMemo(
    () =>
      visibleLanes.map(config => ({
        color: theme.tokens.graphics[config.graphicsVariant].vibrant,
        events: eventsByType[config.key],
        isOn: enabled.has(config.key),
      })),
    [enabled, eventsByType, theme.tokens.graphics, visibleLanes]
  );

  /**
   * Which lanes the canvas draws as bars. A property of the lane rather than of the
   * item, because that is how the paint asks it: an item reporting no duration in a
   * lane that has them is still drawn as a bar, and has to be called out as one.
   *
   * Memoized because answering it is a scan of a lane's events, and the question is
   * asked on every pointer move.
   */
  const laneIsDuration = useMemo(
    () => laneMarks.map(lane => hasDurations(lane.events)),
    [laneMarks]
  );

  /**
   * A session with no browser telemetry has no routes to draw, and an empty
   * labelled row is worse than no row — it reads as "this session visited
   * nothing" rather than "we don't track routes here". Everything below shifts up
   * by a row when the band is absent, which is why the offsets are derived rather
   * than constant.
   *
   * A *failed* band still gets its row. Empty-because-nothing-happened and
   * empty-because-the-query-broke are different answers, and only the row can say
   * which one this is.
   */
  const routeVisits = routes.visits;
  const hasRoutes = routeVisits.length > 0 || routes.isError;
  /**
   * Offsets within the *track*, which starts at the axis — the overview strip above
   * it has its own pointer handling and is deliberately not under it.
   */
  const routeTop = HEADER_HEIGHT;
  const laneTop = HEADER_HEIGHT + (hasRoutes ? ROUTE_HEIGHT : 0);
  /** Row 1 is the strip, row 2 the axis, and row 3 the route band when there is one. */
  const firstLaneRow = hasRoutes ? 4 : 3;

  /**
   * The services band, on the same terms as the route band above: drawn when there
   * is something to say, including when what it has to say is that its query
   * failed.
   *
   * A session with no band is the common case and not a defect — it means nothing
   * downstream of this session is instrumented, or the traces it started never
   * left the browser. An empty labelled band would read as "the servers did
   * nothing", which is a claim we are in no position to make.
   */
  const serviceLanes = services.lanes;
  const hasServices = serviceLanes.length > 0 || services.isError;
  /** The heading closes the lanes; the service rows follow it. */
  const serviceHeadingRow = firstLaneRow + visibleLanes.length;
  const firstServiceRow = serviceHeadingRow + 1;
  /** Where the first service row starts, in track-relative pixels. */
  const serviceTop = laneTop + visibleLanes.length * LANE_HEIGHT + SERVICE_HEADER_HEIGHT;

  /**
   * Platforms for the band's rows, so each service can carry its own icon.
   *
   * Read straight from the store rather than asked for by slug. `useProjects`
   * would fetch any slug the store is missing, but the store already holds every
   * project the reader can see — so the only slugs it could fetch are ones the
   * band could not have returned a row for in the first place. A row whose project
   * is somehow absent renders without an icon, which is the same silent omission
   * the band's header already declines to claim completeness about.
   */
  const {projects} = useProjects();
  const platformBySlug = useMemo(
    () => new Map(projects.map(project => [project.slug, project.platform])),
    [projects]
  );

  /**
   * Categorical rather than semantic: a route is not good or bad, and borrowing
   * `danger` for one would say it was. Indexed by the visit's own `colorIndex`, so
   * a route keeps its color across every visit to it.
   *
   * Held by identity rather than rebuilt each render, because that identity is
   * what keeps the band below memoized: a fresh palette would rebuild
   * `routeColor`, and a fresh `routeColor` would rebuild every segment on every
   * pointer move.
   */
  const routePalette = useMemo(
    () => theme.chart.getColorPalette(ROUTE_PALETTE),
    [theme.chart]
  );
  const routeColor = useCallback(
    (visit: RouteVisit) => routePalette[visit.colorIndex % routePalette.length]!,
    [routePalette]
  );

  // Evenly spaced offsets across the session, as many as fit without the labels
  // running into each other.
  const ticks = useMemo(() => {
    const count =
      width > 0 ? Math.max(2, Math.min(MAX_TICKS, Math.floor(width / TICK_SPACING))) : 2;
    return Array.from({length: count}, (_, index) => index / (count - 1));
  }, [width]);

  /** Where a timestamp sits across the track, as a percentage of the viewport. */
  const toPercent = useCallback(
    (timestamp: number) => ((scale.toRatio(timestamp) - viewStart) / viewSpan) * 100,
    [scale, viewStart, viewSpan]
  );

  /**
   * Where the paint actually puts a density mark: the centre of the bucket the item
   * fell into, rather than the item's own timestamp. In pixels, because a bucket is
   * a slice of the measured track and not a fraction of the domain.
   *
   * A highlight has to agree with this or it misses by up to half a bucket — a few
   * pixels, which on a marker eight pixels wide is the difference between a ring
   * around it and a ring beside it. The index is clamped exactly as `densityMarks`
   * clamps it, so the two cannot disagree about the item landing on `view.end`.
   *
   * Null when there is no bucket to answer with: before the track has been measured,
   * and for an item outside the viewport — which the paint drops rather than clamps,
   * so a ring clamped to the nearest bucket would be the only thing marking an item
   * that is not on screen. The timestamp is left to place those, off the edge, where
   * the frame clips them.
   */
  const toBucketCentre = useCallback(
    (timestamp: number) => {
      if (width === 0) {
        return null;
      }
      const unit = (scale.toRatio(timestamp) - viewStart) / viewSpan;
      if (unit < 0 || unit > 1) {
        return null;
      }
      const index = Math.min(buckets - 1, Math.max(0, Math.floor(unit * buckets)));
      return ((index + 0.5) * width) / buckets;
    },
    [buckets, scale, viewSpan, viewStart, width]
  );

  const fromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        return view.start;
      }
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return scale.toTime(viewStart + ratio * viewSpan);
    },
    [scale, view.start, viewSpan, viewStart]
  );

  /**
   * The one way the viewport changes.
   *
   * A wheel gesture is deferred and everything else commits at once, but both go
   * through here — which is what stops a `pendingView` outliving the gesture that
   * set it. A stale one would pin the lanes to a viewport the parent no longer
   * holds, and the rail below would be answering a different question than the
   * lanes above it.
   */
  const setView = useCallback(
    (next: SessionRange | null, defer: boolean) => {
      if (flush.current !== null) {
        clearTimeout(flush.current);
        flush.current = null;
      }
      if (!defer) {
        // Anything that settles the viewport outright ends the gesture the wheel
        // was accumulating, so the next notch starts from what is on screen rather
        // than from a viewport this just replaced.
        wheelView.current = null;
        setPendingView(null);
        onChangeWindow(next);
        return;
      }
      setPendingView(next ?? bounds);
      flush.current = setTimeout(() => {
        flush.current = null;
        // The gesture is over once the wheel has gone quiet, and what it reached is
        // about to become the committed viewport.
        wheelView.current = null;
        // Both in one batch, so no frame renders the pre-gesture viewport.
        setPendingView(null);
        onChangeWindow(next);
      }, ZOOM_COMMIT_MS);
    },
    [bounds, onChangeWindow]
  );

  /**
   * The strip's own commit, hoisted out of the JSX so it keeps one identity. An
   * inline arrow would be a new prop on every pointer move, which is enough on its
   * own to re-render the strip's several hundred ticks.
   */
  const commitView = useCallback(
    (next: SessionRange | null) => setView(next, false),
    [setView]
  );

  useEffect(
    () => () => {
      if (flush.current !== null) {
        clearTimeout(flush.current);
      }
      if (wheelFrame.current !== null) {
        cancelAnimationFrame(wheelFrame.current);
      }
    },
    []
  );

  /**
   * Wheel zooms, anchored on the pointer.
   *
   * Horizontal travel — a trackpad's second axis, or shift held — pans instead.
   * That is the gesture a zoomed viewport needs and the one the lanes cannot spare,
   * since a drag across them means zoom.
   *
   * A notch does not render. A trackpad reports well above a hundred wheel events
   * a second, and every one of them changes the domain the whole chart is drawn
   * against — so rendering each one meant building two chart-fulls of geometry per
   * displayed frame and throwing one away. Each notch instead folds into
   * {@link wheelView} and one frame's worth is handed to React on the next
   * animation frame.
   *
   * The gesture accumulates against its own latest viewport rather than the
   * rendered one, so folding several notches into a frame lands exactly where
   * applying them one at a time would have.
   */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        return;
      }
      // Lines in Firefox, and screens on a page-sized gesture.
      const perUnit =
        event.deltaMode === 1 ? LINE_HEIGHT_PX : event.deltaMode === 2 ? rect.height : 1;
      const dy = event.deltaY * perUnit;
      const dx = event.deltaX * perUnit;

      // Where the gesture has already reached, which is ahead of what is drawn
      // whenever more than one notch landed inside a frame.
      const from = wheelView.current ? (wheelView.current.next ?? bounds) : view;
      const fromStart = scale.toRatio(from.start);
      const fromSpan = scale.toRatio(from.end) - fromStart;
      const at = scale.toTime(
        fromStart + ((event.clientX - rect.left) / rect.width) * fromSpan
      );

      const next =
        event.shiftKey || Math.abs(dx) > Math.abs(dy)
          ? // Shift is reported as a horizontal delta by some browsers and a
            // vertical one by others, so whichever axis arrived is the pan.
            panView(from, bounds, scale, ((dx === 0 ? dy : dx) / rect.width) * fromSpan)
          : zoomView(from, bounds, scale, at, Math.exp(dy * ZOOM_PER_PIXEL));

      // Only claim the gesture when it actually moves something. Zooming out at the
      // full extent, or in at the floor, changes nothing — and swallowing the
      // scroll there would leave the page unable to scroll past this chart, which
      // is the failure mode every scroll-to-zoom surface is remembered for.
      const settled = next ?? bounds;
      if (settled.start === from.start && settled.end === from.end) {
        return;
      }
      // Synchronous, and it has to be: a deferred `preventDefault` is ignored.
      event.preventDefault();
      // The zoom is centred on the pointer, so the guide belongs there to say so —
      // read from the old scale, which by that same anchoring is the new one.
      wheelView.current = {next, hoverAt: at};

      if (wheelFrame.current === null) {
        wheelFrame.current = requestAnimationFrame(() => {
          wheelFrame.current = null;
          const pending = wheelView.current;
          if (pending === null) {
            return;
          }
          setView(pending.next, true);
          setHoverAt(pending.hoverAt);
        });
      }
    },
    [bounds, scale, setView, view]
  );

  /**
   * Bound by hand because React registers `wheel` passively, where
   * `preventDefault` is ignored — and a zoom that scrolls the page as well is not a
   * zoom. Subscribed once and dispatched through a ref, so a gesture does not
   * rebind the listener on every notch.
   */
  const wheelRef = useRef(handleWheel);
  useEffect(() => {
    wheelRef.current = handleWheel;
  }, [handleWheel]);
  useEffect(() => {
    const node = trackRef.current;
    if (!node) {
      return () => {};
    }
    const listener = (event: WheelEvent) => wheelRef.current(event);
    node.addEventListener('wheel', listener, {passive: false});
    return () => node.removeEventListener('wheel', listener);
  }, []);

  /**
   * What the pointer is over, if anything.
   *
   * The track is deliberately one element across every lane, so a drag selects a
   * span of time rather than a span within one type. That leaves the lane to be
   * worked out from the pointer's own offset, and the item from the timestamps in
   * it — which is also cheaper than an element per marker.
   *
   * An item that occupies time is hit anywhere along it, and the shortest one wins
   * when several overlap: that is the waterfall convention, and the most specific
   * answer to "what is this bar". Instants fall back to nearest-start.
   *
   * A lane that is toggled off is skipped: its markers are dimmed and its rows are
   * not in the rail, so there is nothing there to open.
   */
  const hitAt = useCallback(
    (clientX: number, clientY: number): LaneHit | null => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        return null;
      }

      const laneIndex = Math.floor((clientY - rect.top - laneTop) / LANE_HEIGHT);
      const config = visibleLanes[laneIndex];
      if (!config || clientY < rect.top + laneTop || !enabled.has(config.key)) {
        return null;
      }

      const at = fromClientX(clientX);
      // The tolerance is a distance on screen, which on a compressed axis is not a
      // fixed number of milliseconds — so it is read off the axis rather than
      // computed against the domain: these are the times a few pixels either side
      // of the pointer.
      const from = fromClientX(clientX - HIT_TOLERANCE_PX);
      const to = fromClientX(clientX + HIT_TOLERANCE_PX);

      let covering: SessionEvent | undefined;
      let coveringDuration = Infinity;
      let nearest: SessionEvent | undefined;
      let nearestDistance = Infinity;
      let nearestStart = Infinity;

      eventsByType[config.key].forEach(event => {
        const extent = extentOf(event);
        if (!extent) {
          return;
        }
        if (extent.start <= to && extent.end >= from) {
          const duration = extent.end - extent.start;
          if (duration < coveringDuration) {
            covering = event;
            coveringDuration = duration;
          }
        }
        const distance = Math.abs(extent.start - at);
        if (distance < nearestDistance) {
          nearest = event;
          nearestDistance = distance;
          nearestStart = extent.start;
        }
      });

      const found =
        covering ??
        (nearestStart >= from && nearestStart <= to ? nearest : undefined) ??
        undefined;
      if (!found) {
        return null;
      }
      const key = itemKey(found);
      return key === undefined ? null : {event: found, key, laneIndex};
    },
    [enabled, eventsByType, fromClientX, laneTop, visibleLanes]
  );

  /**
   * The route segment under the pointer, if the pointer is in the band's row.
   *
   * Deliberately not part of `hitAt`: the two are aiming at different kinds of
   * thing, and mutually exclusive by geometry — the band's row is above every
   * lane. Segments tile, so no tolerance is needed and there is nothing to
   * disambiguate; the pointer is over exactly one of them or none.
   */
  const routeAt = useCallback(
    (clientX: number, clientY: number): RouteVisit | null => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || !hasRoutes) {
        return null;
      }
      const y = clientY - rect.top;
      if (y < routeTop || y >= routeTop + ROUTE_HEIGHT) {
        return null;
      }
      const at = fromClientX(clientX);
      return routeVisits.find(visit => at >= visit.start && at <= visit.end) ?? null;
    },
    [fromClientX, hasRoutes, routeTop, routeVisits]
  );

  /**
   * The service bar under the pointer, if the pointer is in the band below the
   * lanes.
   *
   * Separate from `hitAt` for the same reason `routeAt` is: mutually exclusive by
   * geometry, and aiming at a different index. It shares `hitAt`'s tolerance
   * though, and for the same reason — a server call can be narrower than the
   * pointer is accurate, and a bar you cannot hit is a bar that is not really
   * clickable.
   */
  const serviceAt = useCallback(
    (clientX: number, clientY: number): ServiceHit | null => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || !hasServices) {
        return null;
      }
      const laneIndex = Math.floor((clientY - rect.top - serviceTop) / SERVICE_HEIGHT);
      const lane = serviceLanes[laneIndex];
      if (!lane || clientY < rect.top + serviceTop) {
        return null;
      }

      const from = fromClientX(clientX - HIT_TOLERANCE_PX);
      const to = fromClientX(clientX + HIT_TOLERANCE_PX);
      // The shortest bar overlapping the pointer, matching how `hitAt` breaks a
      // tie: a brief call nested inside a long one is the more specific answer to
      // "what is this".
      let found: ServiceActivity | undefined;
      let foundDuration = Infinity;
      lane.activity.forEach(activity => {
        const {start, end} = activity.range;
        if (start > to || end < from) {
          return;
        }
        const duration = end - start;
        if (duration < foundDuration) {
          found = activity;
          foundDuration = duration;
        }
      });

      return found === undefined ? null : {activity: found, laneIndex};
    },
    [fromClientX, hasServices, serviceLanes, serviceTop]
  );

  /**
   * The breaks to draw, and where across the track they land.
   *
   * A break only exists while the stretch it stands for is actually compressed. Zoom
   * far enough into one and the axis is handing that time back at an ordinary rate,
   * at which point a hatch across the whole viewport would be claiming something
   * that is no longer true — so it drops out, and the ticks over it take the
   * explaining.
   */
  const breaks = useMemo(
    () =>
      scale.idle
        .map(segment => {
          const left = toPercent(segment.start);
          const right = toPercent(segment.end);
          return {
            segment,
            left,
            right,
            fromPx: (left / 100) * trackWidth,
            toPx: (right / 100) * trackWidth,
          };
        })
        .filter(
          item =>
            item.left < 100 && item.right > 0 && item.toPx - item.fromPx <= BREAK_MAX_PX
        ),
    [scale.idle, toPercent, trackWidth]
  );

  /**
   * The break under the pointer, if any. Asked without a `y` because a break runs
   * the full height of the track: it is time the axis took out, which is not
   * something one lane can be missing and another have.
   */
  const breakAt = useCallback(
    (clientX: number): ScaleSegment | null => {
      const at = fromClientX(clientX);
      return (
        breaks.find(item => at >= item.segment.start && at <= item.segment.end)
          ?.segment ?? null
      );
    },
    [breaks, fromClientX]
  );

  /** Where the open item sits, so its lane can mark it. */
  const selected = useMemo((): LaneHit | null => {
    if (selectedKey === null) {
      return null;
    }
    for (const [laneIndex, config] of visibleLanes.entries()) {
      const event = eventsByType[config.key].find(
        candidate => itemKey(candidate) === selectedKey
      );
      if (event) {
        return {event, key: selectedKey, laneIndex};
      }
    }
    return null;
  }, [selectedKey, eventsByType, visibleLanes]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    anchor.current = {
      clientX: event.clientX,
      timestamp: fromClientX(event.clientX),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    setHoverAt(fromClientX(event.clientX));

    const start = anchor.current;
    if (!start || Math.abs(event.clientX - start.clientX) < MIN_DRAG_PX) {
      setHover(hitAt(event.clientX, event.clientY));
      setHoverRoute(routeAt(event.clientX, event.clientY));
      setHoverService(serviceAt(event.clientX, event.clientY));
      return;
    }
    // Mid-drag the pointer is aiming at a range, not at an item or a route.
    setHover(null);
    setHoverRoute(null);
    setHoverService(null);
    const at = fromClientX(event.clientX);
    setDraft({
      start: Math.min(start.timestamp, at),
      end: Math.max(start.timestamp, at),
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (anchor.current === null) {
      return;
    }
    anchor.current = null;

    if (draft) {
      setView(clampWindow(draft, bounds), false);
      setDraft(null);
      return;
    }

    // A press with no drag opens the item under it, and on a route segment zooms to
    // that visit. A route already *is* a span of time, so the drag a user would
    // otherwise have to aim by hand is one the data can perform exactly — and "show
    // me only what happened while they were on /checkout" is most of why the band
    // is here.
    //
    // On empty track it does nothing. It used to reset the view, which was cheap
    // when a window was one drag away from being redrawn; a zoom is built up over
    // several gestures, and throwing that away on a mis-aimed click is not a trade
    // worth making. The strip above, `Escape`, and scrolling back out are the ways
    // out, and unlike a click they are all things you meant.
    // A break stands for time the axis took out, so a press on one puts it back.
    // Checked before the route band because a break crosses it: the segment under a
    // break is unreadable there anyway, and the stretch is the more specific answer
    // to what was clicked.
    const removed = breakAt(event.clientX);
    if (removed) {
      const span = removed.end - removed.start;
      const margin = Math.min(
        span * BREAK_MARGIN,
        Math.max(0, (bounds.end - bounds.start - span) * BREAK_MARGIN_SHARE)
      );
      setView(
        clampWindow({start: removed.start - margin, end: removed.end + margin}, bounds),
        false
      );
      return;
    }

    const visit = routeAt(event.clientX, event.clientY);
    if (visit) {
      setView(clampWindow({start: visit.start, end: visit.end}, bounds), false);
      return;
    }

    const hit = hitAt(event.clientX, event.clientY);
    if (hit) {
      onSelectItem(hit.key);
      return;
    }

    // A service bar opens the same panel a rail row does — it is a trace item like
    // any other, reached from the other side of the request.
    const service = serviceAt(event.clientX, event.clientY);
    if (service) {
      onSelectItem(service.activity.key);
    }
  };

  /**
   * The keyboard's half of the same two gestures: the arrows pan and zoom, on the
   * viewport's centre since there is no pointer to anchor on. Built on the helpers
   * the wheel uses, so they inherit the minimum span and the slide-back-inside-the
   * -session behaviour rather than reimplementing them a step out of date.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const centre = scale.toTime(viewStart + viewSpan / 2);

    switch (event.key) {
      case 'ArrowRight':
        setView(panView(view, bounds, scale, viewSpan / 8), false);
        break;
      case 'ArrowLeft':
        setView(panView(view, bounds, scale, -viewSpan / 8), false);
        break;
      case 'ArrowUp':
        setView(zoomView(view, bounds, scale, centre, 0.75), false);
        break;
      case 'ArrowDown':
        setView(zoomView(view, bounds, scale, centre, 4 / 3), false);
        break;
      case 'Escape':
      case 'Home':
        setView(null, false);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <Stack>
      {/*
        Every cell is placed by hand. Grid auto-placement flows *around* the
        explicitly positioned overlay below, which silently pushes the first
        lane's label onto a row of its own.
      */}
      <Chart
        hasRoutes={hasRoutes}
        hasServices={hasServices}
        laneCount={visibleLanes.length}
        serviceCount={serviceLanes.length}
      >
        <SessionHeader />
        <Overview
          bounds={bounds}
          view={view}
          events={overviewEvents}
          buckets={buckets}
          scale={scale}
          onChangeView={commitView}
        />

        <TimeHeader />

        <Axis>
          {ticks.map(ratio => {
            // Read back through the axis rather than interpolated across it: with a
            // stretch compressed, evenly spaced ticks are no longer evenly spaced
            // times, and saying so is the point of labelling them at all.
            const at = scale.toTime(viewStart + viewSpan * ratio);
            // Dropped *near* a break rather than only inside one. A tick inside would
            // name a single instant out of a stretch that is not drawn as instants,
            // and one just outside would print half underneath the break's own
            // label — which now sits in this row.
            const x = ratio * trackWidth;
            if (
              breaks.some(
                item =>
                  x >= item.fromPx - TICK_CLEARANCE_PX &&
                  x <= item.toPx + TICK_CLEARANCE_PX
              )
            ) {
              return null;
            }
            return (
              <Tick
                key={ratio}
                style={{
                  left: `${ratio * 100}%`,
                  // The end labels tuck inside the track instead of hanging off it.
                  transform: `translate(${
                    ratio === 0 ? '0%' : ratio === 1 ? '-100%' : '-50%'
                  }, -50%)`,
                }}
              >
                {/*
                  Offsets from the session's start, not from the viewport's. A zoomed
                  axis labelled 0 would be a different clock than the rail's, and the
                  whole point of the ticks once zoomed is saying *where* you are.
                */}
                <Text size="xs" variant="muted" tabular>
                  {formatOffset(at - bounds.start)}
                </Text>
              </Tick>
            );
          })}
        </Axis>

        {hasRoutes && (
          <Fragment>
            <RouteHeader
              isError={routes.isError}
              isTruncated={routes.isTruncated}
              visitCount={routeVisits.length}
            />
            <RouteBand
              visits={routeVisits}
              hoverRoute={hoverRoute}
              toPercent={toPercent}
              routeColor={routeColor}
              sessionStart={bounds.start}
              width={width}
            />
          </Fragment>
        )}

        {/*
          Every lane's marks, and the route's reach into them, on one surface.

          The wash is neutral rather than route-coloured, on purpose. It sits
          directly behind the marks — a magenta wash under an error dot would tint
          how bad the error looks, and the band above is already where a route's
          identity is said. What a wash means here is only "the same side of a
          boundary as its neighbours", which is why alternating is enough and the
          parity of a particular visit carries nothing.
        */}
        <LaneCanvas
          lanes={laneMarks}
          visits={hasRoutes ? routeVisits : EMPTY_VISITS}
          routeColor={routeColor}
          buckets={buckets}
          scale={scale}
          viewStart={viewStart}
          viewSpan={viewSpan}
          width={width}
          firstLaneRow={firstLaneRow}
          tint={theme.tokens.background.transparent.neutral.muted}
        />

        {visibleLanes.map((config, index) => {
          const isOn = enabled.has(config.key);
          const color = theme.tokens.graphics[config.graphicsVariant].vibrant;
          const row = index + firstLaneRow;
          const isLast = index === visibleLanes.length - 1;
          return (
            <Fragment key={config.key}>
              <LaneToggle
                type="button"
                aria-pressed={isOn}
                onClick={() => onToggleType(config.key)}
                data-last={isLast}
                style={{gridRow: String(row)}}
              >
                <LaneLabel
                  label={config.label}
                  type={config.key}
                  color={color}
                  isOn={isOn}
                />
                <Flex align="baseline" gap="2xs">
                  <Text
                    size="sm"
                    tabular
                    variant={isOn && laneCounts[config.key] > 0 ? 'primary' : 'muted'}
                  >
                    {formatAbbreviatedNumber(laneCounts[config.key])}
                  </Text>
                  {/*
                    A footnote on the count, which is what it qualifies — and what
                    it qualifies differs by which count is showing.
                  */}
                  {truncatedByType[config.key] && (
                    <InfoText
                      size="xs"
                      variant="warning"
                      title={
                        scoped
                          ? tct(
                              'This lane plots only the [limit] most recent items, so a count taken from a window can fall short.',
                              {limit: config.maxRows}
                            )
                          : tct(
                              'Only the [limit] most recent of these are plotted, so this lane is partial.',
                              {limit: config.maxRows}
                            )
                      }
                    >
                      {'*'}
                    </InfoText>
                  )}
                </Flex>
              </LaneToggle>
              <LaneTrack aria-hidden data-last={isLast} style={{gridRow: String(row)}} />
            </Fragment>
          );
        })}

        {hasServices && (
          <Fragment>
            <ServicesHeader
              caveat={bandCaveat(services, skippedBandTraces)}
              laneCount={serviceLanes.length}
              row={serviceHeadingRow}
              skipped={skippedBandTraces}
            />
            {/*
              Before the rows rather than over them, so the service tracks — which
              are transparent — paint on top of it and any bar that does overlap the
              stretch still reads. The wash is what is behind those bars, not
              something laid across them.
            */}
            {services.unloaded !== null && (
              <UnloadedCell style={{gridRow: `${firstServiceRow} / -1`}}>
                <UnloadedWindow
                  style={{
                    left: `${Math.max(0, toPercent(services.unloaded.start))}%`,
                    width: `${
                      Math.min(100, toPercent(services.unloaded.end)) -
                      Math.max(0, toPercent(services.unloaded.start))
                    }%`,
                  }}
                >
                  <Text size="xs" variant="muted">
                    {tn('%s trace not read', '%s traces not read', skippedBandTraces)}
                  </Text>
                </UnloadedWindow>
              </UnloadedCell>
            )}
            {serviceLanes.map((lane, index) => (
              <ServiceRow
                key={lane.project}
                lane={lane}
                row={firstServiceRow + index}
                toPercent={toPercent}
                isLast={index === serviceLanes.length - 1}
                hoveredKey={hoverService?.activity.key ?? null}
                selectedKey={selectedKey}
                platform={platformBySlug.get(lane.project)}
              />
            ))}
          </Fragment>
        )}

        <Track
          ref={trackRef}
          tabIndex={0}
          role="group"
          aria-label={t('Session time window')}
          data-hit={hover || hoverRoute || hoverService ? true : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setHoverAt(null);
            setHover(null);
            setHoverRoute(null);
            setHoverService(null);
          }}
          onKeyDown={handleKeyDown}
        >
          {/*
            The drag in progress, and only that. A committed range *is* the domain
            the lanes are drawn against, so there is no longer an outside to veil —
            where the viewport sits within the session is the strip's job.
          */}
          {/*
            Drawn first, so a selection's veil and every highlight land on top: a
            break is part of the axis rather than something laid over it.
          */}
          {breaks.map(({segment, left, right}) => {
            const from = Math.max(0, left);
            const duration = formatDurationMs(segment.end - segment.start);
            return (
              <Break
                key={segment.start}
                data-test-id="session-break"
                title={t('%s with no telemetry. Click to expand.', duration)}
                style={{
                  left: `${from}%`,
                  width: `${Math.min(100, right) - from}%`,
                }}
              >
                <BreakLabel>{duration}</BreakLabel>
              </Break>
            );
          })}
          {draft && (
            <Fragment>
              <Veil style={{left: 0, width: `${toPercent(draft.start)}%`}} />
              <Veil style={{left: `${toPercent(draft.end)}%`, right: 0}} />
              <Window
                style={{
                  left: `${toPercent(draft.start)}%`,
                  width: `${toPercent(draft.end) - toPercent(draft.start)}%`,
                }}
              />
            </Fragment>
          )}
          {selected && (
            <Highlight
              hit={selected}
              isDuration={laneIsDuration[selected.laneIndex] === true}
              toPercent={toPercent}
              toBucketCentre={toBucketCentre}
              laneTop={laneTop}
              isSelected
            />
          )}
          {hover && hover.key !== selected?.key && (
            <Highlight
              hit={hover}
              isDuration={laneIsDuration[hover.laneIndex] === true}
              toPercent={toPercent}
              toBucketCentre={toBucketCentre}
              laneTop={laneTop}
            />
          )}
          {hoverAt !== null && (
            <Guide style={{left: `${toPercent(hoverAt)}%`}}>
              {/* The item's name rides along with the time, so a shape can be
                  identified before it is clicked. */}
              <GuideLabel>
                {hoverRoute
                  ? describeRoute(hoverRoute, bounds.start)
                  : hover
                    ? describe(hover.event, hoverAt - bounds.start)
                    : hoverService
                      ? describe(hoverService.activity.event, hoverAt - bounds.start)
                      : formatOffset(hoverAt - bounds.start)}
              </GuideLabel>
            </Guide>
          )}
        </Track>
      </Chart>

      {/*
        Padded to line up with the search below it rather than with the chart,
        which now runs to the panel's own edges. Without it the note sits flush
        against both the last lane and the filter row and reads as part of
        neither.
      */}
      <Flex align="center" gap="md" wrap="wrap" padding="md xl">
        <Text size="xs" variant="muted">
          {isZoomed
            ? t(
                'Showing %s to %s. Scroll to zoom, or drag the highlighted range above to move or resize it.',
                formatOffset(view.start - bounds.start),
                formatOffset(view.end - bounds.start)
              )
            : hasRoutes
              ? t(
                  'Scroll to zoom, or drag across the lanes for a range. Click a route to zoom to it, an item to open it, or a type to hide it.'
                )
              : t(
                  'Scroll to zoom, or drag across the lanes for a range. Click an item to open it, or a type to hide it.'
                )}
        </Text>
        <Flex flex="1" />
        {isZoomed && (
          <Button size="xs" onClick={() => setView(null, false)}>
            {t('Reset zoom')}
          </Button>
        )}
        {/*
          Both of these used to be decided for you, and one of them was an inline
          switch that appeared only when the session had stretches worth
          compressing. A menu that changes shape between sessions is a worse answer
          than one that is always the same two lines, so they are both always
          offered — on a session with nothing to compress the first is simply a
          no-op, which is what its own default already was.
        */}
        <TimelineSettings
          compressIdle={compressIdle}
          hideEmptyLanes={hideEmptyLanes}
          onToggleCompressIdle={() => setCompressIdle(current => !current)}
          onToggleHideEmptyLanes={() => setHideEmptyLanes(current => !current)}
        />
      </Flex>
    </Stack>
  );
}

/** The hovered item, in the label the time guide already carries. */
function describe(event: SessionEvent, offset: number): string {
  const time =
    event.duration === undefined
      ? formatOffset(offset)
      : `${formatOffset(offset)} · ${formatDurationMs(event.duration)}`;
  return `${time} · ${event.title}`;
}

/**
 * The hovered route, in the same label.
 *
 * Leads with the dwell time rather than with the arrival offset: the question the
 * band exists to answer is how long the user stayed, and the offset is already
 * legible from where the segment sits on the axis. How they arrived comes last —
 * it only matters when it is a pageload, which means a fresh document rather than
 * a route change inside one.
 */
function describeRoute(visit: RouteVisit, sessionStart: number): string {
  const arrival =
    visit.op === 'pageload'
      ? t('page load')
      : visit.op === 'navigation.redirect'
        ? t('redirect')
        : t('navigation');
  return `${visit.route} · ${formatDurationMs(
    visit.end - visit.start
  )} · ${formatOffset(visit.start - sessionStart)} ${arrival}`;
}

/**
 * What each lane label reports: the session's exact totals while the whole session
 * is in view, and the items inside the range once one is zoomed into.
 *
 * A count that ignored the range would contradict the lane beside it, which has
 * been redrawn to hold only what is in it. Counting the plotted items is the only
 * way to scope it, which costs the exactness the aggregates have: a lane capped at
 * `maxRows` undercounts here, and says so through the marker already beside its
 * count. For traces it also changes what is being counted, from distinct traces to
 * the segment spans standing for them.
 *
 * An item that occupies time counts when it *overlaps* the range rather than when
 * it starts inside it — a trace running through the view is in it.
 *
 * Runs against a drag in progress as well as the committed range, so the numbers
 * move with the gesture rather than snapping on release.
 */
function useLaneCounts(
  counts: Record<SessionDatasetKey, number>,
  eventsByType: Record<SessionDatasetKey, SessionEvent[]>,
  active: SessionRange | null
): Record<SessionDatasetKey, number> {
  const index = useMemo(
    () =>
      Object.fromEntries(
        LANE_ORDER.map(key => [key, indexLane(eventsByType[key])])
      ) as Record<SessionDatasetKey, LaneIndex>,
    [eventsByType]
  );

  return useMemo(() => {
    if (!active) {
      return counts;
    }
    return Object.fromEntries(
      LANE_ORDER.map(key => [key, countWithin(index[key], active)])
    ) as Record<SessionDatasetKey, number>;
  }, [counts, index, active]);
}

/**
 * A lane reduced to what counting a range needs: its extents, and how far back an
 * overlap can possibly begin.
 *
 * Built once per lane rather than per range, because the range moves every frame
 * of a zoom and the lane does not.
 */
interface LaneIndex {
  /** Parallel to {@link starts}: where each item finished. */
  ends: number[];
  /**
   * The longest item in the lane. An item overlaps a range only if it started no
   * earlier than the range less this, which is what turns "scan the lane" into
   * "scan the part of it that could possibly qualify".
   */
  maxDuration: number;
  /** Ascending, which is the order the lane already arrives in. */
  starts: number[];
}

function indexLane(events: SessionEvent[]): LaneIndex {
  const starts: number[] = [];
  const ends: number[] = [];
  let maxDuration = 0;
  for (const event of events) {
    const extent = extentOf(event);
    if (extent === undefined) {
      continue;
    }
    starts.push(extent.start);
    ends.push(extent.end);
    maxDuration = Math.max(maxDuration, extent.end - extent.start);
  }
  return {starts, ends, maxDuration};
}

/**
 * How many of a lane's items overlap a range.
 *
 * Both ends of the candidate window are found by bisection rather than by walking
 * the lane, so a deep zoom costs the items it is actually showing instead of every
 * item the session holds. The lower bound leans on `maxDuration`: nothing that
 * started earlier than that can still be running when the range opens, so nothing
 * below it needs looking at.
 *
 * A lane of instants needs no scan at all — with no duration to reach forward, the
 * window between the two bounds *is* the answer.
 */
function countWithin({starts, ends, maxDuration}: LaneIndex, active: SessionRange) {
  const from = lowerBound(starts, active.start - maxDuration);
  const to = upperBound(starts, active.end);
  if (maxDuration === 0) {
    return to - from;
  }
  let count = 0;
  for (let index = from; index < to; index++) {
    if (ends[index]! >= active.start) {
      count += 1;
    }
  }
  return count;
}

/** First index holding a value at or after `target`. */
function lowerBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (values[mid]! < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/** First index holding a value after `target`. */
function upperBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (values[mid]! <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/**
 * Keeps a window inside the session, and collapses one that covers everything
 * back to `null` — no selection and a selection of the whole session should not
 * be two different states.
 */
function clampWindow(range: SessionRange, bounds: SessionRange): SessionRange | null {
  const start = Math.max(bounds.start, Math.min(range.start, bounds.end));
  const end = Math.min(bounds.end, Math.max(range.end, bounds.start));
  if (start <= bounds.start && end >= bounds.end) {
    return null;
  }
  return {start, end};
}

/**
 * Scales the viewport about a point, and keeps it inside the session.
 *
 * Stepped along the axis rather than through time, which is what keeps a notch worth
 * the same *distance* wherever it lands: a compressed axis spends a couple of dozen
 * pixels on a stretch of minutes, and a zoom measured in milliseconds would crawl
 * across the busy parts of a session and leap across the quiet ones.
 *
 * `focus` holds its place in the viewport, which is what makes a wheel zoom feel
 * aimed rather than approximate: the timestamp under the pointer is still under the
 * pointer afterwards, so the thing being zoomed into does not slide out from under
 * it on the way in.
 *
 * Near an edge the range slides back inside the session rather than being clipped,
 * so zooming out beside the session's last error still widens by the whole step
 * instead of stalling against the boundary.
 */
function zoomView(
  view: SessionRange,
  bounds: SessionRange,
  scale: TimeScale,
  focus: number,
  factor: number
): SessionRange | null {
  const from = scale.toRatio(view.start);
  const span = scale.toRatio(view.end) - from;
  const next = Math.min(1, span * factor);
  const focusAt = scale.toRatio(focus);
  const ratio = span <= 0 ? 0.5 : (focusAt - from) / span;
  let start = focusAt - next * ratio;
  if (start + next > 1) {
    start = 1 - next;
  }
  if (start < 0) {
    start = 0;
  }
  return clampWindow(
    withMinSpan(
      {start: scale.toTime(start), end: scale.toTime(start + next)},
      bounds,
      focus
    ),
    bounds
  );
}

/**
 * The floor on a viewport, applied once the axis has had its say.
 *
 * It cannot be applied before: a step along a compressed stretch is worth minutes,
 * so the same fraction of the axis is a different number of milliseconds depending
 * on where it lands. So the floor is imposed in time, about the point the gesture
 * was aimed at, and slid back inside the session.
 */
function withMinSpan(
  range: SessionRange,
  bounds: SessionRange,
  focus: number
): SessionRange {
  if (range.end - range.start >= MIN_VIEW_MS) {
    return range;
  }
  const half = MIN_VIEW_MS / 2;
  const centre = Math.min(
    Math.max(focus, bounds.start + half),
    Math.max(bounds.start + half, bounds.end - half)
  );
  return {start: centre - half, end: centre + half};
}

/** Slides the viewport without resizing it, by a distance along the axis. */
function panView(
  view: SessionRange,
  bounds: SessionRange,
  scale: TimeScale,
  byRatio: number
): SessionRange | null {
  const from = scale.toRatio(view.start);
  const span = scale.toRatio(view.end) - from;
  const start = Math.max(0, Math.min(from + byRatio, Math.max(0, 1 - span)));
  return clampWindow(
    {start: scale.toTime(start), end: scale.toTime(start + span)},
    bounds
  );
}

/**
 * One item, called out in its lane. A marker in a density lane gets a ring; an item
 * in a lane drawn across time gets an outline around the whole of it, so what is
 * highlighted is the same shape as what was clicked.
 *
 * Every measurement here is the paint's, not the item's. The marks live on a canvas
 * and this is a DOM element over the top of it, so the two agree only as far as they
 * are told to: a ring goes on the bucket the paint centred the marker on, and an
 * outline is the bar the paint drew — floor and all — grown by `HIGHLIGHT_INSET` on
 * every side.
 */
function Highlight({
  hit,
  isDuration,
  toPercent,
  toBucketCentre,
  laneTop,
  isSelected,
}: {
  hit: LaneHit;
  /** Whether this hit's lane is painted as bars rather than as bucketed marks. */
  isDuration: boolean;
  /** Where the first lane starts, which the route band moves down when present. */
  laneTop: number;
  toBucketCentre: (timestamp: number) => number | null;
  toPercent: (timestamp: number) => number;
  isSelected?: boolean;
}) {
  const extent = extentOf(hit.event);
  if (!extent) {
    return null;
  }

  const top = laneTop + hit.laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2;

  if (!isDuration) {
    const centre = toBucketCentre(extent.start);
    return (
      <Ring
        aria-hidden
        data-selected={isSelected}
        style={{
          left: centre === null ? `${toPercent(extent.start)}%` : centre,
          top,
        }}
      />
    );
  }

  const left = toPercent(extent.start);
  const span = toPercent(extent.end) - left;
  return (
    <BarOutline
      aria-hidden
      data-selected={isSelected}
      style={{
        left: `calc(${left}% - ${HIGHLIGHT_INSET}px)`,
        // The floor is the painted bar's, so a trace shorter than a pixel of session
        // is ringed by a box four pixels wider than the three-pixel bar it is drawn
        // as, evenly, rather than by a fixed box hanging off to the right of it.
        width: `calc(max(${BAR_MIN_PX}px, ${span}%) + ${HIGHLIGHT_INSET * 2}px)`,
        top: top - (BAR_HEIGHT + HIGHLIGHT_INSET * 2) / 2,
        height: BAR_HEIGHT + HIGHLIGHT_INSET * 2,
      }}
    />
  );
}

/**
 * The two column headings, and the route band's.
 *
 * Split out and memoized for one reason: a zoom re-renders the chart, and a scraps
 * `Text` is not free to re-render — it re-serializes its styles, which the profile
 * put at the top of what a notch costs once the lanes stopped being elements. None
 * of the words here change with the viewport, so none of them should be rebuilt by
 * it.
 */
const SessionHeader = memo(function SessionHeaderImpl() {
  return (
    <OverviewLabel>
      <Text size="xs" variant="muted" uppercase>
        {t('Session')}
      </Text>
    </OverviewLabel>
  );
});

const TimeHeader = memo(function TimeHeaderImpl() {
  return (
    <HeaderCell>
      <Text size="xs" variant="muted" uppercase>
        {t('Time')}
      </Text>
    </HeaderCell>
  );
});

/**
 * The route band's label. A lane's is a button because a lane can be switched off;
 * this one cannot — the route is the frame the other lanes are read inside, and a
 * frame you can remove is just another lane.
 */
const RouteHeader = memo(function RouteHeaderImpl({
  isError,
  isTruncated,
  visitCount,
}: {
  isError: boolean;
  isTruncated: boolean;
  visitCount: number;
}) {
  return (
    <RouteLabel>
      <LaneIcon>
        <IconWindow size="sm" />
      </LaneIcon>
      <Text size="sm">{t('Route')}</Text>
      {/*
        A footnote on the band, in the same place and the same shape the lane
        counts use for theirs. An error and a cap are both "this band is not the
        whole journey", and which one it is belongs in the tooltip rather than in
        two different markers.
      */}
      {(isError || isTruncated) && (
        <Fragment>
          <Flex flex="1" />
          <InfoText
            size="xs"
            variant="warning"
            title={
              isError
                ? t('Routes failed to load, so this band is missing.')
                : tct(
                    'Only the first [limit] route changes are plotted, so this band is partial.',
                    {limit: visitCount}
                  )
            }
          >
            {'*'}
          </InfoText>
        </Fragment>
      )}
    </RouteLabel>
  );
});

/**
 * A lane's glyph and name — the half of its toggle a zoom cannot touch.
 *
 * The count beside it genuinely follows the viewport and re-renders with it; this
 * half only moves when the lane is switched on or off, so it is held apart and
 * memoized rather than rebuilt four times a notch for words that did not change.
 */
const LaneLabel = memo(function LaneLabelImpl({
  label,
  type,
  color,
  isOn,
}: {
  color: string;
  isOn: boolean;
  label: string;
  type: SessionDatasetKey;
}) {
  return (
    <Fragment>
      {/*
        A glyph per lane, so a lane is identified before its label is read — and
        the same glyph the rail marks this type's rows with, which is what ties a
        row back to the lane it came from.
      */}
      <LaneIcon style={{color, opacity: isOn ? 1 : 0.4}}>
        <TelemetryTypeIcon type={type} size="sm" />
      </LaneIcon>
      <Text size="sm" variant={isOn ? 'primary' : 'muted'}>
        {label}
      </Text>
      {/*
        The count belongs beside the shape it summarizes rather than in a row of
        tiles of its own: "12 traces" and where those 12 fell in the session are
        one thought, and the label column already carries this type's color and
        its toggle.
      */}
      <Flex flex="1" />
    </Fragment>
  );
});

/**
 * The route band's segments.
 *
 * Memoized, and split out for exactly that reason. Its inputs only move when the
 * viewport does or when the pointer crosses a segment boundary — which is a dozen
 * times across a sweep, not once per pointer event — so leaving it inline made the
 * band's hundred-odd elements re-serialize their styles on every move.
 */
const RouteBand = memo(function RouteBandImpl({
  visits,
  hoverRoute,
  toPercent,
  routeColor,
  sessionStart,
  width,
}: {
  hoverRoute: RouteVisit | null;
  routeColor: (visit: RouteVisit) => string;
  sessionStart: number;
  toPercent: (timestamp: number) => number;
  visits: RouteVisit[];
  width: number;
}) {
  return (
    <RouteTrack>
      {visits.map(visit => {
        const from = toPercent(visit.start);
        const to = toPercent(visit.end);
        if (to <= 0 || from >= 100) {
          return null;
        }
        // Clamped to the viewport rather than left to overflow. A segment's name
        // sits at its leading edge, so zooming into the middle of a long stay
        // would otherwise leave an unnamed wash — the one place the band is most
        // worth reading.
        //
        // The two channels that state a *moment* drop out when that moment is
        // off-screen: the arrival rule, and the departure's rounded corner.
        // Clamped geometry must not go on to claim the user arrived at the edge
        // of the viewport.
        const left = Math.max(0, from);
        const widthPercent = Math.min(100, to) - left;
        return (
          <RouteSegment
            key={`${visit.route}-${visit.start}`}
            data-test-id="route-visit"
            data-hover={hoverRoute === visit ? true : undefined}
            // The same string the guide shows on hover, so a segment whose label
            // was dropped or clipped still says what it is — the way the rail
            // titles its own truncated text.
            title={describeRoute(visit, sessionStart)}
            style={{
              left: `${left}%`,
              width: `${widthPercent}%`,
              // `color-mix` rather than eleven hand-picked fill tokens: the wash
              // has to stay under body text at every one of the hues, and mixing
              // each toward the surface keeps that relationship instead of hoping
              // eleven literals hold it.
              background: `color-mix(in srgb, ${routeColor(visit)} 22%, transparent)`,
              borderLeftColor: from < 0 ? 'transparent' : routeColor(visit),
              borderRadius: to > 100 ? 0 : undefined,
            }}
          >
            {/*
              Dropped rather than ellipsed once the segment is narrower than a name
              needs: two characters and a "…" is not a route, and the guide label
              says the whole thing on hover either way.
            */}
            {/* An unmeasured track shows every label: overflow is already hidden,
                so guessing "wide enough" costs a clipped name at worst, while
                guessing the other way blanks the band for a frame. */}
            {(width === 0 || (widthPercent / 100) * width >= ROUTE_LABEL_MIN_PX) && (
              <RouteName>{visit.route}</RouteName>
            )}
          </RouteSegment>
        );
      })}
    </RouteTrack>
  );
});

/**
 * The heading that opens the services band.
 *
 * It exists to mark a change of axis. Everything above it is this session's own
 * telemetry sorted by kind, and everything below it is other people's work sorted
 * by who did it — a rule and a name are what stop the second thing from reading as
 * five more of the first.
 *
 * The count is deliberately phrased as "reached" rather than as a total. Services
 * the reader has no access to are dropped by the API without saying so, and a
 * label claiming completeness would be the one part of this band we cannot stand
 * behind.
 */
const ServicesHeader = memo(function ServicesHeaderImpl({
  caveat,
  laneCount,
  row,
  skipped,
}: {
  caveat: ReturnType<typeof bandCaveat>;
  laneCount: number;
  row: number;
  skipped: number;
}) {
  return (
    <Fragment>
      <ServicesHeadingLabel style={{gridRow: String(row)}}>
        <LaneIcon>
          <IconStack size="xs" />
        </LaneIcon>
        <Text size="xs" variant="muted" uppercase>
          {t('Services reached')}
        </Text>
      </ServicesHeadingLabel>
      <ServicesHeadingTrack style={{gridRow: String(row)}}>
        <Text size="xs" variant="muted">
          {laneCount > 0 &&
            tct('[count] from the traces this session started', {
              count: tn('%s project', '%s projects', laneCount),
            })}
        </Text>
        {caveat !== null && (
          <InfoText
            size="xs"
            variant="warning"
            title={
              caveat === 'error'
                ? t('Downstream services failed to load, so this band is missing.')
                : caveat === 'truncated'
                  ? t(
                      'This band plots a full page of server spans, so a service may be missing from it.'
                    )
                  : tct(
                      'Built from the first and last [limit] traces of this session. The [skipped] in between were never read, so the gap is unknown rather than empty.',
                      {limit: BAND_TRACES_PER_END, skipped}
                    )
            }
          >
            {'*'}
          </InfoText>
        )}
      </ServicesHeadingTrack>
    </Fragment>
  );
});

/**
 * One service's row: its name, and every stretch it was busy.
 *
 * The bars carry no hue of their own, and that is the rule the whole band rests
 * on. The four lanes above each own a colour, and a fifth would quietly promote
 * downstream work to a fifth kind of telemetry — when what it actually is, is the
 * same session seen from the other side. So a stretch is neutral when it worked
 * and `danger` when it did not, which leaves red meaning exactly what it means
 * everywhere else on this page.
 *
 * Red is per bar rather than per row, and the name never takes it. A service that
 * answered ten calls and failed one is not a failing service, and a row painted
 * red end to end would say it was — while hiding the one call that actually broke
 * among nine that did not.
 */
const ServiceRow = memo(function ServiceRowImpl({
  lane,
  row,
  toPercent,
  isLast,
  hoveredKey,
  selectedKey,
  platform,
}: {
  hoveredKey: string | null;
  isLast: boolean;
  lane: ServiceLane;
  platform: PlatformKey | undefined;
  row: number;
  selectedKey: string | null;
  toPercent: (at: number) => number;
}) {
  const theme = useTheme();
  const healthy = graphicsColor('muted', theme);
  const failed = graphicsColor('danger', theme);

  return (
    <Fragment>
      <ServiceLabelCell data-last={isLast} style={{gridRow: String(row)}}>
        {/*
          The project's own icon, which is how a service is recognized everywhere
          else in Sentry. It carries the thing the label cannot at a glance: that
          `payments-api` is Go and `report-worker` is Python, so a band of four
          rows reads as a stack rather than as four names.
        */}
        <ProjectAvatar project={{slug: lane.project, platform}} size={14} />
        <Text size="sm" variant="muted" ellipsis>
          {lane.project}
        </Text>
      </ServiceLabelCell>
      <ServiceTrack
        aria-hidden
        data-last={isLast}
        data-test-id="service-lane"
        style={{gridRow: String(row)}}
      >
        {lane.activity.map(({key, range, hasFailure}) => {
          const from = toPercent(range.start);
          const to = toPercent(range.end);
          if (to <= 0 || from >= 100) {
            return null;
          }
          const left = Math.max(0, from);
          // A floor rather than the true width: server work can be shorter than a
          // pixel of session, and a bar rounded away would say the service was
          // never called.
          const widthPercent = Math.max(Math.min(100, to) - left, 0);
          return (
            <ServiceBar
              key={key}
              data-failed={hasFailure}
              data-hover={hoveredKey === key ? true : undefined}
              data-selected={selectedKey === key ? true : undefined}
              data-test-id="service-bar"
              style={{
                left: `${left}%`,
                width: `${widthPercent}%`,
                background: hasFailure ? failed : healthy,
              }}
            />
          );
        })}
      </ServiceTrack>
    </Fragment>
  );
});

/**
 * The whole session, whatever the lanes are showing of it.
 *
 * Zooming costs the one thing a fixed chart had for free: knowing where you are.
 * This is that, in the least height that can carry it — the session's activity as
 * one merged row of ticks, with the viewport framed on top.
 *
 * It is also the only place the viewport can be *moved* rather than resized, which
 * the lanes below cannot offer: a drag down there means zoom, and one gesture
 * cannot mean two things. So the strip splits the drag by where it started —
 * inside the framed range it carries that range along, and outside it picks a new
 * one. A click outside jumps the range there in one go.
 *
 * Pointer-only, and hidden from assistive tech on the same grounds the lanes are:
 * it does nothing the focusable track's own arrow keys do not already do, and a
 * second stop that repeats the first is not an affordance.
 *
 * Memoized, because it is the densest thing on the chart and the one with least
 * reason to move: it draws the *whole* session, so it is unchanged by every hover,
 * and it is only the viewport frame on top of it that a zoom shifts. Left inline
 * it was several hundred ticks re-serializing their styles at pointer rate.
 */
const Overview = memo(function OverviewImpl({
  bounds,
  view,
  events,
  buckets,
  scale,
  onChangeView,
}: {
  bounds: SessionRange;
  buckets: number;
  events: SessionEvent[];
  onChangeView: (next: SessionRange | null) => void;
  /**
   * The same axis the lanes are drawn against. The strip has to share it or the
   * frame it draws would sit at a different place in the session than the range it
   * stands for.
   */
  scale: TimeScale;
  view: SessionRange;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<SessionRange | null>(null);
  /**
   * The gesture in progress: where it started, and the range it started from — so a
   * move is measured from the pointer's total travel rather than accumulated a
   * fraction at a time, which drifts.
   */
  const anchor = useRef<{
    clientX: number;
    from: SessionRange;
    grip: OverviewGrip | null;
  } | null>(null);
  /**
   * The pointer's own state, kept here rather than in CSS because the gesture
   * outlives the element it started on: the press captures the pointer to the
   * strip, so a `:hover` or `:active` rule on the frame stops matching the moment
   * the frame moves out from under the pointer — which is the whole of a carry.
   */
  const [cursor, setCursor] = useState(cursorFor(null));

  /**
   * With the whole session in view the frame *is* the strip, so there is nothing to
   * carry anywhere and every drag is a fresh selection. Grabbing only becomes a
   * gesture once there is something to grab.
   */
  const isZoomed = view.start > bounds.start || view.end < bounds.end;

  /** How far along the strip a pointer is, which is also how far along the axis. */
  const ratioFromClientX = useCallback((clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return 0;
    }
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const fromClientX = useCallback(
    (clientX: number) => scale.toTime(ratioFromClientX(clientX)),
    [ratioFromClientX, scale]
  );

  const toPercent = useCallback(
    (timestamp: number) => scale.toRatio(timestamp) * 100,
    [scale]
  );

  /**
   * Activity, graded by opacity rather than by height. Twenty pixels of row has no
   * vertical range worth spending, and full height is what keeps a mark visible at
   * one pixel wide. Rooted for the same reason the lanes' markers are: a bucket
   * holding two should still register beside one holding fifty.
   */
  const ticks = useMemo(() => {
    const counts = Array.from<number>({length: buckets}).fill(0);
    events.forEach(event => {
      if (event.timestamp === undefined) {
        return;
      }
      const index = Math.min(
        buckets - 1,
        Math.max(0, Math.floor(scale.toRatio(event.timestamp) * buckets))
      );
      counts[index]! += 1;
    });

    const max = Math.max(...counts, 1);
    return counts
      .map((count, index) => ({count, index}))
      .filter(bucket => bucket.count > 0)
      .map(({count, index}) => ({
        index,
        opacity: 0.35 + 0.65 * Math.pow(count / max, 0.55),
      }));
  }, [events, buckets, scale]);

  /**
   * What a press at this point would take hold of, in pixels rather than in time. A
   * deep zoom draws the frame a couple of pixels wide, which is a real thing on
   * screen and an unaimable one — so the grip reaches a little past it, the way the
   * lanes' own hit testing reaches past a very short bar.
   *
   * Takes the range rather than reading `view`, so the release can ask what the
   * pointer is now over using the range it just committed. Asked with the old one,
   * the pointer would sit on an end it had just dragged away from and say nothing.
   */
  const gripAt = useCallback(
    (clientX: number, range: SessionRange): OverviewGrip | null => {
      const rect = ref.current?.getBoundingClientRect();
      const isZoomable = range.start > bounds.start || range.end < bounds.end;
      if (!rect || rect.width === 0 || !isZoomable) {
        return null;
      }
      const from = rect.left + (toPercent(range.start) / 100) * rect.width;
      const to = rect.left + (toPercent(range.end) / 100) * rect.width;
      if (clientX < from - GRAB_TOLERANCE_PX || clientX > to + GRAB_TOLERANCE_PX) {
        return null;
      }
      const handle = Math.min(RESIZE_HANDLE_PX, (to - from) / 3);
      if (clientX <= from + handle) {
        return 'start';
      }
      if (clientX >= to - handle) {
        return 'end';
      }
      return 'move';
    },
    [bounds.end, bounds.start, toPercent]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const grip = gripAt(event.clientX, view);
    anchor.current = {clientX: event.clientX, from: view, grip};
    setCursor(cursorFor(grip, true));
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = anchor.current;
    if (start === null) {
      setCursor(cursorFor(gripAt(event.clientX, view)));
      return;
    }
    if (Math.abs(event.clientX - start.clientX) < MIN_DRAG_PX) {
      return;
    }
    if (start.grip === 'start' || start.grip === 'end') {
      // The end that was not taken hold of stays put and the one that was follows
      // the pointer, past its opposite number if it goes that far: a pull that
      // overshoots turns the range around rather than stopping dead against a floor
      // it cannot see.
      const fixed = start.grip === 'start' ? start.from.end : start.from.start;
      const at = fromClientX(event.clientX);
      const span = Math.max(MIN_VIEW_MS, Math.abs(at - fixed));
      setDraft(
        at < fixed ? {start: fixed - span, end: fixed} : {start: fixed, end: fixed + span}
      );
      return;
    }
    if (start.grip === 'move') {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        return;
      }
      // Measured raw rather than through `ratioFromClientX`, which clamps to the
      // strip: two clamped ends would quietly shorten every drag that overshoots an
      // edge, and the range itself is already held inside the session by `panView`.
      const by = (event.clientX - start.clientX) / rect.width;
      setDraft(panView(start.from, bounds, scale, by) ?? bounds);
      return;
    }
    const from = fromClientX(start.clientX);
    const at = fromClientX(event.clientX);
    setDraft({start: Math.min(from, at), end: Math.max(from, at)});
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = anchor.current;
    if (start === null) {
      return;
    }
    anchor.current = null;

    let next: SessionRange | null = view;
    if (draft) {
      next = clampWindow(draft, bounds);
      onChangeView(next);
      setDraft(null);
    } else if (start.grip === null) {
      // A press outside the frame jumps the range there, span intact — the same
      // move as the drag, for when the distance is far enough that dragging it is a
      // chore. On the frame it leaves it where it is: the gesture it began was a
      // carry or a pull on one end, and neither has a destination at zero distance.
      const from = scale.toRatio(view.start);
      const span = scale.toRatio(view.end) - from;
      next = panView(
        view,
        bounds,
        scale,
        ratioFromClientX(event.clientX) - (from + span / 2)
      );
      onChangeView(next);
    }

    setCursor(cursorFor(gripAt(event.clientX, next ?? bounds)));
  };

  const shown = draft ?? view;
  const left = toPercent(shown.start);
  const right = toPercent(shown.end);

  return (
    <OverviewTrack
      ref={ref}
      aria-hidden
      data-test-id="session-overview"
      title={
        isZoomed
          ? t(
              'Drag the highlighted range to move it, drag either end to resize it, or drag elsewhere to pick a new one'
            )
          : t('Drag to pick a range')
      }
      style={{cursor}}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/*
        The strip draws the whole session on the same axis the lanes use, so it has
        to say where that axis was cut — otherwise it is the one place on the chart
        claiming the session is evenly spaced.
      */}
      {scale.idle.map(segment => (
        <OverviewIdle
          key={segment.start}
          style={{
            left: `${segment.u0 * 100}%`,
            width: `${(segment.u1 - segment.u0) * 100}%`,
          }}
        />
      ))}
      <OverviewTicks ticks={ticks} buckets={buckets} />
      <OverviewShade style={{left: 0, width: `${left}%`}} />
      <OverviewShade style={{left: `${right}%`, right: 0}} />
      <OverviewViewport style={{left: `${left}%`, width: `${right - left}%`}} />
    </OverviewTrack>
  );
});

/**
 * The strip's activity, which a zoom cannot change.
 *
 * Split from the strip and memoized because of that: the ticks are drawn against
 * the *session*, while the frame over them is drawn against the viewport. Sharing
 * one component made a wheel gesture redraw several hundred ticks per notch to
 * move three elements.
 */
const OverviewTicks = memo(function OverviewTicksImpl({
  ticks,
  buckets,
}: {
  buckets: number;
  ticks: Array<{index: number; opacity: number}>;
}) {
  return (
    <Fragment>
      {ticks.map(tick => (
        <OverviewTick
          key={tick.index}
          style={{
            left: `${((tick.index + 0.5) / buckets) * 100}%`,
            opacity: tick.opacity,
          }}
        />
      ))}
    </Fragment>
  );
});

/**
 * One type's presence over the session, drawn in whichever of the two ways suits
 * what it holds.
 *
 * Which one is decided by the data rather than by the lane's name: anything
 * reporting a duration is drawn across it. Bars are one element per item because
 * that is the point of them — a bucketed bar would say nothing a dot doesn't —
 * while the density path stays aggregated so an empty stretch costs no DOM.
 *
 * Memoized on primitives, so the markers survive a pointer move untouched. The
 * hover treatment a lane gets is drawn by the overlay above it rather than by the
 * lane, which is what makes that possible.
 */
/**
 * Every lane's marks, and the route wash behind them, on one canvas.
 *
 * These were four hundred absolutely positioned elements, and a zoom moves all of
 * them: it changes the domain the chart is drawn against, so every left and every
 * width is genuinely different and React had to reconcile, restyle and re-lay-out
 * the lot at pointer rate. The marks earn none of that. They carry no text, they
 * are already hidden from assistive tech, and nothing clicks them — hit testing
 * reads the sorted event arrays, not the DOM, so what drew the pixels is not
 * something the rest of the chart has an opinion about.
 *
 * So they are painted instead. Cost becomes the marks actually drawn, at roughly a
 * microsecond each, rather than the nodes reconciled at sixty times that — which is
 * what makes a lane holding the full thousand rows affordable rather than merely
 * permitted.
 *
 * What stays in the DOM stays for a reason: the route band has text, tooltips and a
 * hover state; the overview strip cannot change under a zoom; the overlay is where
 * every interactive affordance lives. This canvas is only the part that is pure
 * shape.
 */
const LaneCanvas = memo(function LaneCanvasImpl({
  lanes,
  visits,
  routeColor,
  buckets,
  scale,
  viewStart,
  viewSpan,
  width,
  firstLaneRow,
  tint,
}: {
  buckets: number;
  firstLaneRow: number;
  lanes: Array<{color: string; events: SessionEvent[]; isOn: boolean}>;
  routeColor: (visit: RouteVisit) => string;
  scale: TimeScale;
  tint: string;
  viewSpan: number;
  viewStart: number;
  visits: RouteVisit[];
  width: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = lanes.length * LANE_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    // Backed at device resolution and scaled back down, so a hairline rule is a
    // hairline rather than a smear on the displays this is mostly read on.
    const ratio = globalThis.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const toUnit = (timestamp: number) =>
      (scale.toRatio(timestamp) - viewStart) / viewSpan;
    const toX = (timestamp: number) => toUnit(timestamp) * width;

    // The route's reach into the lanes, painted first so the marks land on top.
    visits.forEach((visit, index) => {
      const from = toX(visit.start);
      const to = toX(visit.end);
      if (to <= 0 || from >= width) {
        return;
      }
      const left = Math.max(0, from);
      if (index % 2 === 1) {
        context.globalAlpha = 0.35;
        context.fillStyle = tint;
        context.fillRect(left, 0, Math.min(width, to) - left, height);
      }
      // Only where the change is actually in view — a rule pinned to the
      // viewport's edge would invent a boundary there.
      if (index > 0 && from >= 0) {
        context.globalAlpha = 0.7;
        context.fillStyle = routeColor(visit);
        context.fillRect(Math.round(from), 0, 1, height);
      }
    });

    lanes.forEach((lane, laneIndex) => {
      const top = laneIndex * LANE_HEIGHT;
      const middle = top + LANE_HEIGHT / 2;
      // A lane that is off is dimmed rather than dropped: the same treatment its
      // track used to carry, moved to the paint that replaced it.
      context.globalAlpha = lane.isOn ? 1 : 0.3;
      context.fillStyle = lane.color;

      if (hasDurations(lane.events)) {
        context.globalAlpha *= 0.75;
        for (const bar of durationBars(lane.events, toUnit)) {
          const left = bar.left * width;
          const barWidth = Math.max(BAR_MIN_PX, bar.width * width);
          context.beginPath();
          context.roundRect(
            left,
            middle - BAR_HEIGHT / 2,
            barWidth,
            BAR_HEIGHT,
            BAR_RADIUS_PX
          );
          context.fill();
        }
        return;
      }

      const bucketWidth = width / buckets;
      for (const mark of densityMarks(lane.events, buckets, toUnit)) {
        // Centred on its bucket, so a lone marker sits where the item is rather
        // than at the left edge of the slice it fell into.
        const centre = (mark.index + 0.5) * bucketWidth;
        const markWidth = Math.max(MARKER_MIN, bucketWidth);
        context.beginPath();
        // A pill, which is what `radius.full` drew: the shorter side, halved.
        context.roundRect(
          centre - markWidth / 2,
          middle - mark.height / 2,
          markWidth,
          mark.height,
          Math.min(markWidth, mark.height) / 2
        );
        context.fill();
      }
    });

    context.globalAlpha = 1;
  }, [
    lanes,
    visits,
    routeColor,
    buckets,
    scale,
    viewStart,
    viewSpan,
    width,
    height,
    tint,
  ]);

  return (
    <LaneSurface
      ref={canvasRef}
      aria-hidden
      data-test-id="session-lanes"
      // Spanning exactly the lanes, not `/ -1`. The services band adds rows after
      // them, and a canvas running to the end of the grid would be laid over the
      // band's own track — where it would paint nothing but would still sit on
      // top of it.
      style={{gridRow: `${firstLaneRow} / span ${lanes.length}`, height}}
    />
  );
});

/** Whether a lane is drawn across time or at instants. */
function hasDurations(events: SessionEvent[]): boolean {
  return events.some(event => event.duration !== undefined);
}

/**
 * A bar per item, across the time it occupied, as a fraction of the viewport.
 * Overlapping bars are drawn over each other at partial opacity rather than
 * stacked into rows: the lane is one band of time, and where two traces overlap
 * the darker patch says so.
 */
function durationBars(
  events: SessionEvent[],
  toUnit: (timestamp: number) => number
): Array<{left: number; width: number}> {
  const bars: Array<{left: number; width: number}> = [];
  for (const event of events) {
    if (event.timestamp === undefined) {
      continue;
    }
    const left = toUnit(event.timestamp);
    const right = toUnit(event.timestamp + (event.duration ?? 0));
    // Culled rather than drawn and clipped: off-screen bars cost a path each.
    if (right < 0 || left > 1) {
      continue;
    }
    // A bar is never drawn across a break: a compressed stretch is one with nothing
    // in it, so no item's extent reaches into one. Its width is therefore read at
    // one scale, whatever the rest of the axis is doing.
    bars.push({left, width: right - left});
  }
  return bars;
}

/**
 * Bucketed marks for the instants, so an empty stretch costs no drawing.
 *
 * They are centred on the lane rather than grown from its floor: a swimlane is
 * read for *when* something happened, and a row of bottom-anchored bars reads as
 * a histogram, which invites comparing heights across lanes that share no scale.
 *
 * Each lane is scaled to its own busiest bucket. A once-a-minute metric heartbeat
 * and a burst of two hundred logs have nothing useful to say on one scale.
 */
function densityMarks(
  events: SessionEvent[],
  buckets: number,
  toUnit: (timestamp: number) => number
): Array<{height: number; index: number}> {
  const counts = Array.from<number>({length: buckets}).fill(0);
  for (const event of events) {
    if (event.timestamp === undefined) {
      continue;
    }
    const unit = toUnit(event.timestamp);
    // Dropped rather than clamped. The index clamp below is there for the item
    // landing exactly on the viewport's end; letting it absorb everything *outside*
    // the viewport as well would pile the session's other half into the first bucket
    // and invent a burst at each edge of every zoom.
    if (unit < 0 || unit > 1) {
      continue;
    }
    const index = Math.min(buckets - 1, Math.max(0, Math.floor(unit * buckets)));
    counts[index]! += 1;
  }

  const max = Math.max(...counts, 1);
  const marks: Array<{height: number; index: number}> = [];
  counts.forEach((count, index) => {
    if (count === 0) {
      return;
    }
    marks.push({
      index,
      // A single item is a dot, whatever the lane's busiest bucket holds — the
      // height is spent on how much *more* than one happened here. Rooted rather
      // than linear so two stays visible beside fifty.
      height:
        max === 1
          ? MARKER_MIN
          : MARKER_MIN +
            Math.pow((count - 1) / (max - 1), 0.55) * (MARKER_MAX - MARKER_MIN),
    });
  });
  return marks;
}

/**
 * The frame. Column gaps would break the row rules, so the two columns are
 * divided by a border and padded from the inside instead.
 */
const Chart = styled('div')<{
  hasRoutes: boolean;
  hasServices: boolean;
  laneCount: number;
  serviceCount: number;
}>`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  grid-template-rows:
    ${OVERVIEW_HEIGHT}px ${HEADER_HEIGHT}px
    ${p => (p.hasRoutes ? `${ROUTE_HEIGHT}px ` : '')} ${p => laneRows(p.laneCount)}
    ${p => (p.hasServices ? serviceRows(p.serviceCount) : '')};
  /*
   * Bottom edge only. The chart used to be a bordered, rounded card floating
   * inside the panel, which drew a second frame a few pixels in from the frame
   * the panel already has. It now runs to the panel's edges and keeps just the
   * rule that closes the last lane and separates it from the zoom note.
   */
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  overflow: hidden;

  /*
   * Read by the pieces that redraw with the viewport — the lane toggles, the lane
   * rows and the axis ticks. Each of those interpolated the theme itself, which
   * emotion has to re-serialize and re-hash per instance per render, and between
   * them they are two dozen elements a zoom notch. Hoisted here they are static
   * rules serialized once for the page.
   */
  --scrubber-rule: ${p => p.theme.tokens.border.primary};
  --scrubber-label-gap: ${p => p.theme.space.sm};
  --scrubber-label-padding: ${p => p.theme.space.lg};
  --scrubber-label-hover: ${p => p.theme.tokens.background.secondary};
  --scrubber-tick-padding: ${p => p.theme.space.xs};

  /*
   * How a compressed stretch is drawn, in both of the places one is drawn: the
   * track and the strip above it.
   *
   * Three quiet signals rather than one loud one, and the balance between them is
   * the whole design. A flat surface change carries most of it — a compressed
   * stretch holds no marks, so saying it is not plot area is both the clearest
   * reading and a true one. One step down from the panel's own surface is enough for
   * that; the depth token below it turned the band into a slab, which is a lot of
   * emphasis for time where nothing happened. The hatch over it only has to confirm
   * the surface, so it is sparse and faint. The edges are the same rule the lanes
   * are closed with, which is what makes the band read as part of the chart.
   *
   * Both are mixed from the *text* colour rather than from a border tone: a rule
   * that reads quietly on white all but disappears on the dark ground, while the
   * colour the chart's own labels are set in has to carry in both by definition.
   *
   * (No backticks in here: this comment is inside a template literal, and one would
   * end it.)
   */
  --scrubber-cut-surface: ${p => p.theme.tokens.background.secondary};
  --scrubber-cut-hatch: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 5px,
    color-mix(in srgb, ${p => p.theme.tokens.content.secondary} 18%, transparent) 5px,
    color-mix(in srgb, ${p => p.theme.tokens.content.secondary} 18%, transparent) 6px
  );
`;

/**
 * The route band's label. A lane's is a button because a lane can be switched off;
 * this one cannot — the route is the frame the other lanes are read inside, and a
 * frame you can remove is just another lane.
 */
const RouteLabel = styled('div')`
  grid-column: 1;
  grid-row: 3;
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: 0 ${p => p.theme.space.lg};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const RouteTrack = styled('div')`
  grid-column: 2;
  grid-row: 3;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  /* Read by the segments and their names, so those stay static. */
  --scrubber-route-radius: ${p => p.theme.radius.xs};
  --scrubber-route-padding: ${p => p.theme.space['2xs']};
  --scrubber-route-font-size: ${p => p.theme.font.size.xs};
  --scrubber-route-color: ${p => p.theme.tokens.content.primary};
`;

/**
 * One stay. Unlike every other shape in this chart these tile rather than sit at a
 * point, so each carries a leading rule in the route's own colour at full strength
 * over a washed fill — abutting segments of similar hue would otherwise read as
 * one, and the boundary is the thing worth seeing.
 */
const RouteSegment = styled('div')`
  position: absolute;
  top: 3px;
  bottom: 3px;
  display: flex;
  align-items: center;
  overflow: hidden;
  /*
   * Rounded on the trailing side only. The leading edge is a hard 3px rule at full
   * strength against a 22% fill, so it reads as the moment of arrival rather than
   * as the corner of a box — which is the difference between seeing two stays and
   * seeing one, when both stays are on the same route and therefore the same colour.
   */
  border-radius: 0 var(--scrubber-route-radius) var(--scrubber-route-radius) 0;
  border-left: 3px solid transparent;
  padding: 0 var(--scrubber-route-padding);

  /*
   * Brightened rather than outlined: the fill is one of eleven hues and set
   * inline, so the only treatment that reads the same on all of them is one that
   * works off whatever the segment already is.
   */
  &[data-hover] {
    filter: brightness(1.35);
  }
`;

const RouteName = styled('span')`
  font-size: var(--scrubber-route-font-size);
  color: var(--scrubber-route-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/**
 * The services heading, across both columns.
 *
 * Its top rule is heavier than the ones between lanes on purpose: every other rule
 * in this chart separates two rows of the same thing, and this one separates two
 * different things. It is the only horizontal line here that means "what follows
 * is not more of what came before".
 */
const ServicesHeadingLabel = styled('div')`
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: 0 ${p => p.theme.space.lg};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const ServicesHeadingTrack = styled('div')`
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: 0 ${p => p.theme.space.lg};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
  overflow: hidden;
  white-space: nowrap;
`;

/**
 * A service's name. A div rather than a button, like the route band's label and
 * unlike a lane's: there is nothing to toggle here. A lane can be switched off
 * because it is one of the things the session *is*, while a service is context for
 * all of them at once.
 */
const ServiceLabelCell = styled('div')`
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: var(--scrubber-label-gap);
  min-width: 0;
  padding: 0 ${p => p.theme.space.lg};
  border-right: 1px solid var(--scrubber-rule);
  border-bottom: 1px solid var(--scrubber-rule);

  &[data-last='true'] {
    border-bottom: none;
  }
`;

const ServiceTrack = styled('div')`
  grid-column: 2;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--scrubber-rule);

  &[data-last='true'] {
    border-bottom: none;
  }
`;

/**
 * One stretch of server work.
 *
 * Squarer and flatter than anything in the lanes above. A lane's marks vary in
 * height to say how much landed there; these vary only in width, because what a
 * service row answers is when — not how much, which the row has no honest way to
 * know from segment spans alone.
 */
const ServiceBar = styled('div')`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: ${SERVICE_BAR_HEIGHT}px;
  min-width: ${SERVICE_BAR_MIN_PX}px;
  border-radius: ${p => p.theme.radius['2xs']};
  opacity: 0.75;

  /*
   * The same two rings the lanes above draw around a hovered and a selected item —
   * neutral for "the pointer is here", accent for "this is the one the panel is
   * about" — so a bar answers the pointer identically on both sides of the
   * heading. An outline rather than a border because it is drawn outside the box:
   * a border would resize a bar that may already be at its minimum width.
   */
  &[data-hover] {
    opacity: 1;
    outline: 1.5px solid ${p => p.theme.tokens.graphics.neutral.vibrant};
    outline-offset: 1px;
  }

  &[data-selected] {
    opacity: 1;
    outline: 2px solid ${p => p.theme.tokens.graphics.accent.vibrant};
    outline-offset: 1px;
  }
`;

/** The area the unloaded marker is positioned inside: every service row at once. */
const UnloadedCell = styled('div')`
  grid-column: 2;
  position: relative;
  overflow: hidden;
  pointer-events: none;
`;

/**
 * The stretch of the session the band never asked about.
 *
 * Dashed edges and a flat wash rather than the diagonal hatch used elsewhere in
 * this chart. That hatch already means "compressed quiet stretch" on the track
 * above, and the two are near opposites: one is time we know nothing happened in,
 * this is time we know nothing about. Reusing the mark would say both with one
 * shape.
 */
const UnloadedWindow = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  border-left: 1px dashed ${p => p.theme.tokens.border.primary};
  border-right: 1px dashed ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
  opacity: 0.85;
  overflow: hidden;
  white-space: nowrap;
  padding: 0 ${p => p.theme.space['2xs']};
`;

/**
 * The strip's label. Says "Session" rather than "Overview" because that is what it
 * draws — the whole of it, which is the one thing the lanes beside it may not be.
 */
const OverviewLabel = styled('div')`
  grid-column: 1;
  grid-row: 1;
  display: flex;
  align-items: center;
  padding: 0 ${p => p.theme.space.lg};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const OverviewTrack = styled('div')`
  grid-column: 2;
  grid-row: 1;
  position: relative;
  overflow: hidden;
  /* Overridden inline for whatever the pointer is over; see cursorFor. */
  cursor: crosshair;
  touch-action: none;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
  /* Read by every tick inside, so those stay static. */
  --scrubber-tick-color: ${p => p.theme.tokens.graphics.neutral.vibrant};
`;

/** One bucket of the session's activity, at one pixel and full height. */
const OverviewTick = styled('div')`
  position: absolute;
  top: 3px;
  bottom: 3px;
  width: 1px;
  background: var(--scrubber-tick-color);
`;

/** A stretch the axis compressed, drawn the same way the track's breaks are. */
const OverviewIdle = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  background-color: var(--scrubber-cut-surface);
  background-image: var(--scrubber-cut-hatch);
`;

/** Outside the viewport, which here is most of the strip most of the time. */
const OverviewShade = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  background: ${p => p.theme.tokens.background.transparent.neutral.muted};
  pointer-events: none;
`;

/**
 * The viewport: all edges, no fill. What it frames is the only part of the strip
 * meant to be read, so tinting it would be tinting the answer — and the shade
 * either side has already said where the boundary is.
 */
const OverviewViewport = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  border: 1px solid ${p => p.theme.tokens.border.accent.vibrant};
  border-radius: ${p => p.theme.radius.xs};

  /*
   * Decoration only. The frame is the handle, but the strip underneath does the
   * hit testing for it: the handles are a few pixels either side of these edges,
   * which is narrower and wider than the frame itself in turn, and the cursor has
   * to survive the frame moving out from under the pointer mid-carry.
   */
  pointer-events: none;
`;

const HeaderCell = styled('div')`
  grid-column: 1;
  grid-row: 2;
  display: flex;
  align-items: center;
  padding: 0 ${p => p.theme.space.lg};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const Axis = styled('div')`
  grid-column: 2;
  grid-row: 2;
  position: relative;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const Tick = styled('div')`
  position: absolute;
  top: 50%;
  white-space: nowrap;
  padding: 0 var(--scrubber-tick-padding);
`;

const LaneToggle = styled('button')`
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: var(--scrubber-label-gap);
  width: 100%;
  background: none;
  border: 0;
  border-right: 1px solid var(--scrubber-rule);
  border-bottom: 1px solid var(--scrubber-rule);
  padding: 0 var(--scrubber-label-padding);
  margin: 0;
  cursor: pointer;
  text-align: left;

  &[data-last='true'] {
    border-bottom: 0;
  }

  &:hover {
    background: var(--scrubber-label-hover);
  }
`;

const LaneIcon = styled('span')`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

/**
 * Clipped to itself, so a lane can never paint over the label column beside it.
 * The frame's own `overflow: hidden` is not enough: it clips at the chart's edge,
 * and the labels are inside the chart. A bar drawn from an item a fraction of a
 * second outside the domain would otherwise reach back across its own label.
 */
/**
 * A lane's row. Empty now that the marks are painted: what it still carries is the
 * rule that closes the lane, which the grid needs an element to hang off and which
 * stays crisper as a border than as a line drawn into the canvas.
 */
const LaneTrack = styled('div')`
  grid-column: 2;
  position: relative;
  border-bottom: 1px solid var(--scrubber-rule);

  &[data-last='true'] {
    border-bottom: 0;
  }
`;

/**
 * What the lanes are painted on. Spans every lane row as one element and paints
 * before them in DOM order, so the rules that close each lane draw over it.
 *
 * Sized in CSS and backed at device resolution in the paint, which is the only
 * part of a canvas that has to be said twice.
 */
const LaneSurface = styled('canvas')`
  grid-column: 2;
  width: 100%;
  pointer-events: none;
`;

/**
 * The interactive surface, laid over the axis and every lane as one element so a
 * drag selects a time range rather than a range within one type.
 */
const Track = styled('div')`
  grid-column: 2;
  /* From the axis down. The strip above it has pointer handling of its own. */
  grid-row: 2 / -1;
  position: relative;
  cursor: crosshair;
  touch-action: none;
  z-index: 1;

  /* Over an item the pointer is aiming at one thing, not at a range. */
  &[data-hit] {
    cursor: pointer;
  }

  /* Inset, because the frame clips anything drawn outside the track's edges. */
  &:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px ${p => p.theme.tokens.focus.default};
  }
`;

const Veil = styled('div')`
  position: absolute;
  top: ${HEADER_HEIGHT}px;
  bottom: 0;
  background: ${p => p.theme.tokens.background.transparent.neutral.muted};
  pointer-events: none;
`;

/**
 * The selection, said with its edges rather than with its fill.
 *
 * `transparent.accent.muted` is a 58%-alpha blurple — sized for emphasizing a
 * block of content, and laid over four lanes of coloured markers it repaints all
 * of them purple. The veil outside already establishes where the window is, so the
 * fill only has to confirm it: a whisper of accent, with the two crisp edges left
 * at full strength doing the actual work.
 */
const Window = styled('div')`
  position: absolute;
  top: ${HEADER_HEIGHT}px;
  bottom: 0;
  border-left: 1.5px solid ${p => p.theme.tokens.border.accent.vibrant};
  border-right: 1.5px solid ${p => p.theme.tokens.border.accent.vibrant};
  background: color-mix(
    in srgb,
    ${p => p.theme.tokens.background.transparent.accent.muted} 10%,
    transparent
  );
  pointer-events: none;
`;

/**
 * Time the axis took out, said with a hatch rather than with an absence.
 *
 * Runs from the axis down through every lane, because what it cuts is the whole
 * chart: a break that stopped short of the lanes would read as the user staying on
 * one page while the lanes below carried on without them.
 *
 * The one overlay here that takes the pointer. It carries its own tooltip and its
 * own cursor, and a press still reaches the track underneath — pointer events
 * bubble, so the gesture is handled in the one place every other gesture is.
 */
const Break = styled('div')`
  position: absolute;
  /*
   * From the very top of the track, which is the axis row rather than the first
   * lane. The axis is the thing that was cut, so the cut has to run through the
   * times as well as through what is plotted against them — stopping below them
   * left the row of offsets reading as though it ran evenly across the session.
   */
  top: 0;
  bottom: 0;
  cursor: zoom-in;
  border-left: 1px solid var(--scrubber-rule);
  border-right: 1px solid var(--scrubber-rule);
  background-color: var(--scrubber-cut-surface);
  background-image: var(--scrubber-cut-hatch);
`;

/**
 * How much time the break stands for, in the axis row the cut now runs through —
 * where a time already belongs, and the only row with the height to carry text.
 *
 * Centred on a band two dozen pixels wide, so it overhangs both sides; the frame
 * clips it at the chart's edge, which is the same bargain the guide's own label
 * makes. It carries the cut's own surface as its background, so it reads as a patch
 * left clear in the hatch rather than as a chip laid over it.
 */
const BreakLabel = styled('span')`
  position: absolute;
  top: ${HEADER_HEIGHT / 2}px;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.xs};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  padding: 0 ${p => p.theme.space['2xs']};
  border-radius: ${p => p.theme.radius.xs};
  background: var(--scrubber-cut-surface);
  color: ${p => p.theme.tokens.content.secondary};
`;

/**
 * A ring rather than a filled dot: the marker it is calling out has to stay
 * readable underneath it, and its own color is the lane's.
 */
const Ring = styled('div')`
  position: absolute;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: ${p => p.theme.radius.full};
  border: 1.5px solid ${p => p.theme.tokens.graphics.neutral.vibrant};
  pointer-events: none;

  &[data-selected='true'] {
    border-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    border-width: 2px;
  }
`;

/** The same call-out for a bar: an outline around the time it covers. */
const BarOutline = styled('div')`
  position: absolute;
  border-radius: ${p => p.theme.radius.sm};
  border: 1.5px solid ${p => p.theme.tokens.graphics.neutral.vibrant};
  pointer-events: none;

  &[data-selected='true'] {
    border-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    border-width: 2px;
  }
`;

const Guide = styled('div')`
  position: absolute;
  top: ${HEADER_HEIGHT}px;
  bottom: 0;
  width: 1px;
  background: ${p => p.theme.tokens.graphics.neutral.vibrant};
  pointer-events: none;
`;

/**
 * Sits in the axis row the guide starts under, which is where a time already
 * belongs — anchoring it to the top of the guide would leave it hanging over the
 * lanes it is meant to be measuring.
 */
const GuideLabel = styled('span')`
  position: absolute;
  bottom: 100%;
  transform: translateX(-50%);
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.xs};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 ${p => p.theme.space['2xs']};
  border-radius: ${p => p.theme.radius.xs};
  background: ${p => p.theme.tokens.background.tertiary};
  color: ${p => p.theme.tokens.content.primary};
`;
