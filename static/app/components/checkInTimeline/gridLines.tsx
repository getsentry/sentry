import {useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import moment from 'moment-timezone';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {DateTime} from 'sentry/components/dateTime';
import {space} from 'sentry/styles/space';
import useRouter from 'sentry/utils/useRouter';

import {useTimelineCursor, type CursorOffsets} from './timelineCursor';
import {useTimelineZoom} from './timelineZoom';
import type {TimeWindowConfig} from './types';

/**
 * The number of pixels the underscan must be larger than to render the first
 * grid marker line. When the underscan is very small we don't want to render
 * the first marker line since it will be very close to the left side and can
 * look strange.
 */
const UNDERSCAN_MARKER_LINE_THRESHOLD = 10;

type LabelPosition = 'left-top' | 'center-bottom';

interface TimeMarker {
  date: Date;
  /**
   * Props to pass to the DateTime component
   */
  dateTimeProps: TimeWindowConfig['dateTimeProps'];
  /**
   * The position in pixels of the tick
   */
  position: number;
}

/**
 * Aligns the given date to the start of a unit (minute, hour, day) based on
 * the minuteInterval size. This will align to the right side of the boundary
 *
 * 01:53:43 (10m interval) => 01:54:00
 * 01:32:00 (2hr interval) => 02:00:00
 */
function alignDateToBoundary(date: moment.Moment, minuteInterval: number) {
  if (minuteInterval < 60) {
    return date.minute(date.minutes() - (date.minutes() % minuteInterval)).seconds(0);
  }

  if (minuteInterval < 60 * 24) {
    return date.startOf('hour');
  }

  return date.startOf('day');
}

function getTimeMarkersFromConfig(config: TimeWindowConfig) {
  const {
    periodStart,
    end,
    elapsedMinutes,
    intervals,
    dateTimeProps,
    timelineWidth,
    timezone,
  } = config;

  const {referenceMarkerInterval, minimumMarkerInterval, normalMarkerInterval} =
    intervals;

  // Markers start after the underscan on the left
  const startOffset = config.rollupConfig.timelineUnderscanWidth;

  const msPerPixel = (elapsedMinutes * 60 * 1000) / timelineWidth;

  // The first marker will always be the starting time. This always renders the
  // full date and time
  const markers: TimeMarker[] = [
    {
      date: periodStart,
      position: startOffset,
      dateTimeProps: {timeZone: true},
    },
  ];

  // The mark after the first mark will be aligned to a boundary to make it
  // easier to understand the rest of the marks
  const currentMark = alignDateToBoundary(
    moment.tz(periodStart, timezone),
    normalMarkerInterval
  );

  // The first label is larger since we include the date, time, and timezone.

  while (
    currentMark.isBefore(
      moment.tz(periodStart, timezone).add(referenceMarkerInterval, 'minutes')
    )
  ) {
    currentMark.add(normalMarkerInterval, 'minute');
  }

  // Generate time markers which represent location of grid lines/time labels.
  // Stop adding markers once there's no more room for more markers
  while (
    moment.tz(currentMark, timezone).add(minimumMarkerInterval, 'minutes').isBefore(end)
  ) {
    const position =
      startOffset + (currentMark.valueOf() - periodStart.valueOf()) / msPerPixel;
    markers.push({date: currentMark.toDate(), position, dateTimeProps});
    currentMark.add(normalMarkerInterval, 'minutes');
  }

  return markers;
}

interface GridLineLabelsProps {
  timeWindowConfig: TimeWindowConfig;
  className?: string;
  labelPosition?: LabelPosition;
}

export function GridLineLabels({
  timeWindowConfig,
  className,
  labelPosition = 'left-top',
}: GridLineLabelsProps) {
  const markers = getTimeMarkersFromConfig(timeWindowConfig);

  return (
    <LabelsContainer aria-hidden className={className} labelPosition={labelPosition}>
      {markers.map(({date, position, dateTimeProps}, index) => (
        <TimeLabelContainer
          key={date.getTime()}
          left={position}
          labelPosition={labelPosition}
          isFirst={index === 0}
        >
          <TimeLabel date={date} {...dateTimeProps} />
        </TimeLabelContainer>
      ))}
      {labelPosition && (
        <GridLines timeWindowConfig={timeWindowConfig} labelPosition={labelPosition} />
      )}
    </LabelsContainer>
  );
}

interface GridLinesProps {
  labelPosition: LabelPosition;
  timeWindowConfig: TimeWindowConfig;
}

function GridLines({timeWindowConfig, labelPosition}: GridLinesProps) {
  const {timelineUnderscanWidth} = timeWindowConfig.rollupConfig;

  const gridLine = getTimeMarkersFromConfig(timeWindowConfig);

  // Skip rendering of the first grid line marker when the underscan width is
  // below the threshold to be displayed
  if (timelineUnderscanWidth < UNDERSCAN_MARKER_LINE_THRESHOLD) {
    gridLine.shift();
  }

  return (
    <GridLineContainer>
      {gridLine.map(({date, position}) => (
        <Gridline key={date.getTime()} left={position} labelPosition={labelPosition} />
      ))}
    </GridLineContainer>
  );
}

interface GridLineOverlayProps {
  timeWindowConfig: TimeWindowConfig;
  /**
   * Render additional UI components inside of the grid lines overlay
   */
  additionalUi?: React.ReactNode;
  /**
   * Enable zoom selection
   */
  allowZoom?: boolean;
  className?: string;
  /**
   * Configures clamped offsets on the left and right of the cursor overlay
   * element when enabled. May be useful in scenarios where you do not want the
   * overlay to cover some additional UI elements
   */
  cursorOffsets?: CursorOffsets;
  /**
   * Whether to anchor the cursor overlay to the top or bottom of the container. Defaults to 'top'
   */
  cursorOverlayAnchor?: 'top' | 'bottom';
  /**
   * The offset of the cursor overlay. If anchor is 'top', this will be added to the top offset.
   * If anchor is 'bottom', this will be added to the bottom offset.
   */
  cursorOverlayAnchorOffset?: number;
  /**
   * Configres where the timeline labels are displayed
   */
  labelPosition?: LabelPosition;
  /**
   * Resets pagination cursor when zooming the timeline.
   */
  resetPaginationOnZoom?: boolean;
  /**
   * Enable the timeline cursor
   */
  showCursor?: boolean;
  /**
   * Enabling causes the cursor tooltip to stick to the top of the viewport.
   */
  stickyCursor?: boolean;
}

export function GridLineOverlay({
  timeWindowConfig,
  showCursor,
  additionalUi,
  stickyCursor,
  cursorOffsets,
  cursorOverlayAnchor,
  cursorOverlayAnchorOffset,
  allowZoom,
  className,
  labelPosition = 'left-top',
  resetPaginationOnZoom,
}: GridLineOverlayProps) {
  const router = useRouter();
  const {periodStart, timelineWidth, dateLabelFormat, rollupConfig, timezone} =
    timeWindowConfig;
  const {timelineUnderscanWidth} = rollupConfig;

  const msPerPixel = (timeWindowConfig.elapsedMinutes * 60 * 1000) / timelineWidth;

  // XXX: The dateFromPosition is aligned to the periodStart, which is relative
  // to the pixel value after the timelineUnderscanWidth.
  const dateFromPosition = useCallback(
    (position: number) =>
      moment.tz(
        periodStart.getTime() + msPerPixel * (position - timelineUnderscanWidth),
        timezone
      ),
    [msPerPixel, periodStart, timelineUnderscanWidth, timezone]
  );

  const makeCursorLabel = useCallback(
    (position: number) => dateFromPosition(position).format(dateLabelFormat),
    [dateFromPosition, dateLabelFormat]
  );

  const handleZoom = useCallback(
    (startX: number, endX: number) =>
      updateDateTime(
        {
          start: dateFromPosition(startX).startOf('minute').toDate(),
          end: dateFromPosition(endX).add(1, 'minute').startOf('minute').toDate(),
        },
        router,
        {keepCursor: !resetPaginationOnZoom}
      ),
    [dateFromPosition, resetPaginationOnZoom, router]
  );

  const {
    selectionContainerRef,
    timelineSelector,
    isActive: selectionIsActive,
  } = useTimelineZoom<HTMLDivElement>({enabled: !!allowZoom, onSelect: handleZoom});

  const {cursorContainerRef, timelineCursor} = useTimelineCursor<HTMLDivElement>({
    enabled: !!showCursor && !selectionIsActive,
    sticky: stickyCursor,
    offsets: cursorOffsets,
    labelText: makeCursorLabel,
    anchor: cursorOverlayAnchor,
    anchorOffset: cursorOverlayAnchorOffset,
  });

  const overlayRef = mergeRefs(cursorContainerRef, selectionContainerRef);

  return (
    <Overlay aria-hidden ref={overlayRef} className={className}>
      {timelineCursor}
      {timelineSelector}
      {additionalUi}
      <GridLines timeWindowConfig={timeWindowConfig} labelPosition={labelPosition} />
    </Overlay>
  );
}

const Overlay = styled('div')`
  height: 100%;
  width: 100%;
  position: absolute;
`;

const GridLineContainer = styled('div')`
  position: relative;
  overflow: hidden;
  height: 100%;
  pointer-events: none;
`;

const LabelsContainer = styled('div')<{labelPosition: LabelPosition}>`
  overflow: hidden;
  position: relative;
  align-self: stretch;
  ${p =>
    p.labelPosition === 'left-top' &&
    css`
      min-height: 50px;
    `}
  ${p =>
    p.labelPosition === 'center-bottom' &&
    // The pseudo element is used to create the left-most notch
    css`
      height: 24px;
      border-top: 1px solid ${p.theme.tokens.border.transparent.neutral.muted};
      top: 68px;
      &:before {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        height: ${space(0.5)};
        width: 1px;
        border-radius: 1px;
        background: ${p.theme.tokens.border.transparent.neutral.muted};
      }
    `}
`;

export const Gridline = styled('div')<{labelPosition: LabelPosition; left: number}>`
  position: absolute;
  left: ${p => p.left}px;
  ${p =>
    p.labelPosition === 'left-top' &&
    css`
      height: 100%;
      border-left: 1px solid ${p.theme.tokens.border.transparent.neutral.muted};
    `}
  ${p =>
    p.labelPosition === 'center-bottom' &&
    css`
      height: 6px;
      width: 1px;
      border-radius: 1px;
      background: ${p.theme.tokens.border.transparent.neutral.muted};
      top: 68px;
    `}
`;

const TimeLabelContainer = styled('div')<{
  labelPosition: LabelPosition;
  left: number;
  isFirst?: boolean;
}>`
  position: absolute;
  left: ${p => p.left}px;
  display: flex;
  align-items: center;
  height: 100%;
  ${p =>
    p.labelPosition === 'left-top' &&
    css`
      padding-left: ${space(1)};
    `}
  ${p =>
    p.labelPosition === 'center-bottom' &&
    css`
      padding-top: ${space(1)};
    `}
  ${p =>
    p.labelPosition === 'center-bottom' &&
    // Skip the translation for the first label
    !p.isFirst &&
    css`
      transform: translateX(-50%);
    `}
`;

const TimeLabel = styled(DateTime)`
  font-variant-numeric: tabular-nums;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  pointer-events: none;
`;
