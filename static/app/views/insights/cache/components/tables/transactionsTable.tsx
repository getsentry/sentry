import {Fragment} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import type {Location} from 'history';

import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {RATE_UNIT_TITLE, RateUnit, type Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {TransactionCell} from 'sentry/views/insights/cache/components/tables/transactionCell';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {
  ModuleName,
  SpanFields,
  SpanFunction,
  type SpanResponse,
} from 'sentry/views/insights/types';

const {CACHE_MISS_RATE, EPM} = SpanFunction;
const {CACHE_ITEM_SIZE} = SpanFields;

type Row = Pick<
  SpanResponse,
  | 'project'
  | 'project.id'
  | 'transaction'
  | 'epm()'
  | 'cache_miss_rate()'
  | 'sum(span.self_time)'
  | 'avg(cache.item_size)'
> &
  Pick<SpanResponse, 'avg(span.duration)'>;

type Column = GridColumnHeader<
  | 'transaction'
  | 'epm()'
  | 'cache_miss_rate()'
  | 'sum(span.self_time)'
  | 'project'
  | 'avg(span.duration)'
  | 'avg(cache.item_size)'
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
    key: `avg(${SpanFields.CACHE_ITEM_SIZE})`,
    name: DataTitles[`avg(${SpanFields.CACHE_ITEM_SIZE})`],
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `${EPM}()`,
    name: `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `avg(${SpanFields.SPAN_DURATION})`,
    name: DataTitles['avg(transaction.duration)'],
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `${CACHE_MISS_RATE}()`,
    name: DataTitles[`${SpanFunction.CACHE_MISS_RATE}()`],
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `sum(span.self_time)`,
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

const SORTABLE_FIELDS = [
  `${EPM}()`,
  `${CACHE_MISS_RATE}()`,
  `sum(span.self_time)`,
  `avg(${CACHE_ITEM_SIZE})`,
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
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();
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
            renderBodyCell(column, row, meta, location, organization, theme),
        }}
      />

      <Pagination
        pageLinks={pageLinks}
        onCursor={handleCursor}
        paginationAnalyticsEvent={(direction: string) => {
          trackAnalytics('insight.general.table_paginate', {
            organization,
            source: ModuleName.CACHE,
            direction,
          });
        }}
      />
    </Fragment>
  );
}

function renderBodyCell(
  column: Column,
  row: Row,
  meta: EventsMetaType | undefined,
  location: Location,
  organization: Organization,
  theme: Theme
) {
  if (column.key === 'transaction') {
    return (
      <TransactionCell
        project={String(row['project.id'])}
        transaction={row.transaction}
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
    theme,
  });
}
