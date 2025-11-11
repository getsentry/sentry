import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {
  HeadSortCell,
  useTableSort,
} from 'sentry/views/insights/pages/agents/components/headSortCell';
import {OVERVIEW_PAGE_ALLOWED_OPS as BACKEND_OVERVIEW_PAGE_ALLOWED_OPS} from 'sentry/views/insights/pages/backend/settings';
import {WEB_VITALS_OPS} from 'sentry/views/insights/pages/frontend/settings';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {PlatformInsightsTable} from 'sentry/views/insights/pages/platform/shared/table';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {
  ErrorRateCell,
  getErrorCellIssuesLink,
} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';
import {TransactionCell} from 'sentry/views/insights/pages/platform/shared/table/TransactionCell';
import {useSpanTableData} from 'sentry/views/insights/pages/platform/shared/table/useTableData';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {ModuleName} from 'sentry/views/insights/types';

const pageloadColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'transaction', name: t('Page'), width: COL_WIDTH_UNDEFINED},
  {key: 'span.op', name: t('Operation'), width: 122},
  {key: 'count()', name: t('Views'), width: 122},
  {key: 'failure_rate()', name: t('Error Rate'), width: 122},
  {
    key: 'avg(span.duration)',
    name: t('AVG Duration'),
    width: 140,
  },
  {
    key: 'p95(span.duration)',
    name: t('P95 Duration'),
    width: 140,
  },
  {
    key: 'performance_score(measurements.score.total)',
    name: t('Perf Score'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const rightAlignColumns = new Set([
  'count()',
  'failure_rate()',
  'avg(span.duration)',
  'p95(span.duration)',
]);

export function ClientTable() {
  const organization = useOrganization();
  const hasWebVitalsFlag = organization.features.includes('insight-modules');
  const webVitalsUrl = useModuleURL(ModuleName.VITAL, false, 'frontend');

  const spanOps = [...WEB_VITALS_OPS, 'navigation', 'default'];

  const existingQuery = new MutableSearch('');
  existingQuery.addFilterValue('span.op', `[${spanOps.join(',')}]`);
  existingQuery.addFilterValues('!span.op', BACKEND_OVERVIEW_PAGE_ALLOWED_OPS);
  existingQuery.addFilterValue('is_transaction', 'true');
  existingQuery.addFilterValues('!sentry.origin', ['auto.db.*', 'auto'], false);

  const {query} = useTransactionNameQuery();
  const {tableSort} = useTableSort();
  const tableDataRequest = useSpanTableData({
    query: `${existingQuery.formatString()} ${query ?? ''}`.trim(),
    fields: [
      'transaction',
      'project.id',
      'span.op',
      'count()',
      'failure_rate()',
      'avg(span.duration)',
      'p95(span.duration)',
      'performance_score(measurements.score.total)',
      'count_if(span.op,equals,navigation)',
      'count_if(span.op,equals,pageload)',
    ],
    sort: tableSort,
    referrer: Referrer.CLIENT_TABLE,
  });

  const renderHeadCell = useCallback(
    (column: GridColumnHeader<string>) => {
      return (
        <HeadSortCell
          sortKey={column.key}
          currentSort={tableSort}
          align={rightAlignColumns.has(column.key) ? 'right' : 'left'}
          forceCellGrow={column.key === 'transaction'}
        >
          {column.name}
        </HeadSortCell>
      );
    },
    [tableSort]
  );

  type TableData = (typeof tableDataRequest.data)[number];

  const renderBodyCell = useCallback(
    (column: GridColumnHeader<string>, dataRow: TableData) => {
      if (column.key === 'performance_score(measurements.score.total)') {
        if (!dataRow['count_if(span.op,equals,pageload)']) {
          return <AlignCenter>{' — '}</AlignCenter>;
        }
        return (
          <AlignCenter>
            {hasWebVitalsFlag ? (
              <Link
                to={{
                  pathname: `${webVitalsUrl}/overview/`,
                  query: {
                    transaction: dataRow.transaction,
                  },
                }}
              >
                <PerformanceBadge
                  score={Math.round(
                    dataRow['performance_score(measurements.score.total)'] * 100
                  )}
                />
              </Link>
            ) : (
              <PerformanceBadge
                score={Math.round(
                  dataRow['performance_score(measurements.score.total)'] * 100
                )}
              />
            )}
          </AlignCenter>
        );
      }

      switch (column.key) {
        case 'transaction': {
          return (
            <TransactionCell
              transaction={dataRow.transaction}
              column={column}
              dataRow={dataRow}
              targetView="frontend"
              projectId={dataRow['project.id'].toString()}
              query={
                ['navigation', 'pageload'].includes(dataRow['span.op'])
                  ? `transaction.op:${dataRow['span.op']}`
                  : undefined
              }
            />
          );
        }
        case 'span.op':
          return <div>{dataRow['span.op']}</div>;
        case 'count()':
          return <NumberCell value={dataRow['count()']} />;
        case 'failure_rate()': {
          return (
            <ErrorRateCell
              errorRate={dataRow['failure_rate()']}
              total={dataRow['count()']}
              issuesLink={getErrorCellIssuesLink({
                projectId: dataRow['project.id'],
                query: `transaction:"${dataRow.transaction}"`,
              })}
            />
          );
        }
        case 'avg(span.duration)': {
          return <DurationCell milliseconds={dataRow['avg(span.duration)']} />;
        }
        case 'p95(span.duration)': {
          return <DurationCell milliseconds={dataRow['p95(span.duration)']} />;
        }
        default:
          return <div />;
      }
    },
    [webVitalsUrl, hasWebVitalsFlag]
  );

  const pagesTablePageLinks = tableDataRequest.pageLinks;

  return (
    <PlatformInsightsTable
      isLoading={tableDataRequest.isPending}
      error={tableDataRequest.error}
      data={tableDataRequest.data}
      initialColumnOrder={pageloadColumnOrder as Array<GridColumnOrder<keyof TableData>>}
      stickyHeader
      pageLinks={pagesTablePageLinks}
      isPlaceholderData={tableDataRequest.isPlaceholderData}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
    />
  );
}

const AlignCenter = styled('div')`
  text-align: center;
`;
