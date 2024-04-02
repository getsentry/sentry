import {useCallback} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import moment from 'moment';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import DateTime from 'sentry/components/dateTime';
import {space} from 'sentry/styles/space';
import useRouter from 'sentry/utils/useRouter';
import type {TimeWindowConfig} from 'sentry/views/monitors/components/overviewTimeline/types';

import {useTimelineCursor} from './timelineCursor';
import {useTimelineZoom} from './timelineZoom';
import {alignDateToBoundary} from './utils';

interface Props {
  timeWindowConfig: TimeWindowConfig;
  /**
   * The size of the timeline
   */
  width: number;
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

function getTimeMarkersFromConfig(config: TimeWindowConfig, width: number) {
  const {start, end, elapsedMinutes, dateTimeProps} = config;
  const {markerInterval, minimumMarkerInterval} = config;

  const msPerPixel = (elapsedMinutes * 60 * 1000) / width;

  // The first marker will always be the starting time. This always renders the
  // full date and time
  const markers: TimeMarker[] = [
    {
      date: start,
      position: 0,
      dateTimeProps: {},
    },
  ];

  // The mark after the first mark will be aligned to a boundary to make it
  // easier to understand the rest of the marks
  const currentMark = alignDateToBoundary(moment(start), markerInterval);

  // if the current mark is not at least minimumMarkerInterval from the start
  // skip until it is
  while (currentMark.isBefore(moment(start).add(minimumMarkerInterval, 'minutes'))) {
    currentMark.add(markerInterval, 'minute');
  }

  // Generate time markers which represent location of grid lines/time labels.
  // Stop adding markers once there's no more room for more markers
  while (moment(currentMark).add(minimumMarkerInterval, 'minutes').isBefore(end)) {
    const position = (currentMark.valueOf() - start.valueOf()) / msPerPixel;
    markers.push({date: currentMark.toDate(), position, dateTimeProps});
    currentMark.add(markerInterval, 'minutes');
  }

  return markers;
}

export function GridLineTimeLabels({width, timeWindowConfig, className}: Props) {
  const markers = getTimeMarkersFromConfig(timeWindowConfig, width);

  return (
    <LabelsContainer className={className}>
      {markers.map(({date, position, dateTimeProps}) => (
        <TimeLabelContainer key={date.getTime()} left={position}>
          <TimeLabel date={date} {...dateTimeProps} />
        </TimeLabelContainer>
      ))}
    </LabelsContainer>
  );
}

export function GridLineOverlay({
  width,
  timeWindowConfig,
  showCursor,
  stickyCursor,
  allowZoom,
  className,
}: Props) {
  const router = useRouter();
  const {start, dateLabelFormat} = timeWindowConfig;

  const msPerPixel = (timeWindowConfig.elapsedMinutes * 60 * 1000) / width;

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
          start: dateFromPosition(startX).toDate(),
          end: dateFromPosition(endX).toDate(),
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
    enabled: showCursor && !selectionIsActive,
    sticky: stickyCursor,
    labelText: makeCursorLabel,
  });

  const overlayRef = mergeRefs(cursorContainerRef, selectionContainerRef);
  const markers = getTimeMarkersFromConfig(timeWindowConfig, width);

  return (
    <Overlay ref={overlayRef} className={className}>
      {timelineCursor}
      {timelineSelector}
      <GridLineContainer>
        {markers.map(({date, position}) => (
          <Gridline key={date.getTime()} left={position} />
        ))}
      </GridLineContainer>
    </Overlay>
  );
}

const Overlay = styled('div')`
  grid-row: 1;
  grid-column: 3;
  height: 100%;
  width: 100%;
  position: absolute;
  pointer-events: none;
`;

const GridLineContainer = styled('div')`
  margin-left: -1px;
  position: relative;
  height: 100%;
  z-index: 1;
`;

const LabelsContainer = styled('div')`
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
