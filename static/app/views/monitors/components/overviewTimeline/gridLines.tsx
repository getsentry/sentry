import {useCallback} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import DateTime from 'sentry/components/dateTime';
import {space} from 'sentry/styles/space';
import {TimeWindow} from 'sentry/views/monitors/components/overviewTimeline/types';
import {
  getStartFromTimeWindow,
  timeWindowConfig,
} from 'sentry/views/monitors/components/overviewTimeline/utils';

import {useTimelineCursor} from './timelineCursor';

interface Props {
  end: Date;
  timeWindow: TimeWindow;
  width: number;
  showCursor?: boolean;
}

function clampTimeBasedOnResolution(date: moment.Moment, resolution: string) {
  date.startOf('minute');
  if (resolution === '1h') {
    date.minute(date.minutes() - (date.minutes() % 10));
  } else if (resolution === '30d') {
    date.startOf('day');
  } else {
    date.startOf('hour');
  }
}

interface TimeMarker {
  date: Date;
  position: number;
}

function getTimeMarkers(end: Date, timeWindow: TimeWindow, width: number): TimeMarker[] {
  const {elapsedMinutes, timeMarkerInterval} = timeWindowConfig[timeWindow];
  const msPerPixel = (elapsedMinutes * 60 * 1000) / width;

  const times: TimeMarker[] = [];
  const start = getStartFromTimeWindow(end, timeWindow);

  const firstTimeMark = moment(start);
  clampTimeBasedOnResolution(firstTimeMark, timeWindow);
  // Generate time markers which represent location of grid lines/time labels
  for (let i = 1; i < elapsedMinutes / timeMarkerInterval; i++) {
    const timeMark = moment(firstTimeMark).add(i * timeMarkerInterval, 'minute');
    const position = (timeMark.valueOf() - start.valueOf()) / msPerPixel;
    times.push({date: timeMark.toDate(), position});
  }

  return times;
}

export function GridLineTimeLabels({end, timeWindow, width}: Props) {
  return (
    <LabelsContainer>
      {getTimeMarkers(end, timeWindow, width).map(({date, position}) => (
        <TimeLabelContainer key={date.getTime()} left={position}>
          <TimeLabel date={date} {...timeWindowConfig[timeWindow].dateTimeProps} />
        </TimeLabelContainer>
      ))}
    </LabelsContainer>
  );
}

export function GridLineOverlay({end, timeWindow, width, showCursor}: Props) {
  const {cursorLabelFormat} = timeWindowConfig[timeWindow];

  const makeCursorText = useCallback(
    (percentPosition: number) => {
      const start = getStartFromTimeWindow(end, timeWindow);
      const timeOffset = (end.getTime() - start.getTime()) * percentPosition;

      return moment(start.getTime() + timeOffset).format(cursorLabelFormat);
    },
    [cursorLabelFormat, end, timeWindow]
  );

  const {cursorContainerRef, timelineCursor} = useTimelineCursor<HTMLDivElement>({
    enabled: showCursor,
    labelText: makeCursorText,
  });

  return (
    <Overlay ref={cursorContainerRef}>
      {timelineCursor}
      <GridLineContainer>
        {getTimeMarkers(end, timeWindow, width).map(({date, position}) => (
          <Gridline key={date.getTime()} left={position} />
        ))}
      </GridLineContainer>
    </Overlay>
  );
}

const Overlay = styled('div')`
  grid-row: 1;
  grid-column: 2;
  height: 100%;
  width: 100%;
  position: absolute;
  pointer-events: none;
`;

const GridLineContainer = styled('div')`
  position: relative;
  height: 100%;
`;

const LabelsContainer = styled('div')`
  position: relative;
  align-self: stretch;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const Gridline = styled('div')<{left: number}>`
  position: absolute;
  left: ${p => p.left}px;
  border-left: 1px solid ${p => p.theme.innerBorder};
  height: 100%;
`;

const TimeLabelContainer = styled(Gridline)`
  display: flex;
  height: 100%;
  align-items: center;
`;

const TimeLabel = styled(DateTime)`
  font-variant-numeric: tabular-nums;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-left: ${space(1)};
`;
