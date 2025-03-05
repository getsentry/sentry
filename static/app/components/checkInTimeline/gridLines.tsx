import {useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import moment from 'moment-timezone';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useRouter from 'sentry/utils/useRouter';

import QuestionTooltip from '../questionTooltip';

import {type CursorOffsets, useTimelineCursor} from './timelineCursor';
import {useTimelineZoom} from './timelineZoom';
import type {TimeWindowConfig} from './types';

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
  const {start, end, elapsedMinutes, intervals, dateTimeProps, timelineWidth} = config;

  const {referenceMarkerInterval, minimumMarkerInterval, normalMarkerInterval} =
    intervals;

  const msPerPixel = (elapsedMinutes * 60 * 1000) / timelineWidth;

  // The first marker will always be the starting time. This always renders the
  // full date and time
  const markers: TimeMarker[] = [
    {
      date: start,
      position: 0,
      dateTimeProps: {timeZone: true},
    },
  ];

  // The mark after the first mark will be aligned to a boundary to make it
  // easier to understand the rest of the marks
  const currentMark = alignDateToBoundary(moment(start), normalMarkerInterval);

  // The first label is larger since we include the date, time, and timezone.

  while (currentMark.isBefore(moment(start).add(referenceMarkerInterval, 'minutes'))) {
    currentMark.add(normalMarkerInterval, 'minute');
  }

  // Generate time markers which represent location of grid lines/time labels.
  // Stop adding markers once there's no more room for more markers
  while (moment(currentMark).add(minimumMarkerInterval, 'minutes').isBefore(end)) {
    const position = (currentMark.valueOf() - start.valueOf()) / msPerPixel;
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
      {timeWindowConfig.showUnderscanHelp && (
        <TimeLabelContainer
          left={
            labelPosition === 'left-top'
              ? timeWindowConfig.timelineWidth
              : timeWindowConfig.timelineWidth - 12
          }
          labelPosition={labelPosition}
        >
          <QuestionTooltip
            size="xs"
            title={t(
              'This area of the timeline is outside of your selected time range to allow for accurate rendering of markers.'
            )}
          />
        </TimeLabelContainer>
      )}
    </LabelsContainer>
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
   * Configres where the timeline labels are displayed
   */
  labelPosition?: LabelPosition;
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
  allowZoom,
  className,
  labelPosition = 'left-top',
}: GridLineOverlayProps) {
  const router = useRouter();
  const {start, timelineWidth, dateLabelFormat, rollupConfig} = timeWindowConfig;

  const msPerPixel = (timeWindowConfig.elapsedMinutes * 60 * 1000) / timelineWidth;

  const dateFromPosition = useCallback(
    (position: number) => moment(start.getTime() + msPerPixel * position),
    [msPerPixel, start]
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
        {keepCursor: true}
      ),
    [dateFromPosition, router]
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
  });

  const overlayRef = mergeRefs(cursorContainerRef, selectionContainerRef);
  const markers = getTimeMarkersFromConfig(timeWindowConfig);

  // Skip first gridline, this will be represented as a border on the
  // LabelsContainer
  markers.shift();

  if (timeWindowConfig.showUnderscanHelp) {
    markers.push({
      date: timeWindowConfig.end,
      position: timeWindowConfig.timelineWidth,
      dateTimeProps: {},
    });
  }

  return (
    <Overlay aria-hidden ref={overlayRef} className={className}>
      {timelineCursor}
      {timelineSelector}
      {additionalUi}
      <Underscan
        labelPosition={labelPosition}
        style={{
          width: rollupConfig.timelineUnderscanWidth - 1,
        }}
      />
      <GridLineContainer>
        {markers.map(({date, position}) => (
          <Gridline key={date.getTime()} left={position} labelPosition={labelPosition} />
        ))}
      </GridLineContainer>
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
  z-index: 1;
  pointer-events: none;
`;

const LabelsContainer = styled('div')<{labelPosition: LabelPosition}>`
  overflow: hidden;
  position: relative;
  align-self: stretch;
  ${p =>
    p.labelPosition === 'left-top' &&
    css`
      height: 50px;
      box-shadow: -1px 0 0 0 ${p.theme.translucentInnerBorder};
    `}
  ${p =>
    p.labelPosition === 'center-bottom' &&
    // The pseudo element is used to create the left-most notch
    css`
      height: 24px;
      border-top: 1px solid ${p.theme.translucentBorder};
      top: 68px;
      &:before {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        height: ${space(0.5)};
        width: 1px;
        border-radius: 1px;
        background: ${p.theme.translucentBorder};
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
      border-left: 1px solid ${p.theme.translucentInnerBorder};
    `}
  ${p =>
    p.labelPosition === 'center-bottom' &&
    css`
      height: 6px;
      width: 1px;
      border-radius: 1px;
      background: ${p.theme.translucentBorder};
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
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  pointer-events: none;
`;

const Underscan = styled('div')<{labelPosition: LabelPosition}>`
  position: absolute;
  right: 0;
  background-size: 3px 3px;
  background-image: linear-gradient(
    45deg,
    ${p => p.theme.translucentBorder} 25%,
    transparent 25%,
    transparent 50%,
    ${p => p.theme.translucentBorder} 50%,
    ${p => p.theme.translucentBorder} 75%,
    transparent 75%,
    transparent
  );
  ${p =>
    p.labelPosition === 'left-top' &&
    css`
      height: calc(100% - 51px);
      margin-top: 51px;
    `}
  ${p =>
    p.labelPosition === 'center-bottom' &&
    css`
      height: 100%;
    `}
`;
