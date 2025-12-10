import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import Placeholder from 'sentry/components/placeholder';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import GridEditable from 'sentry/components/tables/gridEditable';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getShortEventId} from 'sentry/utils/events';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import type {UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';
import {CheckStatus} from 'sentry/views/alerts/rules/uptime/types';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  reasonToText,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';

type Props = {
  traceSampling: boolean;
  uptimeChecks: UptimeCheck[];
};

/**
 * This value is used when a trace was not recorded since the field is required.
 * It will never link to trace, so omit the row to avoid confusion.
 */
const EMPTY_TRACE = '00000000000000000000000000000000';

const emptyCell = '\u2014';

/**
 * The number of system uptime spans that are always recorded for each uptime check.
 */
const SYSTEM_UPTIME_SPAN_COUNT = 7;

export function UptimeChecksGrid({traceSampling, uptimeChecks}: Props) {
  const traceIds = uptimeChecks?.map(check => check.traceId) ?? [];

  const {data: spanCounts, isPending: spanCountLoading} = useSpans(
    {
      limit: 10,
      enabled: traceIds.length > 0,
      search: new MutableSearch('').addDisjunctionFilterValues('trace', traceIds),
      fields: ['trace', 'count()'],
      // Ignore the cursor parameter, since we use that on this page to
      // paginate the checks table.
      noPagination: true,
    },
    'api.uptime-checks-grid'
  );

  const traceSpanCounts = spanCountLoading
    ? undefined
    : Object.fromEntries(
        traceIds.map(traceId => [
          traceId,
          Number(spanCounts.find(row => row.trace === traceId)?.['count()'] ?? 0),
        ])
      );

  return (
    <GridEditable
      emptyMessage={t('No matching uptime checks found')}
      data={uptimeChecks}
      columnOrder={[
        {key: 'timestamp', width: 150, name: t('Timestamp')},
        {key: 'checkStatus', width: 250, name: t('Status')},
        {key: 'httpStatusCode', width: 100, name: t('HTTP Code')},
        {key: 'durationMs', width: 110, name: t('Duration')},
        {key: 'regionName', width: 200, name: t('Region')},
        {key: 'traceId', width: 150, name: t('Trace')},
      ]}
      columnSortBy={[]}
      grid={{
        renderHeadCell: (col: GridColumnOrder) => <Cell>{col.name}</Cell>,
        renderBodyCell: (column, dataRow) => (
          <CheckInBodyCell
            column={column as GridColumnOrder<keyof UptimeCheck>}
            traceSampling={traceSampling}
            check={dataRow}
            spanCount={traceSpanCounts?.[dataRow.traceId]}
          />
        ),
      }}
    />
  );
}

function CheckInBodyCell({
  check,
  column,
  spanCount,
  traceSampling,
}: {
  check: UptimeCheck;
  column: GridColumnOrder<keyof UptimeCheck>;
  spanCount: number | undefined;
  traceSampling: boolean;
}) {
  const theme = useTheme();
  const organization = useOrganization();

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

  const isMiss = checkStatus === CheckStatus.MISSED_WINDOW;

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
      if (isMiss) {
        return <Cell>{emptyCell}</Cell>;
      }
      return (
        <Cell>
          <Duration seconds={durationMs / 1000} abbreviation exact />
        </Cell>
      );
    case 'httpStatusCode': {
      if (isMiss) {
        return <Cell>{emptyCell}</Cell>;
      }
      if (httpStatusCode === null) {
        return <Cell style={{color: theme.subText}}>{t('None')}</Cell>;
      }
      return <Cell>{httpStatusCode}</Cell>;
    }
    case 'checkStatus': {
      const color =
        tickStyle(theme)[checkStatus].labelColor ?? theme.tokens.content.primary;
      const checkStatusReasonLabel = checkStatusReason
        ? reasonToText[checkStatusReason](check)
        : null;
      return (
        <Cell style={{color}}>
          {statusToText[checkStatus]}{' '}
          {checkStatusReasonLabel && t('(%s)', checkStatusReasonLabel)}
        </Cell>
      );
    }
    case 'traceId': {
      if (isMiss || traceId === EMPTY_TRACE) {
        return <Cell>{emptyCell}</Cell>;
      }

      const learnMore = (
        <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/uptime-tracing/" />
      );

      // Check if there are only system spans (no real user spans)
      const hasOnlySystemSpans = spanCount !== undefined && spanCount === 0;
      const totalSpanCount =
        spanCount === undefined ? undefined : spanCount + SYSTEM_UPTIME_SPAN_COUNT;

      const badge =
        totalSpanCount === undefined ? (
          <Placeholder height="20px" width="70px" />
        ) : hasOnlySystemSpans ? (
          <Tooltip
            isHoverable
            title={
              traceSampling
                ? tct(
                    'Only Uptime Spans are present in this trace. Configure your SDKs to see correlated spans across services. [learnMore:Learn more].',
                    {learnMore}
                  )
                : tct(
                    'Span sampling is disabled. Enable sampling to collect trace data. [learnMore:Learn more].',
                    {learnMore}
                  )
            }
          >
            <Tag type="default">{t('%s spans', totalSpanCount)}</Tag>
          </Tooltip>
        ) : (
          <Tag type="info">{t('%s spans', totalSpanCount)}</Tag>
        );

      return (
        <TraceCell>
          <Link
            to={{
              pathname: `/organizations/${organization.slug}/performance/trace/${traceId}/`,
              query: {
                includeUptime: '1',
                timestamp: new Date(timestamp).getTime() / 1000,
              },
            }}
          >
            {getShortEventId(traceId)}
          </Link>
          {badge}
        </TraceCell>
      );
    }
    case 'regionName':
      return <Cell>{isMiss ? emptyCell : check.regionName}</Cell>;
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

const TraceCell = styled(Cell)`
  display: grid;
  grid-template-columns: 65px max-content;
  gap: ${space(1)};
`;
