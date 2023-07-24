import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {getColorsFromStatus} from 'sentry/views/monitors/utils';
import {getAggregateStatus} from 'sentry/views/monitors/utils/getAggregateStatus';
import {mergeBuckets} from 'sentry/views/monitors/utils/mergeBuckets';

import {JobTickTooltip} from './jobTickTooltip';
import {MonitorBucketData, TimeWindow} from './types';

interface Props {
  bucketedData: MonitorBucketData;
  end: Date;
  start: Date;
  timeWindow: TimeWindow;
  width: number;
}

function getBucketedCheckInsPosition(
  timestamp: number,
  timelineStart: Date,
  msPerPixel: number
) {
  const elapsedSinceStart = new Date(timestamp).getTime() - timelineStart.getTime();
  return elapsedSinceStart / msPerPixel;
}

export function CheckInTimeline(props: Props) {
  const {bucketedData, start, end, timeWindow, width} = props;

  const elapsedMs = end.getTime() - start.getTime();
  const msPerPixel = elapsedMs / width;

  const jobTicks = mergeBuckets(bucketedData);

  return (
    <TimelineContainer>
      {jobTicks.map(jobTick => {
        const {
          startTs,
          width: tickWidth,
          envMapping,
          roundedLeft,
          roundedRight,
        } = jobTick;
        const timestampMs = startTs * 1000;
        const left = getBucketedCheckInsPosition(timestampMs, start, msPerPixel);

        return (
          <JobTickTooltip
            jobTick={jobTick}
            timeWindow={timeWindow}
            skipWrapper
            key={startTs}
          >
            <JobTick
              style={{left, width: tickWidth}}
              status={getAggregateStatus(envMapping)}
              roundedLeft={roundedLeft}
              roundedRight={roundedRight}
            />
          </JobTickTooltip>
        );
      })}
    </TimelineContainer>
  );
}

const TimelineContainer = styled('div')`
  position: relative;
  height: calc(${p => p.theme.fontSizeLarge} * ${p => p.theme.text.lineHeightHeading});
  margin: ${space(2)} 0;
`;

const JobTick = styled('div')<{
  roundedLeft: boolean;
  roundedRight: boolean;
  status: CheckInStatus;
}>`
  position: absolute;
  top: calc(50% + 1px);
  transform: translateY(-50%);
  background: ${p => getColorsFromStatus(p.status, p.theme).tickColor};
  opacity: 0.7;
  width: 4px;
  height: 14px;
  ${p =>
    p.roundedLeft &&
    `
    border-top-left-radius: 2px;
    border-bottom-left-radius: 2px;
  `}
  ${p =>
    p.roundedRight &&
    `
    border-top-right-radius: 2px;
    border-bottom-right-radius: 2px;
  `}
`;
