import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getShortEventId} from 'sentry/utils/events';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {UptimeCheck, UptimeRule} from 'sentry/views/alerts/rules/uptime/types';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  reasonToText,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';

type Props = {
  uptimeChecks: UptimeCheck[];
  uptimeRule: UptimeRule;
};

/**
 * This value is used when a trace was not recorded since the field is required.
 * It will never link to trace, so omit the row to avoid confusion.
 */
const EMPTY_TRACE = '00000000000000000000000000000000';

export function UptimeChecksGrid({uptimeRule, uptimeChecks}: Props) {
  const traceIds = uptimeChecks?.map(check => check.traceId) ?? [];

  const {data: spanCounts, isPending: spanCountLoading} = useEAPSpans(
    {
      limit: 10,
      enabled: traceIds.length > 0,
      search: new MutableSearch('').addDisjunctionFilterValues('trace', traceIds),
      fields: ['trace', 'count()'],
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
          <CheckInBodyCell
            column={column}
            uptimeRule={uptimeRule}
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
  uptimeRule,
}: {
  check: UptimeCheck;
  column: GridColumnOrder<keyof UptimeCheck>;
  spanCount: number | undefined;
  uptimeRule: UptimeRule;
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
    case 'traceId': {
      if (traceId === EMPTY_TRACE) {
        return <Cell />;
      }

      const learnMore = (
        <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/uptime-tracing/" />
      );

      const badge =
        spanCount === undefined ? (
          <Placeholder height="20px" width="70px" />
        ) : spanCount === 0 ? (
          <Tag
            type="default"
            tooltipProps={{isHoverable: true}}
            tooltipText={
              uptimeRule.traceSampling
                ? tct(
                    'No spans found in this trace. Configure your SDKs to see correlated spans across services. [learnMore:Learn more].',
                    {learnMore}
                  )
                : tct(
                    'Span sampling is disabled. Enable sampling to collect trace data. [learnMore:Learn more].',
                    {learnMore}
                  )
            }
          >
            {t('0 spans')}
          </Tag>
        ) : (
          <Tag type="info">{t('%s spans', spanCount)}</Tag>
        );

      return (
        <TraceCell>
          {spanCount ? (
            <Link to={`/performance/trace/${traceId}/`}>{getShortEventId(traceId)}</Link>
          ) : (
            getShortEventId(traceId)
          )}
          {badge}
        </TraceCell>
      );
    }
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
  grid-template-columns: 65px auto;
  gap: ${space(1)};
`;
