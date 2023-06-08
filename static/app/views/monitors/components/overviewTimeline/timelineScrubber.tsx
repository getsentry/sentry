import styled from '@emotion/styled';
import moment from 'moment';

import DateTime from 'sentry/components/dateTime';
import {space} from 'sentry/styles/space';
import {useDimensions} from 'sentry/utils/useDimensions';
import {ResolutionValue} from 'sentry/views/monitors/components/overviewTimeline/types';

interface Props {
  end: Date;
  resolution: ResolutionValue;
}

interface ResolutionOptions {
  /**
   * Props to pass to <DateTime> when displaying a time marker
   */
  dateTimeProps: {dateOnly?: boolean; timeOnly?: boolean};
  /**
   * The elapsed minutes based on the selected resolution
   */
  elapsedMinutes: number;
  /**
   * The interval between each grid line and time label in minutes
   */
  timeMarkerInterval: number;
}

// Stores options and data which correspond to each selectable resolution
const resolutionData: Record<ResolutionValue, ResolutionOptions> = {
  '1h': {elapsedMinutes: 60, timeMarkerInterval: 10, dateTimeProps: {timeOnly: true}},
  '24h': {
    elapsedMinutes: 60 * 24,
    timeMarkerInterval: 60 * 4,
    dateTimeProps: {timeOnly: true},
  },
  '7d': {elapsedMinutes: 60 * 24 * 7, timeMarkerInterval: 60 * 24, dateTimeProps: {}},
  '30d': {
    elapsedMinutes: 60 * 24 * 30,
    timeMarkerInterval: 60 * 24 * 5,
    dateTimeProps: {dateOnly: true},
  },
};

function clampTimeBasedOnResolution(date: moment.Moment, resolution: string) {
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

function getTimeMarkers(end: Date, resolution: string, width: number): TimeMarker[] {
  const {elapsedMinutes, timeMarkerInterval} = resolutionData[resolution];
  const msPerPixel = (elapsedMinutes * 60 * 1000) / width;

  const times: TimeMarker[] = [];
  const start = moment(end).subtract(elapsedMinutes, 'minute');

  // Iterate and generate time markers which represent location of grid lines/time labels
  for (let i = 1; i < elapsedMinutes / timeMarkerInterval; i++) {
    const timeMark = moment(start).add(i * timeMarkerInterval, 'minute');
    clampTimeBasedOnResolution(timeMark, resolution);
    const position = (timeMark.valueOf() - start.valueOf()) / msPerPixel;
    times.push({date: timeMark.toDate(), position});
  }

  return times;
}

export function GridLineTimeLabels({end, resolution}: Props) {
  const {elementRef, width} = useDimensions<HTMLDivElement>();
  return (
    <LabelsContainer ref={elementRef}>
      {getTimeMarkers(end, resolution, width).map(({date, position}) => (
        <TimeLabelContainer key={date.getTime()} left={position}>
          <TimeLabel date={date} {...resolutionData[resolution].dateTimeProps} />
        </TimeLabelContainer>
      ))}
    </LabelsContainer>
  );
}

export function GridLineOverlay({end, resolution}: Props) {
  const {elementRef, width} = useDimensions<HTMLDivElement>();
  return (
    <Overlay ref={elementRef}>
      <GridLineContainer>
        {getTimeMarkers(end, resolution, width).map(({date, position}) => (
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
