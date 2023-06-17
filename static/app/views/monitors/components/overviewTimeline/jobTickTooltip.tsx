import {ComponentProps, Fragment} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Text from 'sentry/components/text';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  JobTickData,
  TimeWindow,
} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {getColorsFromStatus, statusToText} from 'sentry/views/monitors/utils';

import {timeWindowData} from './utils';

interface Props extends Omit<ComponentProps<typeof Tooltip>, 'title'> {
  jobTick: JobTickData;
  timeWindow: TimeWindow;
}

export function JobTickTooltip({jobTick, timeWindow, children, ...props}: Props) {
  const {startTs, endTs, envMapping} = jobTick;
  const {dateTimeProps} = timeWindowData[timeWindow];
  const capturedEnvs = Object.keys(envMapping);
  const representsSingleJob =
    capturedEnvs.length === 1 &&
    Object.values(envMapping[capturedEnvs[0]]).reduce((sum, count) => sum + count, 0) ===
      1;

  const tooltipTitle = (
    <Fragment>
      <TooltipTimeLabel>
        <DateTime date={startTs * 1000} {...dateTimeProps} />
        {!representsSingleJob && (
          <Fragment>
            <Text>{'\u2014'}</Text>
            <DateTime date={endTs * 1000} {...dateTimeProps} />
          </Fragment>
        )}
      </TooltipTimeLabel>
      <StatusCountContainer>
        <HiddenHeader>
          <tr>
            <td>{t('Status')}</td>
            <td>{t('Environment')}</td>
            <td>{t('Count')}</td>
          </tr>
        </HiddenHeader>
        <tbody>
          {Object.entries(envMapping).map(([envName, statusCounts]) =>
            Object.entries(statusCounts).map(
              ([status, count]) =>
                count > 0 && (
                  <tr key={`${envName}:${status}`}>
                    {/* TODO(davidenwang): fix types to remove "as" here */}
                    <StatusLabel status={status as CheckInStatus}>
                      {statusToText[status]}
                    </StatusLabel>
                    {/* TODO(davidenwang): handle long env names */}
                    <EnvLabel>{envName}</EnvLabel>
                    <StatusCount>{count}</StatusCount>
                  </tr>
                )
            )
          )}
        </tbody>
      </StatusCountContainer>
    </Fragment>
  );

  return (
    <Tooltip title={tooltipTitle} skipWrapper {...props}>
      {children}
    </Tooltip>
  );
}

const StatusCountContainer = styled('table')`
  width: 100%;
  margin: 0;
`;

const TooltipTimeLabel = styled('div')`
  display: flex;
  margin-bottom: ${space(0.5)};
  justify-content: center;
`;

const HiddenHeader = styled('thead')`
  display: none;
`;

const StatusLabel = styled('td')<{status: CheckInStatus}>`
  color: ${p => getColorsFromStatus(p.status, p.theme).labelColor};
  text-align: left;
`;

const StatusCount = styled('td')`
  font-variant-numeric: tabular-nums;
`;

const EnvLabel = styled('td')`
  padding: ${space(0.25)} ${space(0.5)};
`;
