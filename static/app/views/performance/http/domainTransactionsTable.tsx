import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import type {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {RATE_UNIT_TITLE, RateUnit, type Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TransactionCell} from 'sentry/views/performance/http/transactionCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import type {MetricsResponse} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Row = Pick<
  MetricsResponse,
  | 'project.id'
  | 'transaction'
  | 'transaction.method'
  | 'spm()'
  | 'http_response_rate(2)'
  | 'http_response_rate(4)'
  | 'http_response_rate(5)'
  | 'avg(span.self_time)'
  | 'sum(span.self_time)'
  | 'time_spent_percentage()'
>;

type Column = GridColumnHeader<
  | 'transaction'
  | 'spm()'
  | 'http_response_rate(2)'
  | 'http_response_rate(4)'
  | 'http_response_rate(5)'
  | 'avg(span.self_time)'
  | 'time_spent_percentage()'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'transaction',
    name: t('Found In'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spm()',
    name: `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `http_response_rate(2)`,
    name: t('2XXs'),
    width: 50,
  },
  {
    key: `http_response_rate(4)`,
    name: t('4XXs'),
    width: 50,
  },
  {
    key: `http_response_rate(5)`,
    name: t('5XXs'),
    width: 50,
  },
  {
    key: `avg(span.self_time)`,
    name: DataTitles.avg,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'time_spent_percentage()',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

const SORTABLE_FIELDS = [
  'avg(span.self_time)',
  'spm()',
  'http_response_rate(2)',
  'http_response_rate(4)',
  'http_response_rate(5)',
  'time_spent_percentage()',
] as const;

type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

interface Props {
  data: Row[];
  isLoading: boolean;
  sort: ValidSort;
  domain?: string;
  error?: Error | null;
  meta?: EventsMetaType;
  pageLinks?: string;
}

export function DomainTransactionsTable({
  data,
  isLoading,
  error,
  meta,
  pageLinks,
  sort,
  domain,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
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
            renderBodyCell(column, row, meta, domain, location, organization),
        }}
        location={location}
      />

      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

function renderBodyCell(
  column: Column,
  row: Row,
  meta: EventsMetaType | undefined,
  domain: string | undefined,
  location: Location,
  organization: Organization
) {
  if (column.key === 'transaction') {
    return (
      <TransactionCell
        domain={domain}
        project={String(row['project.id'])}
        transaction={row.transaction}
        transactionMethod={row['transaction.method']}
      />
    );
  }

  if (!meta?.fields) {
    return row[column.key];
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);

  return renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
  });
}
