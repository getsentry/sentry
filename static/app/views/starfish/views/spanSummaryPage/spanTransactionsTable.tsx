import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
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
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {IndexedSpan} from 'sentry/views/starfish/queries/types';
import {
  SpanTransactionMetrics,
  useSpanTransactionMetrics,
} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Row = {
  metrics: SpanTransactionMetrics;
  transaction: string;
};

type Props = {
  span: Pick<IndexedSpan, 'group'>;
  endpoint?: string;
  method?: string;
  onClickTransaction?: (row: Row) => void;
  openSidebar?: boolean;
};

export type TableColumnHeader = GridColumnHeader<keyof Row['metrics']>;

export function SpanTransactionsTable({
  span,
  openSidebar,
  onClickTransaction,
  endpoint,
  method,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const {
    data: spanTransactionMetrics,
    meta,
    isLoading,
    pageLinks,
  } = useSpanTransactionMetrics(span, endpoint ? [endpoint] : undefined);

  const spanTransactionsWithMetrics = spanTransactionMetrics.map(row => {
    return {
      transaction: row.transaction,
      metrics: row,
    };
  });

  const renderHeadCell = (column: TableColumnHeader) => {
    return <span>{column.name}</span>;
  };

  const renderBodyCell = (column: TableColumnHeader, row: Row) => {
    if (column.key === 'transaction') {
      return (
        <TransactionCell
          endpoint={endpoint}
          method={method}
          span={span}
          row={row}
          column={column}
          openSidebar={openSidebar}
          onClickTransactionName={onClickTransaction}
          location={location}
        />
      );
    }

    if (!meta || !meta?.fields) {
      return row[column.key];
    }

    const renderer = getFieldRenderer(column.key, meta.fields, false);
    const rendered = renderer(row.metrics, {
      location,
      organization,
      unit: meta.units?.[column.key],
    });

    return rendered;
  };

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={spanTransactionsWithMetrics}
        columnOrder={COLUMN_ORDER}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
        location={location}
      />
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

type CellProps = {
  column: TableColumnHeader;
  location: Location;
  row: Row;
  span: Pick<IndexedSpan, 'group'>;
  endpoint?: string;
  method?: string;
  onClickTransactionName?: (row: Row) => void;
  openSidebar?: boolean;
};

function TransactionCell({span, column, row, endpoint, method, location}: CellProps) {
  return (
    <Fragment>
      <Link
        to={`/starfish/${extractRoute(location)}/span/${encodeURIComponent(
          span.group
        )}?${qs.stringify({
          endpoint,
          method,
          transaction: row.transaction,
        })}`}
      >
        <Truncate value={row[column.key]} maxLength={75} />
      </Link>
    </Fragment>
  );
}

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'transaction',
    name: 'Found In Endpoints',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sps()',
    name: DataTitles.throughput,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sps_percent_change()',
    name: DataTitles.change,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `p95(${SpanMetricsFields.SPAN_SELF_TIME})`,
    name: DataTitles.p95,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `percentile_percent_change(${SpanMetricsFields.SPAN_SELF_TIME}, 0.95)`,
    name: DataTitles.change,
    width: COL_WIDTH_UNDEFINED,
  },
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
