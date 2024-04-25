import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import type {MetricsResponse, SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {SpanIndexedField, SpanMetricsField} from 'sentry/views/starfish/types';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

type Row = Pick<
  MetricsResponse,
  | 'transaction'
  | 'transaction.method'
  | 'spm()'
  | 'avg(span.self_time)'
  | 'sum(span.self_time)'
  | 'time_spent_percentage()'
>;

type Column = GridColumnHeader<
  'transaction' | 'spm()' | 'avg(span.self_time)' | 'time_spent_percentage()'
>;

const SORTABLE_FIELDS = [
  'avg(span.self_time)',
  'spm()',
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
  span: Pick<MetricsResponse, SpanMetricsField.SPAN_GROUP | SpanMetricsField.SPAN_OP>;
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
  const location = useLocation();
  const routingContext = useRoutingContext();
  const organization = useOrganization();
  const router = useRouter();

  const renderBodyCell = (column: Column, row: Row) => {
    if (column.key === 'transaction') {
      const label =
        row['transaction.method'] &&
        !row.transaction.startsWith(row['transaction.method'])
          ? `${row['transaction.method']} ${row.transaction}`
          : row.transaction;

      const pathname = normalizeUrl(
        `/organizations/${organization.slug}${routingContext.baseURL}/${
          extractRoute(location) ?? 'spans'
        }/span/${encodeURIComponent(span[SpanMetricsField.SPAN_GROUP])}`
      );
      const query: {[key: string]: string | undefined} = {
        ...location.query,
        endpoint: row.transaction,
        endpointMethod: row['transaction.method'],
        transaction: row.transaction,
      };

      if (row['transaction.method']) {
        query.transactionMethod = row['transaction.method'];
      }

      return (
        <OverflowEllipsisTextContainer>
          <Link
            to={`${pathname}?${qs.stringify(query)}`}
            onClick={() => {
              router.replace({
                pathname,
                query,
              });
            }}
          >
            {label}
          </Link>
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
      }
    );

    return rendered;
  };

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.ENDPOINTS_CURSOR]: newCursor},
    });
  };

  return (
    <Fragment>
      <GridEditable
        aria-label={t('Transactions')}
        isLoading={isLoading}
        error={error}
        data={data}
        columnOrder={getColumnOrder(span)}
        columnSortBy={[]}
        grid={{
          renderHeadCell: col =>
            renderHeadCell({
              column: col,
              sort,
              location,
              sortParameterName: QueryParameterNames.ENDPOINTS_SORT,
            }),
          renderBodyCell,
        }}
        location={location}
      />
      <Footer>
        <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
      </Footer>
    </Fragment>
  );
}

const getColumnOrder = (
  span: Pick<
    SpanIndexedFieldTypes,
    SpanIndexedField.SPAN_GROUP | SpanIndexedField.SPAN_OP
  >
): Column[] => [
  {
    key: 'transaction',
    name: t('Found In'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spm()',
    name: getThroughputTitle(span[SpanIndexedField.SPAN_OP]),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
    name: DataTitles.avg,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'time_spent_percentage()',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

const Footer = styled('div')`
  display: flex;
  justify-content: space-between;
`;
