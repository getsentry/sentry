import {Fragment} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Text from 'sentry/components/text';
import {Tooltip, TooltipProps} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  JobTickData,
  TimeWindowOptions,
} from 'sentry/views/monitors/components/overviewTimeline/types';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {getColorsFromStatus, statusToText} from 'sentry/views/monitors/utils';

interface Props extends Omit<TooltipProps, 'title'> {
  jobTick: JobTickData;
  timeWindowConfig: TimeWindowOptions;
}

export function JobTickTooltip({jobTick, timeWindowConfig, children, ...props}: Props) {
  const {startTs, endTs, envMapping} = jobTick;
  const {dateLabelFormat} = timeWindowConfig;
  const capturedEnvs = Object.keys(envMapping);
  const representsSingleJob =
    capturedEnvs.length === 1 &&
    Object.values(envMapping[capturedEnvs[0]]).reduce((sum, count) => sum + count, 0) ===
      1;

  const tooltipTitle = (
    <Fragment>
      <TooltipTimeLabel>
        <DateTime date={startTs * 1000} format={dateLabelFormat} />
        {!representsSingleJob && (
          <Fragment>
            <Text>{'\u2014'}</Text>
            <DateTime date={endTs * 1000} format={dateLabelFormat} />
          </Fragment>
        )}
      </TooltipTimeLabel>
      <StatusCountContainer>
        {/* Visually hidden but kept here for accessibility */}
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
  display: block;
  overflow: hidden;
  height: 0;
  width: 0;
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
