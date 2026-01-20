import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import type {TooltipProps} from 'sentry/components/core/tooltip';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {JobTickData, TickStyle, TimeWindowConfig} from './types';

interface CheckInTooltipProps<Status extends string> extends Omit<TooltipProps, 'title'> {
  /**
   * The tick that the tooltip is rendered for
   */
  jobTick: JobTickData<Status>;
  /**
   * A function which returns the unit for the row given the count of check-ins.
   */
  makeUnit: (count: number) => React.ReactNode;
  /**
   * Maps the job tick status to a human readable label
   */
  statusLabel: Record<Status, string>;
  /**
   * Configures the styling of the tooltip labels
   */
  statusStyle: TickStyle<Status>;
  timeWindowConfig: TimeWindowConfig;
}

export function CheckInTooltip<Status extends string>({
  jobTick,
  timeWindowConfig,
  statusStyle,
  statusLabel,
  children,
  makeUnit,
  ...props
}: CheckInTooltipProps<Status>) {
  const {startTs, endTs, stats} = jobTick;
  const {dateLabelFormat} = timeWindowConfig;
  const representsSingleJob =
    Object.values<number>(stats).reduce((sum, count) => sum + count, 0) === 1;

  const theme = useTheme();
  const labelColors = statusStyle(theme);

  const tooltipTitle = (
    <Fragment>
      <Flex justify="center">
        <DateTime date={startTs * 1000} format={dateLabelFormat} />
        {!representsSingleJob && (
          <Fragment>
            <Text>{'\u2014'}</Text>
            <DateTime date={endTs * 1000} format={dateLabelFormat} />
          </Fragment>
        )}
      </Flex>
      <StatusCountContainer>
        <thead>
          <tr>
            <td>{t('Status')}</td>
            <td>{t('Count')}</td>
            <td>{t('Unit')}</td>
          </tr>
        </thead>
        <tbody>
          {(Object.entries(stats) as Array<[Status, number]>).map(
            ([status, count]) =>
              count > 0 && (
                <tr key={status}>
                  <StatusLabel
                    labelColor={
                      labelColors[status]?.labelColor ?? theme.tokens.content.disabled
                    }
                  >
                    {statusLabel[status]}
                  </StatusLabel>
                  <StatusCount>{count}</StatusCount>
                  <StatusUnit>{makeUnit(count)}</StatusUnit>
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
  display: grid;
  grid-template-columns: max-content max-content max-content;
  gap: ${space(1)};

  /* Visually hide the tooltip headers but keep them for accessability */
  thead {
    overflow: hidden;
    height: 0;
    gap: 0;
    td {
      width: 0;
    }
  }

  tbody,
  thead,
  tr {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
  }

  td {
    text-align: left;
  }
`;

const StatusLabel = styled('td')<{labelColor: string}>`
  color: ${p => p.labelColor};
`;

const StatusCount = styled('td')`
  font-variant-numeric: tabular-nums;
`;

const StatusUnit = styled('td')`
  color: ${p => p.theme.tokens.content.secondary};
`;
