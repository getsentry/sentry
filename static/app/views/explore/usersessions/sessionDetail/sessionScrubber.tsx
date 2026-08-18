import type {CSSProperties} from 'react';
import {Fragment, memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconWindow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useDimensions} from 'sentry/utils/useDimensions';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import {itemKey} from './itemKey';
import type {RouteBand, RouteVisit} from './routeVisits';
import {formatDurationMs, formatOffset} from './sessionTime';
import {TelemetryTypeIcon} from './telemetryTypeIcon';
import type {SessionEvent, SessionRange} from './useSessionDetail';

/**
 * Lanes run most-severe first rather than in dataset order: an error lane at the
 * top is the first thing scanned, and it is most often what explains the session.
 */
const LANE_ORDER: SessionDatasetKey[] = ['errors', 'traces', 'logs', 'metrics'];

const LANES = LANE_ORDER.map(key => SESSION_DATASETS.find(config => config.key === key)!);

const HEADER_HEIGHT = 28;
const LANE_HEIGHT = 40;
/** Kept whole: split across lines by the formatter, `repeat (…)` is not CSS. */
const LANE_ROWS = `repeat(${LANES.length}, ${LANE_HEIGHT}px)`;

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

/** Target width of one density bucket. Wider reads as a bar chart, narrower as noise. */
const BUCKET_WIDTH = 6;
const MIN_BUCKETS = 24;
const MAX_BUCKETS = 160;

/** Bucket count before the track has been measured (first paint, and jsdom). */
const FALLBACK_BUCKETS = 60;

/** Roughly the width one axis label needs before its neighbour crowds it. */
const TICK_SPACING = 130;
const MAX_TICKS = 7;

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

/** An item under the pointer, and which lane it was found in. */
interface LaneHit {
  event: SessionEvent;
  key: string;
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
  return {start: event.timestamp, end: event.timestamp + (event.duration ?? 0)};
}

