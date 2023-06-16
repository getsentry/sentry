import {Fragment} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Text from 'sentry/components/text';
import {space} from 'sentry/styles/space';
import {
  JobTickData,
  TimeWindow,
} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {getColorsFromStatus, statusToText} from 'sentry/views/monitors/utils';

import {timeWindowData} from './utils';

interface Props {
  jobTick: JobTickData;
  timeWindow: TimeWindow;
}

export function JobTickTooltip({jobTick, timeWindow}: Props) {
  const {startTs, endTs, envMapping} = jobTick;
  const {dateTimeProps} = timeWindowData[timeWindow];
  const capturedEnvs = Object.keys(envMapping);
  const representsSingleJob =
    capturedEnvs.length === 1 &&
    Object.values(envMapping[capturedEnvs[0]]).reduce((sum, count) => sum + count, 0) ===
      1;

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
                  {/* TODO(davidenwang): fix types to remove "as" here */}
                  <StatusLabel status={status as CheckInStatus}>
                    {statusToText[status]}
                  </StatusLabel>
                  {/* TODO(davidenwang): handle long env names */}
                  <Text>{envName}</Text>
                  <StatusCount>{count}</StatusCount>
                </Fragment>
              )
          )
        )}
      </StatusCountContainer>
    </Fragment>
  );
}

const StatusCountContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(0.5)} ${space(1)};
`;

const TooltipTimeLabel = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  margin-bottom: ${space(0.5)};
  justify-content: center;
`;

const StatusLabel = styled(Text)<{status: CheckInStatus}>`
  color: ${p => getColorsFromStatus(p.status, p.theme).labelColor};
  text-align: left;
`;

const StatusCount = styled(Text)`
  font-variant-numeric: tabular-nums;
`;
