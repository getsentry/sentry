import {Fragment} from 'react';
import type {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {RATE_UNIT_TITLE, RateUnit, type Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TransactionCell} from 'sentry/views/performance/cache/tables/transactionCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {SpanFunction, type SpanMetricsResponse} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

const {CACHE_MISS_RATE, SPM, TIME_SPENT_PERCENTAGE} = SpanFunction;

type Row = Pick<
  SpanMetricsResponse,
  | 'project'
  | 'project.id'
  | 'transaction'
  | 'spm()'
  | 'cache_miss_rate()'
  | 'sum(span.self_time)'
  | 'time_spent_percentage()'
>;

type Column = GridColumnHeader<
  'transaction' | 'spm()' | 'cache_miss_rate()' | 'time_spent_percentage()' | 'project'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'transaction',
    name: t('Transaction'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'project',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `${SPM}()`,
    name: `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `${CACHE_MISS_RATE}()`,
    name: DataTitles.cacheMissRate,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `${TIME_SPENT_PERCENTAGE}()`,
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

const SORTABLE_FIELDS = [
  `${SPM}()`,
  `${CACHE_MISS_RATE}()`,
  `${TIME_SPENT_PERCENTAGE}()`,
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
  error?: Error | null;
  meta?: EventsMetaType;
  pageLinks?: string;
}

export function TransactionsTable({
  data,
  isLoading,
  error,
  meta,
  pageLinks,
  sort,
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
            renderBodyCell(column, row, meta, location, organization),
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
  location: Location,
  organization: Organization
) {
  if (column.key === 'transaction') {
    return (
      <TransactionCell
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
