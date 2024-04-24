import {Fragment} from 'react';
import {browserHistory, Link} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';
import qs from 'qs';

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
import {formatAbbreviatedNumber, formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useQueueByTransactionQuery} from 'sentry/views/performance/queues/queries/useQueuesByTransactionQuery';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import type {MetricsResponse} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Row = Pick<
  MetricsResponse,
  | 'avg_if(span.self_time,span.op,queue.task.celery)'
  | 'count_op(queue.submit.celery)'
  | 'count_op(queue.task.celery)'
  | 'sum(span.self_time)'
  | 'transaction'
>;

type Column = GridColumnHeader<string>;

const COLUMN_ORDER: Column[] = [
  // TODO: Needs to be updated to display an actual destination, not transaction
  {
    key: 'transaction',
    name: t('Destination'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: '', // TODO
    name: t('Avg Time in Queue'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'avg_if(span.self_time,span.op,queue.task.celery)',
    name: t('Avg Processing Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'failure_rate()',
    name: t('Error Rate'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count_op(queue.submit.celery)',
    name: t('Published'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count_op(queue.task.celery)',
    name: t('Processed'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sum(span.self_time)',
    name: t('Time Spent'),
    width: COL_WIDTH_UNDEFINED,
  },
];

interface Props {
  domain?: string;
  error?: Error | null;
  meta?: EventsMetaType;
  pageLinks?: string;
}

export function QueuesTable({error, pageLinks}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const {data, isLoading, meta} = useQueueByTransactionQuery({});

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.TRANSACTIONS_CURSOR]: newCursor},
    });
  };

  return (
    <Fragment>
      <GridEditable
        aria-label={t('Queues')}
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
    return <DestinationCell destination={row[key]} />;
  }

  if (key.startsWith('count')) {
    return <AlignRight>{formatAbbreviatedNumber(row[key])}</AlignRight>;
  }

  if (key === 'failure_rate()') {
    return <AlignRight>{formatPercentage(row[key])}</AlignRight>;
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

function DestinationCell({destination}: {destination: string}) {
  const organization = useOrganization();
  const {query} = useLocation();
  const queryString = {
    ...query,
    destination,
  };
  return (
    <NoOverflow>
      <Link
        to={normalizeUrl(
          `/organizations/${organization.slug}/performance/queues/destination/?${qs.stringify(queryString)}`
        )}
      >
        {destination}
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
