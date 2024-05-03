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
import {formatAbbreviatedNumber, formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useQueuesByDestinationQuery} from 'sentry/views/performance/queues/queries/useQueuesByDestinationQuery';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import type {SpanMetricsResponse} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Row = Pick<
  SpanMetricsResponse,
  | 'avg_if(span.self_time,span.op,queue.process)'
  | 'count_op(queue.publish)'
  | 'count_op(queue.process)'
  | 'sum(span.self_time)'
  | 'messaging.destination.name'
  | 'avg(messaging.message.receive.latency)'
>;

type Column = GridColumnHeader<string>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'messaging.destination.name',
    name: t('Destination'),
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
    key: 'failure_rate()',
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

interface Props {
  domain?: string;
  error?: Error | null;
  meta?: EventsMetaType;
}

export function QueuesTable({error}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const {data, isLoading, meta, pageLinks} = useQueuesByDestinationQuery({});

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.DESTINATIONS_CURSOR]: newCursor},
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

  if (key === 'messaging.destination.name' && row[key]) {
    return <DestinationCell destination={row[key]} />;
  }

  if (key.startsWith('count')) {
    return <AlignRight>{formatAbbreviatedNumber(row[key])}</AlignRight>;
  }

  if (key === 'failure_rate()') {
    return <AlignRight>{formatPercentage(row[key])}</AlignRight>;
  }

  if (key.startsWith('avg')) {
    const renderer = FIELD_FORMATTERS.duration.renderFunc;
    return renderer(key, row);
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
