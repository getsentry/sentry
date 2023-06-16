import styled from '@emotion/styled';

import {Resizeable} from 'sentry/components/replays/resizeable';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {JobTickTooltip} from 'sentry/views/monitors/components/overviewTimeline/jobTickTooltip';
import {
  MonitorBucketData,
  TimeWindow,
} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {getColorsFromStatus} from 'sentry/views/monitors/utils';
import {getAggregateStatus} from 'sentry/views/monitors/utils/getAggregateStatus';
import {mergeBuckets} from 'sentry/views/monitors/utils/mergeBuckets';

interface Props {
  bucketedData: MonitorBucketData;
  end: Date;
  start: Date;
  timeWindow: TimeWindow;
  width?: number;
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
  const {bucketedData, start, end, timeWindow} = props;

  function renderTimelineWithWidth(width: number) {
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
            <JobTickContainer style={{left}} key={startTs}>
              <Tooltip
                title={<JobTickTooltip jobTick={jobTick} timeWindow={timeWindow} />}
                skipWrapper
              >
                <JobTick
                  style={{width: tickWidth}}
                  status={getAggregateStatus(envMapping)}
                  roundedLeft={roundedLeft}
                  roundedRight={roundedRight}
                />
              </Tooltip>
            </JobTickContainer>
          );
        })}
      </TimelineContainer>
    );
  }

  if (props.width) {
    return renderTimelineWithWidth(props.width);
  }

  return <Resizeable>{({width}) => renderTimelineWithWidth(width)}</Resizeable>;
}

const TimelineContainer = styled('div')`
  position: relative;
  height: 14px;
  margin: ${space(2)} 0;
`;

const JobTickContainer = styled('div')`
  position: absolute;
`;

const JobTick = styled('div')<{
  roundedLeft: boolean;
  roundedRight: boolean;
  status: CheckInStatus;
}>`
  background: ${p => getColorsFromStatus(p.status, p.theme).tickColor};
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
