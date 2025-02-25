import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getShortEventId} from 'sentry/utils/events';
import type {UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';
import {
  reasonToText,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';

type Props = {
  uptimeChecks: UptimeCheck[];
};

/**
 * This value is used when a trace was not recorded since the field is required.
 * It will never link to trace, so omit the row to avoid confusion.
 */
const EMPTY_TRACE = '00000000000000000000000000000000';

export function UptimeChecksGrid({uptimeChecks}: Props) {
  return (
    <GridEditable
      emptyMessage={t('No matching uptime checks found')}
      data={uptimeChecks}
      columnOrder={[
        {key: 'timestamp', width: 200, name: t('Timestamp')},
        {key: 'checkStatus', width: 250, name: t('Status')},
        {key: 'httpStatusCode', width: 100, name: t('HTTP Code')},
        {key: 'durationMs', width: 110, name: t('Duration')},
        {key: 'regionName', width: 150, name: t('Region')},
        {key: 'traceId', width: 100, name: t('Trace')},
      ]}
      columnSortBy={[]}
      grid={{
        renderHeadCell: (col: GridColumnOrder) => <Cell>{col.name}</Cell>,
        renderBodyCell: (column, dataRow) => (
          <CheckInBodyCell column={column} check={dataRow} />
        ),
      }}
    />
  );
}

function CheckInBodyCell({
  check,
  column,
}: {
  check: UptimeCheck;
  column: GridColumnOrder<keyof UptimeCheck>;
}) {
  const theme = useTheme();

  const {
    timestamp,
    scheduledCheckTime,
    durationMs,
    checkStatus,
    httpStatusCode,
    checkStatusReason,
    traceId,
  } = check;

  if (check[column.key] === undefined) {
    return <Cell />;
  }

  switch (column.key) {
    case 'timestamp': {
      return (
        <TimeCell>
          <Tooltip
            maxWidth={300}
            isHoverable
            title={t('Checked at %s', <DateTime date={timestamp} seconds />)}
          >
            <DateTime date={scheduledCheckTime} timeZone />
          </Tooltip>
        </TimeCell>
      );
    }
    case 'durationMs':
      return (
        <Cell>
          <Duration seconds={durationMs / 1000} abbreviation exact />
        </Cell>
      );
    case 'httpStatusCode': {
      if (httpStatusCode === null) {
        return <Cell style={{color: theme.subText}}>{t('None')}</Cell>;
      }
      return <Cell>{httpStatusCode}</Cell>;
    }
    case 'checkStatus': {
      const colorKey = tickStyle[checkStatus].labelColor ?? 'textColor';
      return (
        <Cell style={{color: theme[colorKey] as string}}>
          {statusToText[checkStatus]}{' '}
          {checkStatusReason &&
            tct('([reason])', {
              reason: reasonToText[checkStatusReason](check),
            })}
        </Cell>
      );
    }
    case 'traceId':
      if (traceId === EMPTY_TRACE) {
        return <Cell />;
      }
      return (
        <LinkCell to={`/performance/trace/${traceId}/`}>
          {getShortEventId(String(traceId))}
        </LinkCell>
      );
    default:
      return <Cell>{check[column.key]}</Cell>;
  }
}

const Cell = styled('div')`
  display: flex;
  align-items: center;
  text-align: left;
  gap: ${space(1)};
`;

const TimeCell = styled(Cell)`
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-style: dotted;
`;

const LinkCell = styled(Link)`
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.subText};
  cursor: pointer;
  text-decoration-style: dotted;
`;
