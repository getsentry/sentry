import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import type {TooltipProps} from '@sentry/scraps/tooltip';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';

import type {JobTickData, TickStyle, TimeWindowConfig} from './types';

const COLUMNS: TableColumnConfig[] = [
  {key: 'status', width: 'max-content'},
  {key: 'count', width: 'max-content'},
  {key: 'unit', width: 'max-content'},
];

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
    <Stack gap="md">
      <Flex justify="center">
        <DateTime date={startTs * 1000} format={dateLabelFormat} />
        {!representsSingleJob && (
          <Fragment>
            <Text>{'\u2014'}</Text>
            <DateTime date={endTs * 1000} format={dateLabelFormat} />
          </Fragment>
        )}
      </Flex>
      <StatusCountTable columns={COLUMNS}>
        <VisuallyHiddenHead>
          <Table.Row>
            <Table.HeadCell>{t('Status')}</Table.HeadCell>
            <Table.HeadCell>{t('Count')}</Table.HeadCell>
            <Table.HeadCell>{t('Unit')}</Table.HeadCell>
          </Table.Row>
        </VisuallyHiddenHead>
        <Table.Body>
          {(Object.entries(stats) as Array<[Status, number]>).map(
            ([status, count]) =>
              count > 0 && (
                <Table.Row key={status}>
                  <Table.Cell
                    style={{
                      color:
                        labelColors[status]?.labelColor ?? theme.tokens.content.disabled,
                    }}
                  >
                    {statusLabel[status]}
                  </Table.Cell>
                  <Table.Cell>
                    <Text tabular>{count}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text variant="muted">{makeUnit(count)}</Text>
                  </Table.Cell>
                </Table.Row>
              )
          )}
        </Table.Body>
      </StatusCountTable>
    </Stack>
  );

  return (
    <Tooltip title={tooltipTitle} skipWrapper maxWidth="none" {...props}>
      {children}
    </Tooltip>
  );
}

const StatusCountTable = styled(Table)`
  column-gap: ${p => p.theme.space.md};
  text-align: left;
`;

const VisuallyHiddenHead = styled(Table.Head)`
  ${p => p.theme.visuallyHidden}
`;
