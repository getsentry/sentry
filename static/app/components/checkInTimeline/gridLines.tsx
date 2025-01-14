import {useCallback} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import moment from 'moment-timezone';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {DateTime} from 'sentry/components/dateTime';
import {space} from 'sentry/styles/space';
import useRouter from 'sentry/utils/useRouter';

import {useTimelineCursor} from './timelineCursor';
import {useTimelineZoom} from './timelineZoom';
import type {TimeWindowConfig} from './types';

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
}

export function GridLineLabels({timeWindowConfig, className}: GridLineLabelsProps) {
  const markers = getTimeMarkersFromConfig(timeWindowConfig);

  return (
    <LabelsContainer aria-hidden className={className}>
      {markers.map(({date, position, dateTimeProps}) => (
        <TimeLabelContainer key={date.getTime()} left={position}>
          <TimeLabel date={date} {...dateTimeProps} />
        </TimeLabelContainer>
      ))}
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
  allowZoom,
  className,
}: GridLineOverlayProps) {
  const router = useRouter();
  const {start, timelineWidth, dateLabelFormat} = timeWindowConfig;

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
        router
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
    labelText: makeCursorLabel,
  });

  const overlayRef = mergeRefs(cursorContainerRef, selectionContainerRef);
  const markers = getTimeMarkersFromConfig(timeWindowConfig);

  // Skip first gridline, this will be represented as a border on the
  // LabelsContainer
  markers.shift();

  return (
    <Overlay aria-hidden ref={overlayRef} className={className}>
      {timelineCursor}
      {timelineSelector}
      {additionalUi}
      <GridLineContainer>
        {markers.map(({date, position}) => (
          <Gridline key={date.getTime()} left={position} />
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
  height: 100%;
  z-index: 1;
  pointer-events: none;
`;

const LabelsContainer = styled('div')`
  height: 50px;
  box-shadow: -1px 0 0 ${p => p.theme.translucentInnerBorder};
  position: relative;
  align-self: stretch;
`;

const Gridline = styled('div')<{left: number}>`
  position: absolute;
  left: ${p => p.left}px;
  border-left: 1px solid ${p => p.theme.translucentInnerBorder};
  height: 100%;
`;

const TimeLabelContainer = styled(Gridline)`
  display: flex;
  height: 100%;
  align-items: center;
  border-left: none;
`;

const TimeLabel = styled(DateTime)`
  font-variant-numeric: tabular-nums;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-left: ${space(1)};
`;
