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
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useQueuesByDestinationQuery} from 'sentry/views/performance/queues/queries/useQueuesByDestinationQuery';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {
  SpanFunction,
  SpanIndexedField,
  type SpanMetricsResponse,
} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Row = Pick<
  SpanMetricsResponse,
  | 'sum(span.duration)'
  | 'messaging.destination.name'
  | 'avg(messaging.message.receive.latency)'
  | `avg_if(${string},${string},${string})`
  | `count_op(${string})`
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
  SpanIndexedField.MESSAGING_MESSAGE_DESTINATION_NAME,
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
  return (SORTABLE_FIELDS as ReadonlyArray<string>).includes(sort.field);
}

interface Props {
  sort: ValidSort;
  destination?: string;
  error?: Error | null;
  meta?: EventsMetaType;
}

export function QueuesTable({error, destination, sort}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const {data, isLoading, meta, pageLinks} = useQueuesByDestinationQuery({
    destination,
    sort,
  });

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

  if (key.startsWith('avg')) {
    const renderer = FIELD_FORMATTERS.duration.renderFunc;
    return renderer(key, row);
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

  const renderer = getFieldRenderer(column.key, meta.fields, false);
  return renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
  });
}

function DestinationCell({destination}: {destination: string}) {
  const moduleURL = useModuleURL('queue');
  const {query} = useLocation();
  const queryString = {
    ...query,
    destination,
  };
  return (
    <NoOverflow>
      <Link to={`${moduleURL}/destination/?${qs.stringify(queryString)}`}>
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