/**
 * The session at a glance: one lane per telemetry type across whatever range is in
 * view, over a strip showing where in the session that range sits.
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
  routes,
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
  const [hoverAt, setHoverAt] = useState<number | null>(null);
  const [hover, setHover] = useState<LaneHit | null>(null);
  /** The route segment under the pointer, which is a different aim than an item. */
  const [hoverRoute, setHoverRoute] = useState<RouteVisit | null>(null);
  const anchor = useRef<{clientX: number; timestamp: number} | null>(null);

  /**
   * The domain everything here is drawn against — the whole session, until one is
   * zoomed into. `bounds` stays what it always was: the session itself, which is
   * what every range is clamped to and what the overview strip draws.
   */
  const view = pendingView ?? window ?? bounds;
  const domain = view.end - view.start;
  const isZoomed = view.start > bounds.start || view.end < bounds.end;
  const enabled = useMemo(() => new Set(selectedTypes), [selectedTypes]);
  /**
   * What the lane counts and their truncation notes are talking about: a drag's own
   * selection while it is being made, and otherwise whatever the zoom is showing.
   * Null means the whole session, where the exact aggregates apply.
   */
  const scoped = draft ?? (isZoomed ? view : null);
  const laneCounts = useLaneCounts(counts, eventsByType, scoped);

  /**
   * Every plotted item of every enabled type, for the overview strip's single row.
   * Merged rather than laned: in twenty pixels the strip is answering "where in
   * this session did anything happen at all", and four rows of five pixels each
   * answers nothing.
   */
  const overviewEvents = useMemo(
    () => LANE_ORDER.filter(key => enabled.has(key)).flatMap(key => eventsByType[key]),
    [enabled, eventsByType]
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

  const buckets =
    width > 0
      ? Math.min(MAX_BUCKETS, Math.max(MIN_BUCKETS, Math.floor(width / BUCKET_WIDTH)))
      : FALLBACK_BUCKETS;

  // Evenly spaced offsets across the session, as many as fit without the labels
  // running into each other.
  const ticks = useMemo(() => {
    const count =
      width > 0 ? Math.max(2, Math.min(MAX_TICKS, Math.floor(width / TICK_SPACING))) : 2;
    return Array.from({length: count}, (_, index) => index / (count - 1));
  }, [width]);

  const toPercent = useCallback(
    (timestamp: number) => ((timestamp - view.start) / domain) * 100,
    [view.start, domain]
  );

  const fromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        return view.start;
      }
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return view.start + ratio * domain;
    },
    [view.start, domain]
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
        setPendingView(null);
        onChangeWindow(next);
        return;
      }
      setPendingView(next ?? bounds);
      flush.current = setTimeout(() => {
        flush.current = null;
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
    },
    []
  );

  /**
   * Wheel zooms, anchored on the pointer.
   *
   * Horizontal travel — a trackpad's second axis, or shift held — pans instead.
   * That is the gesture a zoomed viewport needs and the one the lanes cannot spare,
   * since a drag across them means zoom.
   */
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        return;
      }
      // Lines in Firefox, and screens on a page-sized gesture.
      const scale =
        event.deltaMode === 1 ? LINE_HEIGHT_PX : event.deltaMode === 2 ? rect.height : 1;
      const dy = event.deltaY * scale;
      const dx = event.deltaX * scale;

      const next =
        event.shiftKey || Math.abs(dx) > Math.abs(dy)
          ? // Shift is reported as a horizontal delta by some browsers and a
            // vertical one by others, so whichever axis arrived is the pan.
            panView(view, bounds, ((dx === 0 ? dy : dx) / rect.width) * domain)
          : zoomView(
              view,
              bounds,
              fromClientX(event.clientX),
              Math.exp(dy * ZOOM_PER_PIXEL)
            );

      // Only claim the gesture when it actually moves something. Zooming out at the
      // full extent, or in at the floor, changes nothing — and swallowing the
      // scroll there would leave the page unable to scroll past this chart, which
      // is the failure mode every scroll-to-zoom surface is remembered for.
      const settled = next ?? bounds;
      if (settled.start === view.start && settled.end === view.end) {
        return;
      }
      event.preventDefault();
      setView(next, true);
      // The zoom is centred on the pointer, so the guide belongs there to say so —
      // read from the old scale, which by that same anchoring is the new one.
      setHoverAt(fromClientX(event.clientX));
    },
    [bounds, domain, fromClientX, setView, view]
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
      const config = LANES[laneIndex];
      if (!config || clientY < rect.top + laneTop || !enabled.has(config.key)) {
        return null;
      }

      const at = fromClientX(clientX);
      const toleranceMs = (HIT_TOLERANCE_PX / rect.width) * domain;

      let covering: SessionEvent | undefined;
      let coveringDuration = Infinity;
      let nearest: SessionEvent | undefined;
      let nearestDistance = Infinity;

      eventsByType[config.key].forEach(event => {
        const extent = extentOf(event);
        if (!extent) {
          return;
        }
        if (at >= extent.start - toleranceMs && at <= extent.end + toleranceMs) {
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
        }
      });

      const found =
        covering ?? (nearestDistance <= toleranceMs ? nearest : undefined) ?? undefined;
      if (!found) {
        return null;
      }
      const key = itemKey(found);
      return key === undefined ? null : {event: found, key, laneIndex};
    },
    [enabled, eventsByType, fromClientX, domain, laneTop]
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

  /** Where the open item sits, so its lane can mark it. */
  const selected = useMemo((): LaneHit | null => {
    if (selectedKey === null) {
      return null;
    }
    for (const [laneIndex, config] of LANES.entries()) {
      const event = eventsByType[config.key].find(
        candidate => itemKey(candidate) === selectedKey
      );
      if (event) {
        return {event, key: selectedKey, laneIndex};
      }
    }
    return null;
  }, [selectedKey, eventsByType]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    anchor.current = {clientX: event.clientX, timestamp: fromClientX(event.clientX)};
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    setHoverAt(fromClientX(event.clientX));

    const start = anchor.current;
    if (!start || Math.abs(event.clientX - start.clientX) < MIN_DRAG_PX) {
      setHover(hitAt(event.clientX, event.clientY));
      setHoverRoute(routeAt(event.clientX, event.clientY));
      return;
    }
    // Mid-drag the pointer is aiming at a range, not at an item or a route.
    setHover(null);
    setHoverRoute(null);
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
    const visit = routeAt(event.clientX, event.clientY);
    if (visit) {
      setView(clampWindow({start: visit.start, end: visit.end}, bounds), false);
      return;
    }

    const hit = hitAt(event.clientX, event.clientY);
    if (hit) {
      onSelectItem(hit.key);
    }
  };

  /**
   * The keyboard's half of the same two gestures: the arrows pan and zoom, on the
   * viewport's centre since there is no pointer to anchor on. Built on the helpers
   * the wheel uses, so they inherit the minimum span and the slide-back-inside-the
   * -session behaviour rather than reimplementing them a step out of date.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = domain / 8;
    const centre = view.start + domain / 2;

    switch (event.key) {
      case 'ArrowRight':
        setView(panView(view, bounds, step), false);
        break;
      case 'ArrowLeft':
        setView(panView(view, bounds, -step), false);
        break;
      case 'ArrowUp':
        setView(zoomView(view, bounds, centre, 0.75), false);
        break;
      case 'ArrowDown':
        setView(zoomView(view, bounds, centre, 4 / 3), false);
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
      <Chart hasRoutes={hasRoutes}>
        <OverviewLabel>
          <Text size="xs" variant="muted" uppercase>
            {t('Session')}
          </Text>
        </OverviewLabel>
        <Overview
          bounds={bounds}
          view={view}
          events={overviewEvents}
          buckets={buckets}
          onChangeView={commitView}
        />

        <HeaderCell>
          <Text size="xs" variant="muted" uppercase>
            {t('Time')}
          </Text>
        </HeaderCell>

        <Axis>
          {ticks.map(ratio => (
            <Tick
              key={ratio}
              style={{
                left: `${ratio * 100}%`,
                // The end labels tuck inside the track instead of hanging off it.
                transform: `translate(${ratio === 0 ? '0%' : ratio === 1 ? '-100%' : '-50%'}, -50%)`,
              }}
            >
              {/*
                Offsets from the session's start, not from the viewport's. A zoomed
                axis labelled 0 would be a different clock than the rail's, and the
                whole point of the ticks once zoomed is saying *where* you are.
              */}
              <Text size="xs" variant="muted" tabular>
                {formatOffset(view.start - bounds.start + domain * ratio)}
              </Text>
            </Tick>
          ))}
        </Axis>

        {hasRoutes && (
          <Fragment>
            <RouteLabel>
              <LaneIcon>
                <IconWindow size="sm" />
              </LaneIcon>
              <Text size="sm">{t('Route')}</Text>
              {/*
                A footnote on the band, in the same place and the same shape the
                lane counts use for theirs. An error and a cap are both "this band
                is not the whole journey", and which one it is belongs in the
                tooltip rather than in two different markers.
              */}
              {(routes.isError || routes.isTruncated) && (
                <Fragment>
                  <Flex flex="1" />
                  <InfoText
                    size="xs"
                    variant="warning"
                    title={
                      routes.isError
                        ? t('Routes failed to load, so this band is missing.')
                        : tct(
                            'Only the first [limit] route changes are plotted, so this band is partial.',
                            {limit: routeVisits.length}
                          )
                    }
                  >
                    {'*'}
                  </InfoText>
                </Fragment>
              )}
            </RouteLabel>
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
          The route's reach into the lanes, and the reason it reads as overarching
          rather than as a fifth lane.

          Neutral rather than route-coloured, on purpose. These sit directly behind
          the markers — a magenta wash under an error dot would tint how bad the
          error looks, and the band above is already where a route's identity is
          said. What a wash means here is only "the same side of a boundary as its
          neighbours", which is why alternating is enough and the parity of a
          particular visit carries nothing.
        */}
        {hasRoutes && (
          <BandWash
            visits={routeVisits}
            toPercent={toPercent}
            routeColor={routeColor}
            firstLaneRow={firstLaneRow}
          />
        )}

        {LANES.map((config, index) => {
          const isOn = enabled.has(config.key);
          const color = theme.tokens.graphics[config.graphicsVariant].vibrant;
          const row = index + firstLaneRow;
          const isLast = index === LANES.length - 1;
          return (
            <Fragment key={config.key}>
              <LaneToggle
                type="button"
                aria-pressed={isOn}
                onClick={() => onToggleType(config.key)}
                data-last={isLast}
                style={{gridRow: String(row)}}
              >
                {/*
                  A glyph per lane, so a lane is identified before its label is
                  read — and the same glyph the rail marks this type's rows with,
                  which is what ties a row back to the lane it came from.
                */}
                <LaneIcon style={{color, opacity: isOn ? 1 : 0.4}}>
                  <TelemetryTypeIcon type={config.key} size="sm" />
                </LaneIcon>
                <Text size="sm" variant={isOn ? 'primary' : 'muted'}>
                  {config.label}
                </Text>
                {/*
                  The count belongs beside the shape it summarizes rather than in a
                  row of tiles of its own: "12 traces" and where those 12 fell in
                  the session are one thought, and the label column already carries
                  this type's color and its toggle.
                */}
                <Flex flex="1" />
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
              <Lane
                color={color}
                events={eventsByType[config.key]}
                buckets={buckets}
                domain={domain}
                start={view.start}
                isOn={isOn}
                row={row}
                isLast={isLast}
              />
            </Fragment>
          );
        })}

        <Track
          ref={trackRef}
          tabIndex={0}
          role="group"
          aria-label={t('Session time window')}
          data-hit={hover || hoverRoute ? true : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setHoverAt(null);
            setHover(null);
            setHoverRoute(null);
          }}
          onKeyDown={handleKeyDown}
        >
          {/*
            The drag in progress, and only that. A committed range *is* the domain
            the lanes are drawn against, so there is no longer an outside to veil —
            where the viewport sits within the session is the strip's job.
          */}
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
              toPercent={toPercent}
              laneTop={laneTop}
              isSelected
            />
          )}
          {hover && hover.key !== selected?.key && (
            <Highlight hit={hover} toPercent={toPercent} laneTop={laneTop} />
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
                'Showing %s to %s. Scroll to zoom, or drag the highlighted range above to move it.',
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
  return `${visit.route} · ${formatDurationMs(visit.end - visit.start)} · ${formatOffset(
    visit.start - sessionStart
  )} ${arrival}`;
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
  return useMemo(() => {
    if (!active) {
      return counts;
    }
    return Object.fromEntries(
      LANE_ORDER.map(key => [
        key,
        eventsByType[key].filter(event => {
          const extent = extentOf(event);
          return (
            extent !== undefined &&
            extent.start <= active.end &&
            extent.end >= active.start
          );
        }).length,
      ])
    ) as Record<SessionDatasetKey, number>;
  }, [counts, eventsByType, active]);
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
  focus: number,
  factor: number
): SessionRange | null {
  const span = view.end - view.start;
  const next = Math.max(MIN_VIEW_MS, Math.min(bounds.end - bounds.start, span * factor));
  const ratio = span === 0 ? 0.5 : (focus - view.start) / span;
  let start = focus - next * ratio;
  if (start + next > bounds.end) {
    start = bounds.end - next;
  }
  if (start < bounds.start) {
    start = bounds.start;
  }
  return clampWindow({start, end: start + next}, bounds);
}

/** Slides the viewport without resizing it. */
function panView(
  view: SessionRange,
  bounds: SessionRange,
  byMs: number
): SessionRange | null {
  const span = view.end - view.start;
  const start = Math.max(bounds.start, Math.min(view.start + byMs, bounds.end - span));
  return clampWindow({start, end: start + span}, bounds);
}

/**
 * One item, called out in its lane. An instant gets a ring at its timestamp; an
 * item that occupies time gets an outline around the whole of it, so what is
 * highlighted is the same shape as what was clicked.
 */
function Highlight({
  hit,
  toPercent,
  laneTop,
  isSelected,
}: {
  hit: LaneHit;
  /** Where the first lane starts, which the route band moves down when present. */
  laneTop: number;
  toPercent: (timestamp: number) => number;
  isSelected?: boolean;
}) {
  const extent = extentOf(hit.event);
  if (!extent) {
    return null;
  }

  const top = laneTop + hit.laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2;

  if (hit.event.duration === undefined) {
    return (
      <Ring
        aria-hidden
        data-selected={isSelected}
        style={{left: `${toPercent(extent.start)}%`, top}}
      />
    );
  }

  const left = toPercent(extent.start);
  return (
    <BarOutline
      aria-hidden
      data-selected={isSelected}
      style={{
        left: `${left}%`,
        width: `max(${BAR_MIN_PX + 4}px, ${toPercent(extent.end) - left}%)`,
        top: top - (BAR_HEIGHT + 4) / 2,
        height: BAR_HEIGHT + 4,
      }}
    />
  );
}

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
 * The route's reach into the lanes, and the reason the band reads as overarching
 * rather than as a fifth lane.
 *
 * Neutral rather than route-coloured, on purpose. These sit directly behind the
 * markers — a magenta wash under an error dot would tint how bad the error looks,
 * and the band above is already where a route's identity is said. What a wash
 * means here is only "the same side of a boundary as its neighbours", which is why
 * alternating is enough and the parity of a particular visit carries nothing.
 *
 * Memoized for the same reason as {@link RouteBand}: nothing here reads the
 * pointer, so nothing here should be rebuilt by it.
 */
const BandWash = memo(function BandWashImpl({
  visits,
  toPercent,
  routeColor,
  firstLaneRow,
}: {
  firstLaneRow: number;
  routeColor: (visit: RouteVisit) => string;
  toPercent: (timestamp: number) => number;
  visits: RouteVisit[];
}) {
  return (
    <Bands aria-hidden style={{gridRow: `${firstLaneRow} / -1`}}>
      {visits.map((visit, index) => {
        const from = toPercent(visit.start);
        const to = toPercent(visit.end);
        if (to <= 0 || from >= 100) {
          return null;
        }
        const left = Math.max(0, from);
        return (
          <Fragment key={`${visit.route}-${visit.start}`}>
            {index % 2 === 1 && (
              <BandTint
                style={{left: `${left}%`, width: `${Math.min(100, to) - left}%`}}
              />
            )}
            {/* Only where the change is actually in view — a rule pinned to the
                viewport's edge would invent a boundary there. */}
            {index > 0 && from >= 0 && (
              <BandEdge
                style={{
                  left: `${from}%`,
                  borderLeftColor: `color-mix(in srgb, ${routeColor(visit)} 70%, transparent)`,
                }}
              />
            )}
          </Fragment>
        );
      })}
    </Bands>
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
  onChangeView,
}: {
  bounds: SessionRange;
  buckets: number;
  events: SessionEvent[];
  onChangeView: (next: SessionRange | null) => void;
  view: SessionRange;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<SessionRange | null>(null);
  /**
   * The gesture in progress: where it started, and the range it started from — so a
   * move is measured from the pointer's total travel rather than accumulated a
   * fraction at a time, which drifts.
   */
  const anchor = useRef<{clientX: number; from: SessionRange; isMove: boolean} | null>(
    null
  );

  const domain = bounds.end - bounds.start;
  /**
   * With the whole session in view the frame *is* the strip, so there is nothing to
   * carry anywhere and every drag is a fresh selection. Grabbing only becomes a
   * gesture once there is something to grab.
   */
  const isZoomed = view.start > bounds.start || view.end < bounds.end;

  const fromClientX = useCallback(
    (clientX: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        return bounds.start;
      }
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return bounds.start + ratio * domain;
    },
    [bounds.start, domain]
  );

  const toPercent = useCallback(
    (timestamp: number) => ((timestamp - bounds.start) / domain) * 100,
    [bounds.start, domain]
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
        Math.max(0, Math.floor(((event.timestamp - bounds.start) / domain) * buckets))
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
  }, [events, buckets, bounds.start, domain]);

  /**
   * Whether a press landed on the framed range, in pixels rather than in time. A
   * deep zoom draws the frame a couple of pixels wide, which is a real thing on
   * screen and an unaimable one — so the grab reaches a little past it, the way the
   * lanes' own hit testing reaches past a very short bar.
   */
  const isOnViewport = useCallback(
    (clientX: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || !isZoomed) {
        return false;
      }
      const from = rect.left + (toPercent(view.start) / 100) * rect.width;
      const to = rect.left + (toPercent(view.end) / 100) * rect.width;
      return clientX >= from - GRAB_TOLERANCE_PX && clientX <= to + GRAB_TOLERANCE_PX;
    },
    [isZoomed, toPercent, view.end, view.start]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    anchor.current = {
      clientX: event.clientX,
      from: view,
      isMove: isOnViewport(event.clientX),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = anchor.current;
    if (start === null || Math.abs(event.clientX - start.clientX) < MIN_DRAG_PX) {
      return;
    }
    if (start.isMove) {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        return;
      }
      // Measured raw rather than through `fromClientX`, which clamps to the strip:
      // two clamped ends would quietly shorten every drag that overshoots an edge,
      // and the range itself is already held inside the session by `panView`.
      const by = ((event.clientX - start.clientX) / rect.width) * domain;
      setDraft(panView(start.from, bounds, by) ?? bounds);
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

    if (draft) {
      onChangeView(clampWindow(draft, bounds));
      setDraft(null);
      return;
    }

    // A press on the frame that went nowhere leaves it where it is: the gesture it
    // began was a carry, and a carry of zero distance has no destination.
    if (start.isMove) {
      return;
    }

    // Elsewhere it jumps the range there, span intact — the same move as the drag,
    // for when the distance is far enough that dragging it is a chore.
    const span = view.end - view.start;
    onChangeView(
      panView(view, bounds, fromClientX(event.clientX) - (view.start + span / 2))
    );
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
              'Drag the highlighted range to move it, or drag elsewhere to pick a new one'
            )
          : t('Drag to pick a range')
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <OverviewTicks ticks={ticks} buckets={buckets} />
      <OverviewShade style={{left: 0, width: `${left}%`}} />
      <OverviewShade style={{left: `${right}%`, right: 0}} />
      <OverviewViewport
        data-grabbable={isZoomed || undefined}
        style={{left: `${left}%`, width: `${right - left}%`}}
      />
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
const Lane = memo(function LaneImpl({
  color,
  events,
  buckets,
  domain,
  start,
  isOn,
  row,
  isLast,
}: {
  buckets: number;
  color: string;
  domain: number;
  events: SessionEvent[];
  isLast: boolean;
  isOn: boolean;
  row: number;
  start: number;
}) {
  const hasDurations = useMemo(
    () => events.some(event => event.duration !== undefined),
    [events]
  );

  return (
    <LaneTrack
      aria-hidden
      data-last={isLast}
      // The lane's colour is carried as a variable rather than set on each shape:
      // it is the same for every marker in the lane and never changes while one is
      // being drawn, so writing it per element was one inline style property per
      // marker per zoom notch for a value that had not moved.
      style={
        {
          gridRow: String(row),
          opacity: isOn ? 1 : 0.3,
          '--scrubber-lane-color': color,
        } as CSSProperties
      }
    >
      {hasDurations ? (
        <DurationMarkers events={events} domain={domain} start={start} />
      ) : (
        <DensityMarkers events={events} buckets={buckets} domain={domain} start={start} />
      )}
    </LaneTrack>
  );
});

/**
 * A bar per item, across the time it occupied. Overlapping bars are drawn over
 * each other at partial opacity rather than stacked into rows: the lane is one
 * band of time, and where two traces overlap the darker patch says so.
 */
function DurationMarkers({
  events,
  domain,
  start,
}: {
  domain: number;
  events: SessionEvent[];
  start: number;
}) {
  const bars = useMemo(
    () =>
      events
        .map((event, index) => {
          if (event.timestamp === undefined) {
            return null;
          }
          // Clipped by the track either way, but a zoomed lane would otherwise keep
          // every off-screen bar in the DOM.
          if (
            event.timestamp + (event.duration ?? 0) < start ||
            event.timestamp > start + domain
          ) {
            return null;
          }
          const left = ((event.timestamp - start) / domain) * 100;
          const width = ((event.duration ?? 0) / domain) * 100;
          return {index, left, width};
        })
        .filter(bar => bar !== null),
    [events, domain, start]
  );

  return (
    <Fragment>
      {bars.map(bar => (
        <Bar
          key={bar.index}
          style={{
            left: `${bar.left}%`,
            width: `max(${BAR_MIN_PX}px, ${bar.width}%)`,
          }}
        />
      ))}
    </Fragment>
  );
}

/**
 * Bucketed markers for the instants. Positioned by percentage rather than laid out
 * per bucket, so an empty stretch costs no DOM and the lane is correct before its
 * width has been measured.
 *
 * They are centred on the lane rather than grown from its floor: a swimlane is
 * read for *when* something happened, and a row of bottom-anchored bars reads as
 * a histogram, which invites comparing heights across lanes that share no scale.
 *
 * Each lane is scaled to its own busiest bucket. A once-a-minute metric heartbeat
 * and a burst of two hundred logs have nothing useful to say on one scale.
 */
function DensityMarkers({
  events,
  buckets,
  domain,
  start,
}: {
  buckets: number;
  domain: number;
  events: SessionEvent[];
  start: number;
}) {
  const markers = useMemo(() => {
    const counts = Array.from<number>({length: buckets}).fill(0);
    const end = start + domain;
    events.forEach(event => {
      // Dropped rather than clamped. The index clamp below is there for the item
      // landing exactly on `end`; letting it absorb everything *outside* the
      // viewport as well would pile the session's other half into the first bucket
      // and invent a burst at each edge of every zoom.
      if (
        event.timestamp === undefined ||
        event.timestamp < start ||
        event.timestamp > end
      ) {
        return;
      }
      const index = Math.min(
        buckets - 1,
        Math.max(0, Math.floor(((event.timestamp - start) / domain) * buckets))
      );
      counts[index]! += 1;
    });

    const max = Math.max(...counts, 1);
    return counts
      .map((count, index) => ({count, index}))
      .filter(bucket => bucket.count > 0)
      .map(({count, index}) => ({
        index,
        // A single item is a dot, whatever the lane's busiest bucket holds — the
        // height is spent on how much *more* than one happened here. Rooted
        // rather than linear so two stays visible beside fifty.
        height:
          max === 1
            ? MARKER_MIN
            : MARKER_MIN +
              Math.pow((count - 1) / (max - 1), 0.55) * (MARKER_MAX - MARKER_MIN),
      }));
  }, [events, buckets, domain, start]);

  const bucketWidth = 100 / buckets;

  return (
    <Fragment>
      {markers.map(marker => (
        <Marker
          key={marker.index}
          style={{
            // Centred on its bucket, so a lone marker sits where the item is
            // rather than at the left edge of the slice it fell into.
            left: `${(marker.index + 0.5) * bucketWidth}%`,
            width: `max(${MARKER_MIN}px, ${bucketWidth}%)`,
            height: `${marker.height}px`,
          }}
        />
      ))}
    </Fragment>
  );
}

/**
 * The frame. Column gaps would break the row rules, so the two columns are
 * divided by a border and padded from the inside instead.
 */
const Chart = styled('div')<{hasRoutes: boolean}>`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  grid-template-rows:
    ${OVERVIEW_HEIGHT}px ${HEADER_HEIGHT}px
    ${p => (p.hasRoutes ? `${ROUTE_HEIGHT}px ` : '')} ${LANE_ROWS};
  /*
   * Bottom edge only. The chart used to be a bordered, rounded card floating
   * inside the panel, which drew a second frame a few pixels in from the frame
   * the panel already has. It now runs to the panel's edges and keeps just the
   * rule that closes the last lane and separates it from the zoom note.
   */
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  overflow: hidden;
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
 * The route's reach into the lanes. Spans every lane row as one element and paints
 * before them in DOM order, so the lane markers — which sit on transparent tracks
 * — draw on top without needing a stacking context of their own.
 */
const Bands = styled('div')`
  grid-column: 2;
  position: relative;
  overflow: hidden;
  pointer-events: none;
  /* Read by the tints and edges below, so those stay static. */
  --scrubber-band-tint: color-mix(
    in srgb,
    ${p => p.theme.tokens.background.transparent.neutral.muted} 35%,
    transparent
  );
  --scrubber-band-edge: ${p => p.theme.tokens.border.neutral.muted};
`;

/**
 * A hint, not a highlight. `neutral.muted` is built to lightly emphasize a block
 * of content; here it is only marking which side of a boundary something is on,
 * and the markers it sits behind are what the eye is meant to land on. Cut to a
 * fraction of the token rather than swapped for a literal, so it still tracks the
 * theme.
 */
const BandTint = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--scrubber-band-tint);
`;

/**
 * Where the route changed, run down every lane. The one channel that has to stay
 * legible: it was `border.primary` — `opaque200`, the faintest token there is —
 * which over 160px of lanes was invisible, and two stays on the *same* route have
 * nothing else to tell them apart. Their fill matches, their colour matches, their
 * label matches; without this line a navigation back to where you already were
 * draws as one unbroken segment.
 *
 * Coloured by the route being entered, and a rule rather than a wash. That is what
 * lets it be crisp without becoming the tint again — a hairline says "here",
 * where a fill would say "this whole region is special".
 */
const BandEdge = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--scrubber-band-edge);
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
  pointer-events: none;

  /*
   * The frame is also the handle, so it takes the pointer — but only once there is
   * something to carry. Unzoomed it spans the whole strip, and a grab cursor over
   * all of it would promise a gesture that does nothing.
   *
   * The events still reach the strip underneath by bubbling; this is here for the
   * cursor, which is the only way the gesture announces itself. Hover-and-active
   * rather than a piece of state: it survives the pointer leaving the frame
   * mid-carry, which is exactly when the frame is moving out from under it.
   */
  &[data-grabbable] {
    pointer-events: auto;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
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
  padding: 0 ${p => p.theme.space.xs};
`;

const LaneToggle = styled('button')`
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  width: 100%;
  background: none;
  border: 0;
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding: 0 ${p => p.theme.space.lg};
  margin: 0;
  cursor: pointer;
  text-align: left;

  &[data-last='true'] {
    border-bottom: 0;
  }

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
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
const LaneTrack = styled('div')`
  grid-column: 2;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  /* Read by every {@link Marker} and {@link Bar} inside, so those stay static. */
  --scrubber-marker-radius: ${p => p.theme.radius.full};
  --scrubber-bar-radius: ${p => p.theme.radius.xs};

  &[data-last='true'] {
    border-bottom: 0;
  }
`;

// The shapes below read their values from custom properties the lane sets rather
// than interpolating the theme themselves, and it is worth saying why: a styled
// component holding a `${p => p.theme…}` has to be re-serialized and re-hashed per
// instance on every render, and a lane draws these by the hundred. Reading a
// variable instead makes each one a static rule that emotion serializes once for
// the whole page, while the value still tracks the theme. The same reasoning moves
// the lane's colour and the bar's fixed height off the inline `style`: neither
// changes while a lane is being drawn, so writing them per element per zoom notch
// was work for a value that had not moved.
const Marker = styled('div')`
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: var(--scrubber-marker-radius);
  background: var(--scrubber-lane-color);
`;

/**
 * Not centred on its position the way a density marker is — a bar starts where its
 * item started, and grows to the right.
 */
const Bar = styled('div')`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border-radius: var(--scrubber-bar-radius);
  /* Fixed, unlike a density marker's: see {@link BAR_HEIGHT}. */
  height: ${BAR_HEIGHT}px;
  background: var(--scrubber-lane-color);
  opacity: 0.75;
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
