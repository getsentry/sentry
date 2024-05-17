import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import qs from 'qs';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {FIELD_FORMATTERS, getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useQueuesByTransactionQuery} from 'sentry/views/performance/queues/queries/useQueuesByTransactionQuery';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {SpanFunction, type SpanMetricsResponse} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Row = Pick<
  SpanMetricsResponse,
  | 'sum(span.duration)'
  | 'transaction'
  | `avg_if(${string},${string},${string})`
  | `count_op(${string})`
>;

type Column = GridColumnHeader<string>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'transaction',
    name: t('Transactions'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span.op',
    name: t('Type'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'avg(messaging.message.receive.latency)',
    name: t('Avg Time in Queue'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'avg_if(span.duration,span.op,queue.process)',
    name: t('Avg Processing Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'trace_status_rate(ok)',
    name: t('Error Rate'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count_op(queue.publish)',
    name: t('Published'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count_op(queue.process)',
    name: t('Processed'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'time_spent_percentage(app,span.duration)',
    name: t('Time Spent'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const SORTABLE_FIELDS = [
  'transaction',
  'count_op(queue.publish)',
  'count_op(queue.process)',
  'avg_if(span.duration,span.op,queue.process)',
  'avg(messaging.message.receive.latency)',
  `${SpanFunction.TIME_SPENT_PERCENTAGE}(app,span.duration)`,
] as const;

type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

const DEFAULT_SORT = {
  field: 'time_spent_percentage(app,span.duration)' as const,
  kind: 'desc' as const,
};

export function TransactionsTable() {
  const organization = useOrganization();
  const location = useLocation();

  const locationQuery = useLocationQuery({
    fields: {
      destination: decodeScalar,
      [QueryParameterNames.DESTINATIONS_SORT]: decodeScalar,
    },
  });
  const sort =
    decodeSorts(locationQuery[QueryParameterNames.DESTINATIONS_SORT])
      .filter(isAValidSort)
      .at(0) ?? DEFAULT_SORT;

  const {data, isLoading, meta, pageLinks, error} = useQueuesByTransactionQuery({
    destination: locationQuery.destination,
    sort,
  });

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
          renderHeadCell: column =>
            renderHeadCell({
              column,
              sort,
              location,
              sortParameterName: QueryParameterNames.DESTINATIONS_SORT,
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
  const op = row['span.op'];
  const isProducer = op === 'queue.publish';
  const isConsumer = op === 'queue.process';
  const key = column.key;
  if (
    row[key] === undefined ||
    (isConsumer && ['count_op(queue.publish)'].includes(key)) ||
    (isProducer &&
      [
        'count_op(queue.process)',
        'avg(messaging.message.receive.latency)',
        'avg_if(span.duration,span.op,queue.process)',
      ].includes(key))
  ) {
    return (
      <AlignRight>
        <NoValue>{' \u2014 '}</NoValue>
      </AlignRight>
    );
  }

  if (key === 'transaction') {
    return <TransactionCell transaction={row[key]} op={op} />;
  }

  // Need to invert trace_status_rate(ok) to show error rate
  if (key === 'trace_status_rate(ok)') {
    const formatter = FIELD_FORMATTERS.percentage.renderFunc;
    return (
      <AlignRight>
        {formatter(key, {'trace_status_rate(ok)': 1 - (row[key] ?? 0)})}
      </AlignRight>
    );
  }

  if (!meta?.fields) {
    return row[column.key];
  }

  if (key.startsWith('avg')) {
    const renderer = FIELD_FORMATTERS.duration.renderFunc;
    return renderer(key, row);
  }

  if (key === 'span.op') {
    switch (row[key]) {
      case 'queue.publish':
        return t('Producer');
      case 'queue.process':
        return t('Consumer');
      default:
        return row[key];
    }
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);
  return renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
  });
}

function TransactionCell({transaction, op}: {op: string; transaction: string}) {
  const moduleURL = useModuleURL('queue');
  const {query} = useLocation();
  const queryString = {
    ...query,
    transaction,
    'span.op': op,
  };
  return (
    <NoOverflow>
      <Link to={`${moduleURL}/destination/?${qs.stringify(queryString)}`}>
        {transaction}
      </Link>
    </NoOverflow>
  );
}

const NoOverflow = styled('span')`
  overflow: hidden;
`;

const AlignRight = styled('span')`
  text-align: right;
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;
