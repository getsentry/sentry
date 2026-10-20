import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import type {TooltipProps} from '@sentry/scraps/tooltip';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

import type {JobTickData, TickStyle, TimeWindowConfig} from './types';

const COLUMNS: TableColumnConfig[] = [
  {key: 'status', width: 'max-content'},
  {key: 'count', width: 'max-content'},
  {key: 'unit', width: 'minmax(max-content, 1fr)'},
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
    <Stack gap="sm">
      <Flex justify="center">
        <DateTime date={startTs * 1000} format={dateLabelFormat} />
        {!representsSingleJob && (
          <Fragment>
            <Text>{'\u2014'}</Text>
            <DateTime date={endTs * 1000} format={dateLabelFormat} />
          </Fragment>
        )}
      </Flex>
      {/* An aria-label would replace these counts in the trigger's accessible description. */}
      <SimpleTable
        columns={COLUMNS}
        density="compressed"
        header={
          <VisuallyHiddenHeaderRow>
            <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Count')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Unit')}</SimpleTable.HeaderCell>
          </VisuallyHiddenHeaderRow>
        }
      >
        {(Object.entries(stats) as Array<[Status, number]>).map(
          ([status, count]) =>
            count > 0 && (
              <SimpleTable.Row key={status}>
                <SimpleTable.RowCell
                  style={{
                    color:
                      labelColors[status]?.labelColor ?? theme.tokens.content.disabled,
                  }}
                >
                  {statusLabel[status]}
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text tabular>{count}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text variant="muted">{makeUnit(count)}</Text>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            )
        )}
      </SimpleTable>
    </Stack>
  );

  return (
    // SimpleTable clips rather than overflows, so the default max width would cut
    // off rows with a long status and count.
    <Tooltip title={tooltipTitle} skipWrapper maxWidth="none" {...props}>
      {children}
    </Tooltip>
  );
}

const VisuallyHiddenHeaderRow = styled(SimpleTable.HeaderRow)`
  ${p => p.theme.visuallyHidden}
`;
