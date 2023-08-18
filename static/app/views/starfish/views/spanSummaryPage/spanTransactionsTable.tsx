import {Fragment} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import {Button} from 'sentry/components/button';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {Sort} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {
  renderHeadCell,
  SORTABLE_FIELDS,
} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {
  SpanTransactionMetrics,
  useSpanTransactionMetrics,
} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {
  SpanIndexedFields,
  SpanIndexedFieldTypes,
  SpanMetricsFields,
  SpanMetricsFieldTypes,
} from 'sentry/views/starfish/types';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import type {ValidSort} from 'sentry/views/starfish/views/spans/useModuleSort';

type Row = {
  'avg(span.self_time)': number;
  'spm()': number;
  'time_spent_percentage(local)': number;
  transaction: string;
  transactionMethod: string;
} & SpanTransactionMetrics;

type Props = {
  sort: ValidSort;
  span: Pick<
    SpanMetricsFieldTypes,
    SpanMetricsFields.SPAN_GROUP | SpanMetricsFields.SPAN_OP
  >;
  endpoint?: string;
  endpointMethod?: string;
};

export type TableColumnHeader = GridColumnHeader<keyof Row>;

export function SpanTransactionsTable({span, endpoint, endpointMethod, sort}: Props) {
  const location = useLocation();
  const routingContext = useRoutingContext();
  const organization = useOrganization();
  const router = useRouter();

  const {
    data: spanTransactionMetrics = [],
    meta,
    isLoading,
    pageLinks,
  } = useSpanTransactionMetrics(span[SpanMetricsFields.SPAN_GROUP], {
    transactions: endpoint ? [endpoint] : undefined,
    sorts: [sort],
  });

  const spanTransactionsWithMetrics = spanTransactionMetrics.map(row => {
    return {
      ...row,
      transactionMethod: row['transaction.method'],
    };
  });

  const renderBodyCell = (column: TableColumnHeader, row: Row) => {
    if (column.key === 'transaction') {
      const label =
        row.transactionMethod && !row.transaction.startsWith(row.transactionMethod)
          ? `${row.transactionMethod} ${row.transaction}`
          : row.transaction;

      const pathname = `${routingContext.baseURL}/${
        extractRoute(location) ?? 'spans'
      }/span/${encodeURIComponent(span[SpanMetricsFields.SPAN_GROUP])}`;
      const query = {
        ...location.query,
        endpoint,
        endpointMethod,
        transaction: row.transaction,
        transactionMethod: row.transactionMethod,
      };

      return (
        <Link
          to={`${pathname}?${qs.stringify(query)}`}
          onClick={() => {
            router.replace({
              pathname,
              query,
            });
          }}
        >
          <Truncate value={label} maxLength={75} />
        </Link>
      );
    }

    if (!meta || !meta?.fields) {
      return row[column.key];
    }

    const renderer = getFieldRenderer(column.key, meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: meta.units?.[column.key],
    });

    return rendered;
  };

  return (
    <Fragment>
      <VisuallyCompleteWithData
        id="SpanSummary.SpanTransactionsTable"
        hasData={spanTransactionMetrics.length > 0}
      >
        <GridEditable
          isLoading={isLoading}
          data={spanTransactionsWithMetrics}
          columnOrder={getColumnOrder(span)}
          columnSortBy={[]}
          grid={{
            renderHeadCell: col => renderHeadCell({column: col, sort, location}),
            renderBodyCell,
          }}
          location={location}
        />
      </VisuallyCompleteWithData>
      <Footer>
        {endpoint && (
          <Button
            to={{
              pathname: location.pathname,
              query: omit(location.query, 'endpoint'),
            }}
          >
            {t('View More Endpoints')}
          </Button>
        )}
        <StyledPagination pageLinks={pageLinks} />
      </Footer>
    </Fragment>
  );
}

const getColumnOrder = (
  span: Pick<
    SpanIndexedFieldTypes,
    SpanIndexedFields.SPAN_GROUP | SpanIndexedFields.SPAN_OP
  >
): TableColumnHeader[] => [
  {
    key: 'transaction',
    name: 'Found In Endpoints',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spm()',
    name: getThroughputTitle(span[SpanIndexedFields.SPAN_OP]),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `avg(${SpanMetricsFields.SPAN_SELF_TIME})`,
    name: DataTitles.avg,
    width: COL_WIDTH_UNDEFINED,
  },
  ...(span?.['span.op']?.startsWith('http')
    ? ([
        {
          key: `http_error_count()`,
          name: DataTitles.errorCount,
          width: COL_WIDTH_UNDEFINED,
        },
      ] as TableColumnHeader[])
    : []),
  {
    key: 'time_spent_percentage(local)',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

const Footer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
  margin-left: auto;
`;

export function isAValidSort(sort: Sort): sort is ValidSort {
  return SORTABLE_FIELDS.has(sort.field);
}
