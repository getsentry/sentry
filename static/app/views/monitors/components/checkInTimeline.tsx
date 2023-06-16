import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import {Resizeable} from 'sentry/components/replays/resizeable';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {
  JobTickData,
  MonitorBucketData,
  MonitorBucketEnvMapping,
} from 'sentry/views/monitors/components/overviewTimeline/types';
import {
  isEnvMappingEmpty,
  mergeEnvMappings,
} from 'sentry/views/monitors/components/overviewTimeline/utils';
import {CheckInStatus} from 'sentry/views/monitors/types';

interface Props {
  bucketedData: MonitorBucketData;
  end: Date;
  start: Date;
  width?: number;
}

// Orders the status in terms of precedence for showing to the user
const statusOrdering = [
  CheckInStatus.OK,
  CheckInStatus.MISSED,
  CheckInStatus.TIMEOUT,
  CheckInStatus.ERROR,
];

export function getAggregateStatus(envData: MonitorBucketEnvMapping) {
  return Object.values(envData).reduce((currentStatus, value) => {
    for (const [index, status] of statusOrdering.entries()) {
      if (value[status] > 0 && index > statusOrdering.indexOf(currentStatus)) {
        currentStatus = status;
      }
    }
    return currentStatus;
  }, CheckInStatus.OK);
}

export function getAggregateStatusFromMultipleBuckets(
  envDataArr: MonitorBucketEnvMapping[]
) {
  return envDataArr
    .map(getAggregateStatus)
    .reduce(
      (aggregateStatus, currentStatus) =>
        statusOrdering.indexOf(currentStatus) > statusOrdering.indexOf(aggregateStatus)
          ? currentStatus
          : aggregateStatus,
      CheckInStatus.OK
    );
}

function getColorFromStatus(status: CheckInStatus, theme: Theme) {
  const statusToColor: Record<CheckInStatus, string> = {
    [CheckInStatus.ERROR]: theme.red200,
    [CheckInStatus.TIMEOUT]: theme.red200,
    [CheckInStatus.OK]: theme.green200,
    [CheckInStatus.MISSED]: theme.yellow200,
    [CheckInStatus.IN_PROGRESS]: theme.disabled,
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

function generateJobTickFromBucket(
  bucket: MonitorBucketData[number],
  options?: Partial<JobTickData>
) {
  const [timestamp, envMapping] = bucket;
  return {
    endTs: timestamp,
    startTs: timestamp,
    width: 1,
    envMapping,
    roundedLeft: false,
    roundedRight: false,
    ...options,
  };
}

export function mergeBuckets(data: MonitorBucketData) {
  const minTickWidth = 4;

  const jobTicks: JobTickData[] = [];
  data.reduce((currentJobTick, bucket, i) => {
    const [timestamp, envMapping] = bucket;
    const envMappingEmpty = isEnvMappingEmpty(envMapping);
    if (!currentJobTick) {
      return envMappingEmpty
        ? currentJobTick
        : generateJobTickFromBucket(bucket, {roundedLeft: true});
    }
    const bucketStatus = getAggregateStatus(envMapping);
    const currJobTickStatus = getAggregateStatus(currentJobTick.envMapping);
    // If the current bucket is empty and our job tick has reached a min width
    if (envMappingEmpty && currentJobTick.width >= minTickWidth) {
      // Then add our current tick to the running list of job ticks to render
      currentJobTick.roundedRight = true;
      jobTicks.push(currentJobTick);

      return null;
    }

    const nextTickAggregateStatus = getAggregateStatusFromMultipleBuckets(
      data.slice(i, i + minTickWidth).map(([_, envData]) => envData)
    );
    // If the next buckets have a different status from our current job tick
    if (
      bucketStatus !== currJobTickStatus &&
      nextTickAggregateStatus !== currJobTickStatus &&
      currentJobTick.width >= minTickWidth
    ) {
      // Then add our current tick to the running list of job ticks to render
      jobTicks.push(currentJobTick);
      return generateJobTickFromBucket(bucket);
    }

    // Merge our current tick with the current bucket data
    currentJobTick = {
      ...currentJobTick,
      endTs: timestamp,
      envMapping: mergeEnvMappings(currentJobTick.envMapping, envMapping),
      width: currentJobTick.width + 1,
    };

    // Ensure we render the last tick
    if (i === data.length - 1) {
      currentJobTick.roundedRight = true;
      jobTicks.push(currentJobTick);
    }
    return currentJobTick;
  }, null as JobTickData | null);

  return jobTicks;
}

export function CheckInTimeline(props: Props) {
  const {bucketedData, start, end} = props;

  function renderTimelineWithWidth(width: number) {
    const timeWindow = end.getTime() - start.getTime();
    const msPerPixel = timeWindow / width;

    const jobTicks = mergeBuckets(bucketedData);

    return (
      <TimelineContainer>
        {jobTicks.map(
          ({startTs, width: tickWidth, envMapping, roundedLeft, roundedRight}) => {
            const timestampMs = startTs * 1000;
            const left = getBucketedCheckInsPosition(timestampMs, start, msPerPixel);

            return (
              <JobTickContainer style={{left}} key={startTs}>
                <Tooltip title={<DateTime date={timestampMs} seconds />}>
                  <JobTick
                    style={{width: tickWidth}}
                    status={getAggregateStatus(envMapping)}
                    roundedLeft={roundedLeft}
                    roundedRight={roundedRight}
                  />
                </Tooltip>
              </JobTickContainer>
            );
          }
        )}
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
  background: ${p => getColorFromStatus(p.status, p.theme)};
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
