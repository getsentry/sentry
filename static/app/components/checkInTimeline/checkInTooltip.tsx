import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import Text from 'sentry/components/text';
import type {TooltipProps} from 'sentry/components/tooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ColorOrAlias} from 'sentry/utils/theme';

import type {JobTickData, TickStyle, TimeWindowConfig} from './types';

interface CheckInTooltipProps<Status extends string> extends Omit<TooltipProps, 'title'> {
  /**
   * The tick that the tooltip is rendered for
   */
  jobTick: JobTickData<Status>;
  /**
   * Maps the job tick status to a human readable label
   */
  statusLabel: Record<Status, string>;
  /**
   * Configures the styling of the tooltip labels
   */
  statusStyle: Record<Status, TickStyle>;
  timeWindowConfig: TimeWindowConfig;
}

export function CheckInTooltip<Status extends string>({
  jobTick,
  timeWindowConfig,
  statusStyle,
  statusLabel,
  children,
  ...props
}: CheckInTooltipProps<Status>) {
  const {startTs, endTs, stats} = jobTick;
  const {dateLabelFormat} = timeWindowConfig;
  const representsSingleJob =
    (Object.values(stats) as number[]).reduce((sum, count) => sum + count, 0) === 1;

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
          {(Object.entries(stats) as [Status, number][]).map(
            ([status, count]) =>
              count > 0 && (
                <tr key={status}>
                  <StatusLabel labelColor={statusStyle[status]?.labelColor ?? 'disabled'}>
                    {statusLabel[status]}
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

const StatusLabel = styled('td')<{labelColor: ColorOrAlias}>`
  color: ${p => p.theme[p.labelColor]};
  text-align: left;
`;

const StatusCount = styled('td')`
  font-variant-numeric: tabular-nums;
`;
