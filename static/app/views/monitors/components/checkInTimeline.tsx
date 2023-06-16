import {Fragment} from 'react';
import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {Resizeable} from 'sentry/components/replays/resizeable';
import Text from 'sentry/components/text';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {
  JobTickData,
  MonitorBucketData,
  TimeWindow,
} from 'sentry/views/monitors/components/overviewTimeline/types';
import {timeWindowData} from 'sentry/views/monitors/components/overviewTimeline/utils';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {statusToText} from 'sentry/views/monitors/utils';
import {getAggregateStatus} from 'sentry/views/monitors/utils/getAggregateStatus';
import {mergeBuckets} from 'sentry/views/monitors/utils/mergeBuckets';

interface Props {
  bucketedData: MonitorBucketData;
  end: Date;
  start: Date;
  timeWindow: TimeWindow;
  width?: number;
}

function getColorsFromStatus(status: CheckInStatus, theme: Theme) {
  const statusToColor: Record<CheckInStatus, {labelColor: string; tickColor: string}> = {
    [CheckInStatus.ERROR]: {tickColor: theme.red200, labelColor: theme.red300},
    [CheckInStatus.TIMEOUT]: {tickColor: theme.red200, labelColor: theme.red300},
    [CheckInStatus.OK]: {tickColor: theme.green200, labelColor: theme.green300},
    [CheckInStatus.MISSED]: {tickColor: theme.yellow200, labelColor: theme.yellow300},
    [CheckInStatus.IN_PROGRESS]: {tickColor: theme.disabled, labelColor: theme.disabled},
  };
  return statusToColor[status];
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

  function JobTickTooltip(jobTick: JobTickData) {
    const {startTs, endTs, envMapping} = jobTick;
    const {dateTimeProps} = timeWindowData[timeWindow];
    const capturedEnvs = Object.keys(envMapping);
    const representsSingleJob =
      capturedEnvs.length === 1 &&
      Object.values(envMapping[capturedEnvs[0]]).reduce(
        (sum, count) => sum + count,
        0
      ) === 1;

    return (
      <Fragment>
        <TooltipTimeLabel>
          <DateTime date={startTs * 1000} {...dateTimeProps} />
          {!representsSingleJob && (
            <Fragment>
              <Text>-</Text>
              <DateTime date={endTs * 1000} {...dateTimeProps} />
            </Fragment>
          )}
        </TooltipTimeLabel>
        <StatusCountContainer>
          {Object.entries(envMapping).map(([envName, statusCounts]) =>
            Object.entries(statusCounts).map(
              ([status, count]) =>
                count > 0 && (
                  <Fragment key={`${envName}:${status}`}>
                    <StatusLabel status={status as CheckInStatus}>
                      {statusToText[status]}
                    </StatusLabel>
                    <div>{envName}</div>
                    <div>{count}</div>
                  </Fragment>
                )
            )
          )}
        </StatusCountContainer>
      </Fragment>
    );
  }

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
              <Tooltip title={JobTickTooltip(jobTick)}>
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

const StatusCountContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(0.5)} ${space(1)};
`;

const TooltipTimeLabel = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  margin-bottom: ${space(0.5)};
`;

const StatusLabel = styled(Text)<{status: CheckInStatus}>`
  color: ${p => getColorsFromStatus(p.status, p.theme).labelColor};
`;
