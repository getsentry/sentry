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

interface Props {
  end: Date;
  start: Date;
  timeWindowConfig: TimeWindowConfig;
  width: number;
  allowZoom?: boolean;
  className?: string;
  showCursor?: boolean;
  stickyCursor?: boolean;
}

/**
 * Aligns a date to a clean offset such as start of minute, hour, day
 * based on the interval of how far each time label is placed.
 */
function alignTimeMarkersToStartOf(date: moment.Moment, timeMarkerInterval: number) {
  if (timeMarkerInterval < 60) {
    date.minute(date.minutes() - (date.minutes() % timeMarkerInterval));
  } else if (timeMarkerInterval < 60 * 24) {
    date.startOf('hour');
  } else {
    date.startOf('day');
  }
}

interface TimeMarker {
  date: Date;
  position: number;
}

function getTimeMarkersFromConfig(
  start: Date,
  end: Date,
  config: TimeWindowConfig,
  width: number
) {
  const {elapsedMinutes, timeMarkerInterval} = config;
  const msPerPixel = (elapsedMinutes * 60 * 1000) / width;

  const times: TimeMarker[] = [];

  const lastTimeMark = moment(end);
  alignTimeMarkersToStartOf(lastTimeMark, timeMarkerInterval);

  // Generate time markers which represent location of grid lines/time labels
  for (let i = 1; i < elapsedMinutes / timeMarkerInterval; i++) {
    const timeMark = moment(lastTimeMark).subtract(i * timeMarkerInterval, 'minute');
    const position = (timeMark.valueOf() - start.valueOf()) / msPerPixel;
    times.push({date: timeMark.toDate(), position});
  }

  return times;
}

export function GridLineTimeLabels({
  width,
  timeWindowConfig,
  start,
  end,
  className,
}: Props) {
  return (
    <LabelsContainer className={className}>
      {getTimeMarkersFromConfig(start, end, timeWindowConfig, width).map(
        ({date, position}) => (
          <TimeLabelContainer key={date.getTime()} left={position}>
            <TimeLabel date={date} {...timeWindowConfig.dateTimeProps} />
          </TimeLabelContainer>
        )
      )}
    </LabelsContainer>
  );
}

export function GridLineOverlay({
  end,
  width,
  timeWindowConfig,
  start,
  showCursor,
  stickyCursor,
  allowZoom,
  className,
}: Props) {
  const router = useRouter();
  const {dateLabelFormat} = timeWindowConfig;

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

  return (
    <Overlay ref={overlayRef} className={className}>
      {timelineCursor}
      {timelineSelector}
      <GridLineContainer>
        {getTimeMarkersFromConfig(start, end, timeWindowConfig, width).map(
          ({date, position}) => (
            <Gridline key={date.getTime()} left={position} />
          )
        )}
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
