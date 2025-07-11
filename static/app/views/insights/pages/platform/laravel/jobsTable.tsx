import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {HeadSortCell} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {PlatformInsightsTable} from 'sentry/views/insights/pages/platform/shared/table';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {ErrorRateCell} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';
import {useTableData} from 'sentry/views/insights/pages/platform/shared/table/useTableData';

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {
    key: 'transaction',
    name: t('Job'),
    width: COL_WIDTH_UNDEFINED,
  },
  {key: 'messaging.destination.name', name: t('Queue Name'), width: 140},
  {key: 'count()', name: t('Processed'), width: 124},
  {key: 'failure_rate()', name: t('Error Rate'), width: 124},
  {
    key: 'avg(messaging.message.receive.latency)',
    name: t('Avg Time in Queue'),
    width: 164,
  },
  {
    key: 'avg_if(span.duration,span.op,queue.process)',
    name: t('Avg Processing Time'),
    width: 184,
  },
  {key: 'sum(span.duration)', name: t('Time Spent'), width: 120},
];

const rightAlignColumns = new Set([
  'count()',
  'failure_rate()',
  'sum(span.duration)',
  'avg(messaging.message.receive.latency)',
  'avg_if(span.duration,span.op,queue.process)',
]);

export function JobsTable() {
  const tableDataRequest = useTableData({
    query: 'span.op:queue.process',
    fields: [
      'count()',
      'project.id',
      'messaging.destination.name',
      'transaction',
      'avg(messaging.message.receive.latency)',
      'avg_if(span.duration,span.op,queue.process)',
      'failure_rate()',
      'sum(span.duration)',
    ],
    cursorParamName: 'jobsCursor',
    referrer: Referrer.PATHS_TABLE,
  });

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadSortCell
        sortKey={column.key}
        align={rightAlignColumns.has(column.key) ? 'right' : 'left'}
        forceCellGrow={column.key === 'transaction'}
        cursorParamName="jobsCursor"
      >
        {column.name}
      </HeadSortCell>
    );
  }, []);

  const renderBodyCell = useCallback(
    (
      column: GridColumnOrder<string>,
      dataRow: (typeof tableDataRequest.data)[number]
    ) => {
      switch (column.key) {
        case 'messaging.destination.name':
          return <DestinationCell destination={dataRow['messaging.destination.name']} />;
        case 'transaction':
          return (
            <JobCell
              destination={dataRow['messaging.destination.name']}
              transaction={dataRow.transaction}
            />
          );
        case 'failure_rate()':
          return (
            <ErrorRateCell
              errorRate={dataRow['failure_rate()']}
              total={dataRow['count()']}
            />
          );
        case 'avg(messaging.message.receive.latency)':
        case 'avg_if(span.duration,span.op,queue.process)':
          return <DurationCell milliseconds={dataRow[column.key]} />;
        case 'count()':
          return <NumberCell value={dataRow['count()']} />;
        case 'sum(span.duration)':
          return <TimeSpentCell total={dataRow['sum(span.duration)']} />;
        default:
          return <div />;
      }
    },
    [tableDataRequest]
  );

  return (
    <PlatformInsightsTable
      isLoading={tableDataRequest.isPending}
      error={tableDataRequest.error}
      data={tableDataRequest.data}
      initialColumnOrder={defaultColumnOrder}
      stickyHeader
      grid={{
        renderBodyCell,
        renderHeadCell,
      }}
      cursorParamName="jobsCursor"
      pageLinks={tableDataRequest.pageLinks}
      isPlaceholderData={tableDataRequest.isPlaceholderData}
    />
  );
}

function DestinationCell({destination}: {destination: string}) {
  const moduleURL = useModuleURL('queue');
  const {query} = useLocation();
  return (
    <Link
      to={{
        pathname: `${moduleURL}/destination/`,
        query: {
          ...query,
          destination,
        },
      }}
    >
      {destination}
    </Link>
  );
}

const StyledJobLink = styled(Link)`
  ${p => p.theme.overflowEllipsis};
  min-width: 0;
`;

function JobCell({destination, transaction}: {destination: string; transaction: string}) {
  const moduleURL = useModuleURL('queue');
  const {query} = useLocation();
  return (
    <StyledJobLink
      to={{
        pathname: `${moduleURL}/destination/`,
        query: {
          ...query,
          destination,
          transaction,
          'span.op': 'queue.process',
        },
      }}
    >
      {transaction}
    </StyledJobLink>
  );
}
