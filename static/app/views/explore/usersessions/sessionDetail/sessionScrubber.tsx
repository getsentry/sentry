import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconFire, IconGraph, IconList, IconSpan} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useDimensions} from 'sentry/utils/useDimensions';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import {formatOffset} from './sessionTime';
import type {SessionRange} from './useSessionDetail';

/**
 * Lanes run most-severe first rather than in dataset order: an error lane at the
 * top is the first thing scanned, and it is most often what explains the session.
 */
const LANE_ORDER: SessionDatasetKey[] = ['errors', 'spans', 'logs', 'metrics'];

const LANES = LANE_ORDER.map(key => SESSION_DATASETS.find(config => config.key === key)!);

/**
 * A glyph per type, so a lane is identified before its label is read. The rail
 * below is scanned by color; up here color alone has to survive four lanes of it,
 * and a shape does that better than a swatch.
 */
const LANE_ICONS: Record<SessionDatasetKey, React.ReactNode> = {
  errors: <IconFire size="sm" />,
  spans: <IconSpan size="sm" />,
  logs: <IconList size="sm" />,
  metrics: <IconGraph type="line" size="sm" />,
};

const HEADER_HEIGHT = 28;
const LANE_HEIGHT = 40;

/**
 * Marker extremes. The floor is a dot rather than a sliver: a lone error and a
 * burst of forty are both worth seeing, and a one-pixel tick is not seen.
 */
const MARKER_MIN = 8;
const MARKER_MAX = 26;

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

interface Props {
  bounds: SessionRange;
  onChangeWindow: (window: SessionRange | null) => void;
  onToggleType: (key: SessionDatasetKey) => void;
  /** Telemetry types currently shown. A type that is off dims its lane. */
  selectedTypes: SessionDatasetKey[];
  timestampsByType: Record<SessionDatasetKey, number[]>;
  truncatedByType: Record<SessionDatasetKey, boolean>;
  window: SessionRange | null;
}

/**
 * The session at a glance: one lane per telemetry type across the session's full
 * extent, with a draggable window that narrows the rail below.
 *
 * The lanes answer "where in this session did anything happen" before a single
 * row has been read, which is the one question a flat list cannot answer. Time
 * runs horizontally only here, where the axis carries no text — the rail keeps
 * reading vertically, because that is where the payload is.
 */
export function SessionScrubber({
  bounds,
  timestampsByType,
  truncatedByType,
  selectedTypes,
  onToggleType,
  window,
  onChangeWindow,
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
  const anchor = useRef<{clientX: number; timestamp: number} | null>(null);

  const active = draft ?? window;
  const domain = bounds.end - bounds.start;
  const enabled = useMemo(() => new Set(selectedTypes), [selectedTypes]);

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
      return;
    }
    const at = fromClientX(event.clientX);
    setDraft({
      start: Math.min(start.timestamp, at),
      end: Math.max(start.timestamp, at),
    });
  };

  const handlePointerUp = () => {
    if (anchor.current === null) {
      return;
    }
    anchor.current = null;
    // A press with no drag hands up `null`, which is how a click resets the view.
    onChangeWindow(draft);
    setDraft(null);
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
                <LaneIcon style={{color, opacity: isOn ? 1 : 0.4}}>
                  {LANE_ICONS[config.key]}
                </LaneIcon>
                <Text size="sm" variant={isOn ? 'primary' : 'muted'}>
                  {config.label}
                </Text>
                {truncatedByType[config.key] && (
                  <InfoText
                    size="xs"
                    variant="warning"
                    title={tct(
                      'Only the [limit] most recent items are plotted, so this lane is partial.',
                      {limit: config.maxRows}
                    )}
                  >
                    {'*'}
                  </InfoText>
                )}
              </LaneToggle>
              <Lane
                color={color}
                timestamps={timestampsByType[config.key]}
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => setHoverAt(null)}
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
          {hoverAt !== null && (
            <Guide style={{left: `${toPercent(hoverAt)}%`}}>
              <GuideLabel>{formatOffset(hoverAt - bounds.start)}</GuideLabel>
            </Guide>
          )}
        </Track>
      </Chart>

      <Flex align="center" gap="md" wrap="wrap">
        <Text size="xs" variant="muted">
          {active
            ? t(
                'Window: %s to %s. Click the lanes to reset.',
                formatOffset(active.start - bounds.start),
                formatOffset(active.end - bounds.start)
              )
            : t('Drag across the lanes to narrow the timeline. Click a type to hide it.')}
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
 * One type's density over the session. Markers are positioned by percentage
 * rather than laid out per bucket, so an empty stretch costs no DOM and the lane
 * is correct before its width has been measured.
 *
 * They are centred on the lane rather than grown from its floor: a swimlane is
 * read for *when* something happened, and a row of bottom-anchored bars reads as
 * a histogram, which invites comparing heights across lanes that share no scale.
 *
 * Each lane is scaled to its own busiest bucket. A once-a-minute metric heartbeat
 * and a burst of two hundred spans have nothing useful to say on one scale.
 */
function Lane({
  color,
  timestamps,
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
  isLast: boolean;
  isOn: boolean;
  row: number;
  start: number;
  timestamps: number[];
}) {
  const markers = useMemo(() => {
    const counts = Array.from<number>({length: buckets}).fill(0);
    timestamps.forEach(timestamp => {
      const index = Math.min(
        buckets - 1,
        Math.max(0, Math.floor(((timestamp - start) / domain) * buckets))
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
  }, [timestamps, buckets, domain, start]);

  const bucketWidth = 100 / buckets;

  return (
    <LaneTrack
      aria-hidden
      data-last={isLast}
      style={{gridRow: String(row), opacity: isOn ? 1 : 0.3}}
    >
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
    </LaneTrack>
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

const LaneTrack = styled('div')`
  grid-column: 2;
  position: relative;
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
  padding: 0 ${p => p.theme.space['2xs']};
  border-radius: ${p => p.theme.radius.xs};
  background: ${p => p.theme.tokens.background.tertiary};
  color: ${p => p.theme.tokens.content.primary};
`;
