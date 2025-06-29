import {Fragment} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {Link} from 'sentry/components/core/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import type {SpanMetricsResponse} from 'sentry/views/insights/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

type Row = Pick<
  SpanMetricsResponse,
  | 'transaction'
  | 'transaction.method'
  | 'epm()'
  | 'avg(span.self_time)'
  | 'sum(span.self_time)'
>;

type Column = GridColumnHeader<
  'transaction' | 'epm()' | 'avg(span.self_time)' | 'sum(span.self_time)'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'transaction',
    name: t('Found In'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'epm()',
    name: getThroughputTitle('db'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
    name: DataTitles.avg,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sum(span.self_time)',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

type ValidSort = Sort & {
  field: 'avg(span.self_time)' | 'epm()' | 'sum(span.self_time)';
};

interface Props {
  data: Row[];
  isLoading: boolean;
  sort: ValidSort;
  span: Pick<SpanMetricsResponse, SpanMetricsField.SPAN_GROUP | SpanMetricsField.SPAN_OP>;
  error?: Error | null;
  meta?: EventsMetaType;
  pageLinks?: string;
}

export function QueryTransactionsTable({
  data,
  isLoading,
  error,
  meta,
  pageLinks,
  sort,
  span,
}: Props) {
  const theme = useTheme();
  const moduleURL = useModuleURL('db');
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [QueryParameterNames.TRANSACTIONS_CURSOR]: newCursor},
    });
  };

  return (
    <Fragment>
      <GridEditable
        aria-label={t('Transactions')}
        isLoading={isLoading}
        error={error}
        data={data}
        columnOrder={COLUMN_ORDER}
        columnSortBy={[
          {
            key: sort.field,
            order: sort.kind,
          },
        ]}
        grid={{
          renderHeadCell: col =>
            renderHeadCell({
              column: col,
              sort,
              location,
              sortParameterName: QueryParameterNames.TRANSACTIONS_SORT,
            }),
          renderBodyCell: (column, row) =>
            renderBodyCell(
              moduleURL,
              column,
              row,
              meta,
              span,
              location,
              organization,
              theme
            ),
        }}
      />

      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

function renderBodyCell(
  moduleURL: string,
  column: Column,
  row: Row,
  meta: EventsMetaType | undefined,
  span: Pick<SpanMetricsResponse, SpanMetricsField.SPAN_GROUP | SpanMetricsField.SPAN_OP>,
  location: Location,
  organization: Organization,
  theme: Theme
) {
  if (column.key === 'transaction') {
    const label =
      row['transaction.method'] && !row.transaction.startsWith(row['transaction.method'])
        ? `${row['transaction.method']} ${row.transaction}`
        : row.transaction;

    const pathname = `${moduleURL}/spans/span/${encodeURIComponent(span[SpanMetricsField.SPAN_GROUP])}`;

    const query: Record<string, string | undefined> = {
      ...location.query,
      transaction: row.transaction,
      transactionMethod: row['transaction.method'],
    };

    return (
      <OverflowEllipsisTextContainer>
        <Link to={`${pathname}?${qs.stringify(query)}`}>{label}</Link>
      </OverflowEllipsisTextContainer>
    );
  }

  if (!meta || !meta?.fields) {
    return row[column.key];
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);
  const rendered = renderer(
    {...row, 'span.op': span['span.op']},
    {
      location,
      organization,
      unit: meta.units?.[column.key],
      theme,
    }
  );

  return rendered;
}
