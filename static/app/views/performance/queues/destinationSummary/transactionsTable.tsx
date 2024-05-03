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
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useQueuesByTransactionQuery} from 'sentry/views/performance/queues/queries/useQueuesByTransactionQuery';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import type {SpanMetricsResponse} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Row = Pick<
  SpanMetricsResponse,
  | 'avg_if(span.self_time,span.op,queue.process)'
  | 'count_op(queue.publish)'
  | 'count_op(queue.process)'
  | 'sum(span.self_time)'
  | 'transaction'
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
    key: 'avg_if(span.self_time,span.op,queue.process)',
    name: t('Avg Processing Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: '', // TODO
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
    key: 'sum(span.self_time)',
    name: t('Time Spent'),
    width: COL_WIDTH_UNDEFINED,
  },
];

export function TransactionsTable() {
  const organization = useOrganization();
  const location = useLocation();
  const destination = decodeScalar(location.query.destination);

  const {data, isLoading, meta, pageLinks, error} = useQueuesByTransactionQuery({
    destination,
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
        columnSortBy={[]}
        grid={{
          renderHeadCell: col =>
            renderHeadCell({
              column: col,
              location,
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
  const key = column.key;
  if (row[key] === undefined) {
    return (
      <AlignRight>
        <NoValue>{' \u2014 '}</NoValue>
      </AlignRight>
    );
  }

  if (key === 'transaction') {
    return <TransactionCell transaction={row[key]} />;
  }

  if (!meta?.fields) {
    return row[column.key];
  }

  if (key.startsWith('avg')) {
    const renderer = FIELD_FORMATTERS.duration.renderFunc;
    return renderer(key, row);
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);
  return renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
  });
}

function TransactionCell({transaction}: {transaction: string}) {
  const organization = useOrganization();
  const {query} = useLocation();
  const queryString = {
    ...query,
    transaction,
  };
  return (
    <NoOverflow>
      <Link
        to={normalizeUrl(
          `/organizations/${organization.slug}/performance/queues/destination/?${qs.stringify(queryString)}`
        )}
      >
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
