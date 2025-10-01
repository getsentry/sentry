import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import GridEditable, {type GridColumnOrder} from 'sentry/components/tables/gridEditable';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getShortEventId} from 'sentry/utils/events';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {UptimeCheck} from 'sentry/views/alerts/rules/uptime/types';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  reasonToText,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';

type Props = {
  traceSampling: boolean;
  isPending?: boolean;
  resizable?: boolean;
  uptimeChecks?: UptimeCheck[];
};

type ColumnKey =
  | 'timestamp'
  | 'checkStatus'
  | 'httpStatusCode'
  | 'durationMs'
  | 'regionName'
  | 'traceId';

/**
 * This value is used when a trace was not recorded since the field is required.
 * It will never link to trace, so omit the row to avoid confusion.
 */
const EMPTY_TRACE = '00000000000000000000000000000000';

/**
 * The number of system uptime spans that are always recorded for each uptime check.
 */
const SYSTEM_UPTIME_SPAN_COUNT = 7;

export function UptimeChecksGrid({
  traceSampling,
  uptimeChecks,
  isPending,
  resizable,
}: Props) {
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

  if (resizable) {
    if (isPending || uptimeChecks === undefined) {
      return <LoadingIndicator />;
    }

    return (
      <GridEditable<UptimeCheck, ColumnKey>
        emptyMessage={t('No matching uptime checks found')}
        data={uptimeChecks ?? []}
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
              column={column.key}
              traceSampling={traceSampling}
              check={dataRow}
              spanCount={traceSpanCounts?.[dataRow.traceId]}
            />
          ),
        }}
      />
    );
  }

  return (
    <Container>
      <UptimeSimpleTable>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell data-column-name="timestamp">
            {t('Timestamp')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="checkStatus">
            {t('Status')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="httpStatusCode">
            {t('HTTP Code')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="durationMs">
            {t('Duration')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="regionName">
            {t('Region')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="traceId">
            {t('Trace')}
          </SimpleTable.HeaderCell>
        </SimpleTable.Header>
        {isPending && <UptimeChecksSkeletonRows />}
        {!isPending && uptimeChecks?.length === 0 && (
          <SimpleTable.Empty>{t('No matching uptime checks found')}</SimpleTable.Empty>
        )}
        {!isPending && uptimeChecks && (
          <Fragment>
            {uptimeChecks.map(check => (
              <SimpleTable.Row
                key={`${check.scheduledCheckTime}-${check.regionName}-${check.traceId}`}
              >
                <SimpleTable.RowCell data-column-name="timestamp">
                  <CheckInBodyCell
                    column="timestamp"
                    traceSampling={traceSampling}
                    check={check}
                    spanCount={traceSpanCounts?.[check.traceId]}
                  />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell data-column-name="checkStatus">
                  <CheckInBodyCell
                    column="checkStatus"
                    traceSampling={traceSampling}
                    check={check}
                    spanCount={traceSpanCounts?.[check.traceId]}
                  />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell data-column-name="httpStatusCode">
                  <CheckInBodyCell
                    column="httpStatusCode"
                    traceSampling={traceSampling}
                    check={check}
                    spanCount={traceSpanCounts?.[check.traceId]}
                  />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell data-column-name="durationMs">
                  <CheckInBodyCell
                    column="durationMs"
                    traceSampling={traceSampling}
                    check={check}
                    spanCount={traceSpanCounts?.[check.traceId]}
                  />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell data-column-name="regionName">
                  <CheckInBodyCell
                    column="regionName"
                    traceSampling={traceSampling}
                    check={check}
                    spanCount={traceSpanCounts?.[check.traceId]}
                  />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell data-column-name="traceId">
                  <CheckInBodyCell
                    column="traceId"
                    traceSampling={traceSampling}
                    check={check}
                    spanCount={traceSpanCounts?.[check.traceId]}
                  />
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))}
          </Fragment>
        )}
      </UptimeSimpleTable>
    </Container>
  );
}

function UptimeChecksSkeletonRows() {
  return (
    <Fragment>
      {Array.from({length: 10}).map((_, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell data-column-name="timestamp">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="checkStatus">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="httpStatusCode">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="durationMs">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="regionName">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="traceId">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

function CheckInBodyCell({
  check,
  column,
  spanCount,
  traceSampling,
}: {
  check: UptimeCheck;
  column: ColumnKey;
  spanCount: number | undefined;
  traceSampling: boolean;
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

  switch (column) {
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
      const color = tickStyle(theme)[checkStatus].labelColor ?? theme.textColor;
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
      if (traceId === EMPTY_TRACE) {
        return <Cell />;
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
              pathname: `/performance/trace/${traceId}/`,
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
    default:
      return <Cell>{check[column]}</Cell>;
  }
}

const Container = styled('div')`
  container-type: inline-size;
`;

const UptimeSimpleTable = styled(SimpleTable)`
  grid-template-columns: 170px 1fr max-content max-content 1fr 1fr;

  @container (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 170px 1fr max-content max-content 1fr;

    [data-column-name='regionName'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 170px 1fr max-content 1fr;

    [data-column-name='httpStatusCode'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 170px 1fr 1fr;

    [data-column-name='durationMs'] {
      display: none;
    }
  }
`;

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
