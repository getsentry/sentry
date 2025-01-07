import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import Text from 'sentry/components/text';
import type {TooltipProps} from 'sentry/components/tooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {CheckInStatus} from 'sentry/views/monitors/types';
import {statusToText, tickStyle} from 'sentry/views/monitors/utils';

import type {JobTickDataWithStats, TimeWindowConfig} from './types';

interface Props extends Omit<TooltipProps, 'title'> {
  jobTick: JobTickDataWithStats;
  timeWindowConfig: TimeWindowConfig;
}

export function CheckInTooltip({jobTick, timeWindowConfig, children, ...props}: Props) {
  const {startTs, endTs, stats} = jobTick;
  const {dateLabelFormat} = timeWindowConfig;
  const representsSingleJob =
    Object.values(stats).reduce((sum, count) => sum + count, 0) === 1;

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
            <td>{t('Count')}</td>
          </tr>
        </HiddenHeader>
        <tbody>
          {Object.entries(stats).map(
            ([status, count]) =>
              count > 0 && (
                <tr key={`${status}`}>
                  {/* TODO(davidenwang): fix types to remove "as" here */}
                  <StatusLabel status={status as CheckInStatus}>
                    {statusToText[status]}
                  </StatusLabel>
                  <StatusCount>{count}</StatusCount>
                </tr>
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
  color: ${p => p.theme[tickStyle[p.status].labelColor]};
  text-align: left;
`;

const StatusCount = styled('td')`
  font-variant-numeric: tabular-nums;
`;
