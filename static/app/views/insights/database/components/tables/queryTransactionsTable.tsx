import {Fragment} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {Link} from '@sentry/scraps/link';

import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import useQueryBasedColumnResize from 'sentry/components/tables/gridEditable/useQueryBasedColumnResize';
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
import type {SpanResponse} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

type Row = Pick<
  SpanResponse,
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
    key: `avg(${SpanFields.SPAN_SELF_TIME})`,
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
  groupId: string;
  isLoading: boolean;
  sort: ValidSort;
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
  groupId,
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
  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: [...COLUMN_ORDER],
  });

  return (
    <Fragment>
      <GridEditable
        aria-label={t('Transactions')}
        isLoading={isLoading}
        error={error}
        data={data}
        columnOrder={columns}
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
              groupId,
              location,
              organization,
              theme
            ),
          onResizeColumn: handleResizeColumn,
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
  groupId: string,
  location: Location,
  organization: Organization,
  theme: Theme
) {
  if (column.key === 'transaction') {
    const label =
      row['transaction.method'] && !row.transaction.startsWith(row['transaction.method'])
        ? `${row['transaction.method']} ${row.transaction}`
        : row.transaction;

    const pathname = `${moduleURL}/spans/span/${encodeURIComponent(groupId)}`;

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
  const rendered = renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
    theme,
  });

  return rendered;
}
