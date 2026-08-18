import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useDimensions} from 'sentry/utils/useDimensions';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import {itemKey} from './itemKey';
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

/** A drag shorter than this is a click, which resets the selection. */
const MIN_DRAG_PX = 4;

/**
 * How far outside an item a click still counts as hitting it. Sized to the
 * smallest shape rather than to the pointer: a density marker is drawn at the
 * centre of the bucket it fell into, so it can sit a few pixels off the timestamp
 * it stands for, and a very short bar is smaller than a comfortable target.
 */
const HIT_TOLERANCE_PX = 8;

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
  /** The item whose details are open, marked in its lane. */
  selectedKey: string | null;
  /** Telemetry types currently shown. A type that is off dims its lane. */
  selectedTypes: SessionDatasetKey[];
  truncatedByType: Record<SessionDatasetKey, boolean>;
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
 * The session at a glance: one lane per telemetry type across the session's full
 * extent, with a draggable window that narrows the rail below.
 *
 * The lanes answer "where in this session did anything happen" before a single
 * row has been read, which is the one question a flat list cannot answer. Time
 * runs horizontally only here, where the axis carries no text — the rail keeps
 * reading vertically, because that is where the payload is.
 *
 * How a lane draws depends on what its items are. Logs, metrics and errors are
 * instants, so they get density: bucketed markers whose height is how much landed
 * there. A trace occupies time, so it gets a bar across the time it occupied —
 * which turns that lane into the shape of the session's activity rather than a row
 * of dots that happen to be near each other.
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
  const [hoverAt, setHoverAt] = useState<number | null>(null);
  const [hover, setHover] = useState<LaneHit | null>(null);
  const anchor = useRef<{clientX: number; timestamp: number} | null>(null);

  const active = draft ?? window;
  const domain = bounds.end - bounds.start;
  const enabled = useMemo(() => new Set(selectedTypes), [selectedTypes]);
  const laneCounts = useLaneCounts(counts, eventsByType, active);

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
    (timestamp: number) => ((timestamp - bounds.start) / domain) * 100,
    [bounds.start, domain]
  );

  const fromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        return bounds.start;
      }
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return bounds.start + ratio * domain;
    },
    [bounds.start, domain]
  );

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

      const laneIndex = Math.floor((clientY - rect.top - HEADER_HEIGHT) / LANE_HEIGHT);
      const config = LANES[laneIndex];
      if (!config || clientY < rect.top + HEADER_HEIGHT || !enabled.has(config.key)) {
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
    [enabled, eventsByType, fromClientX, domain]
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
      return;
    }
    // Mid-drag the pointer is aiming at a range, not at an item.
    setHover(null);
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
      onChangeWindow(draft);
      setDraft(null);
      return;
    }

    // A press with no drag either opens the item under it or, on empty track,
    // resets the view — which is how a click gets out of a window.
    const hit = hitAt(event.clientX, event.clientY);
    if (hit) {
      onSelectItem(hit.key);
    } else {
      onChangeWindow(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? bounds;
    const step = (current.end - current.start) / 8;

    switch (event.key) {
      case 'ArrowRight':
        onChangeWindow(
          clampWindow({start: current.start + step, end: current.end + step}, bounds)
        );
        break;
      case 'ArrowLeft':
        onChangeWindow(
          clampWindow({start: current.start - step, end: current.end - step}, bounds)
        );
        break;
      case 'ArrowUp':
        onChangeWindow(
          clampWindow(
            {start: current.start + step / 2, end: current.end - step / 2},
            bounds
          )
        );
        break;
      case 'ArrowDown':
        onChangeWindow(
          clampWindow(
            {start: current.start - step / 2, end: current.end + step / 2},
            bounds
          )
        );
        break;
      case 'Escape':
      case 'Home':
        onChangeWindow(null);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <Stack gap="sm" padding="lg xl">
      {/*
        Every cell is placed by hand. Grid auto-placement flows *around* the
        explicitly positioned overlay below, which silently pushes the first
        lane's label onto a row of its own.
      */}
      <Chart>
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
              <Text size="xs" variant="muted" tabular>
                {formatOffset(domain * ratio)}
              </Text>
            </Tick>
          ))}
        </Axis>

        {LANES.map((config, index) => {
          const isOn = enabled.has(config.key);
          const color = theme.tokens.graphics[config.graphicsVariant].vibrant;
          // Row 1 is the axis, so the first lane starts at 2.
          const row = index + 2;
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
                        active
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
                start={bounds.start}
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
          data-hit={hover ? true : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setHoverAt(null);
            setHover(null);
          }}
          onKeyDown={handleKeyDown}
        >
          {active && (
            <Fragment>
              <Veil style={{left: 0, width: `${toPercent(active.start)}%`}} />
              <Veil style={{left: `${toPercent(active.end)}%`, right: 0}} />
              <Window
                style={{
                  left: `${toPercent(active.start)}%`,
                  width: `${toPercent(active.end) - toPercent(active.start)}%`,
                }}
              />
            </Fragment>
          )}
          {selected && <Highlight hit={selected} toPercent={toPercent} isSelected />}
          {hover && hover.key !== selected?.key && (
            <Highlight hit={hover} toPercent={toPercent} />
          )}
          {hoverAt !== null && (
            <Guide style={{left: `${toPercent(hoverAt)}%`}}>
              {/* The item's name rides along with the time, so a shape can be
                  identified before it is clicked. */}
              <GuideLabel>
                {hover
                  ? describe(hover.event, hoverAt - bounds.start)
                  : formatOffset(hoverAt - bounds.start)}
              </GuideLabel>
            </Guide>
          )}
        </Track>
      </Chart>

      <Flex align="center" gap="md" wrap="wrap">
        <Text size="xs" variant="muted">
          {active
            ? t(
                'Window: %s to %s. Click an item to open it, or empty space to reset.',
                formatOffset(active.start - bounds.start),
                formatOffset(active.end - bounds.start)
              )
            : t(
                'Click an item to open it, or drag across the lanes to narrow the timeline. Click a type to hide it.'
              )}
        </Text>
        <Flex flex="1" />
        {active && (
          <Button size="xs" onClick={() => onChangeWindow(null)}>
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
 * What each lane label reports: the session's exact totals while the whole
 * session is in view, and the items inside the window once one is selected.
 *
 * A count that ignored the window would contradict the lane beside it — the veil
 * makes it plain that most of those items are no longer in view. Counting the
 * plotted items is the only way to scope it, which costs the exactness the
 * aggregates have: a lane capped at `maxRows` undercounts here, and says so
 * through the marker already beside its count. For traces it also changes what is
 * being counted, from distinct traces to the segment spans standing for them.
 *
 * An item that occupies time counts when it *overlaps* the window rather than
 * when it starts inside it — a trace running through the selection is in it.
 *
 * Runs against the draft as well as the committed window, so the numbers move
 * with the drag rather than snapping on release.
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
 * One item, called out in its lane. An instant gets a ring at its timestamp; an
 * item that occupies time gets an outline around the whole of it, so what is
 * highlighted is the same shape as what was clicked.
 */
function Highlight({
  hit,
  toPercent,
  isSelected,
}: {
  hit: LaneHit;
  toPercent: (timestamp: number) => number;
  isSelected?: boolean;
}) {
  const extent = extentOf(hit.event);
  if (!extent) {
    return null;
  }

  const top = HEADER_HEIGHT + hit.laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2;

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
 * One type's presence over the session, drawn in whichever of the two ways suits
 * what it holds.
 *
 * Which one is decided by the data rather than by the lane's name: anything
 * reporting a duration is drawn across it. Bars are one element per item because
 * that is the point of them — a bucketed bar would say nothing a dot doesn't —
 * while the density path stays aggregated so an empty stretch costs no DOM.
 */
function Lane({
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
      style={{gridRow: String(row), opacity: isOn ? 1 : 0.3}}
    >
      {hasDurations ? (
        <DurationMarkers events={events} domain={domain} start={start} color={color} />
      ) : (
        <DensityMarkers
          events={events}
          buckets={buckets}
          domain={domain}
          start={start}
          color={color}
        />
      )}
    </LaneTrack>
  );
}

/**
 * A bar per item, across the time it occupied. Overlapping bars are drawn over
 * each other at partial opacity rather than stacked into rows: the lane is one
 * band of time, and where two traces overlap the darker patch says so.
 */
function DurationMarkers({
  events,
  domain,
  start,
  color,
}: {
  color: string;
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
            height: `${BAR_HEIGHT}px`,
            background: color,
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
  color,
}: {
  buckets: number;
  color: string;
  domain: number;
  events: SessionEvent[];
  start: number;
}) {
  const markers = useMemo(() => {
    const counts = Array.from<number>({length: buckets}).fill(0);
    events.forEach(event => {
      if (event.timestamp === undefined) {
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
            background: color,
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
const Chart = styled('div')`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  grid-template-rows: ${HEADER_HEIGHT}px repeat(${LANES.length}, ${LANE_HEIGHT}px);
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

const HeaderCell = styled('div')`
  grid-column: 1;
  grid-row: 1;
  display: flex;
  align-items: center;
  padding: 0 ${p => p.theme.space.lg};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const Axis = styled('div')`
  grid-column: 2;
  grid-row: 1;
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

  &[data-last='true'] {
    border-bottom: 0;
  }
`;

const Marker = styled('div')`
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: ${p => p.theme.radius.full};
`;

/**
 * Not centred on its position the way a density marker is — a bar starts where its
 * item started, and grows to the right.
 */
const Bar = styled('div')`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border-radius: ${p => p.theme.radius.xs};
  opacity: 0.75;
`;

/**
 * The interactive surface, laid over the axis and every lane as one element so a
 * drag selects a time range rather than a range within one type.
 */
const Track = styled('div')`
  grid-column: 2;
  grid-row: 1 / -1;
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

const Window = styled('div')`
  position: absolute;
  top: ${HEADER_HEIGHT}px;
  bottom: 0;
  border-left: 1.5px solid ${p => p.theme.tokens.border.accent.vibrant};
  border-right: 1.5px solid ${p => p.theme.tokens.border.accent.vibrant};
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
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
