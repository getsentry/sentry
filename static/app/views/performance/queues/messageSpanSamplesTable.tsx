import type {ComponentProps} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {MessageActorType} from 'sentry/views/performance/queues/settings';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/starfish/components/tableCells/spanIdCell';
import type {IndexedResponse} from 'sentry/views/starfish/types';
import {ModuleName, SpanIndexedField} from 'sentry/views/starfish/types';

type DataRowKeys =
  | SpanIndexedField.PROJECT
  | SpanIndexedField.TRANSACTION_ID
  | SpanIndexedField.TRACE
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.ID
  | SpanIndexedField.SPAN_DESCRIPTION
  | SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE
  | SpanIndexedField.MESSAGING_MESSAGE_RECEIVE_LATENCY
  | SpanIndexedField.MESSAGING_MESSAGE_ID
  | SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT
  | SpanIndexedField.TRACE_STATUS
  | SpanIndexedField.SPAN_DURATION;

type ColumnKeys =
  | SpanIndexedField.ID
  | SpanIndexedField.MESSAGING_MESSAGE_ID
  | SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE
  | SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT
  | SpanIndexedField.TRACE_STATUS
  | SpanIndexedField.SPAN_DURATION;

type DataRow = Pick<IndexedResponse, DataRowKeys>;

type Column = GridColumnHeader<ColumnKeys>;

const CONSUMER_COLUMN_ORDER: Column[] = [
  {
    key: SpanIndexedField.ID,
    name: t('Span ID'),
    width: 150,
  },
  {
    key: SpanIndexedField.MESSAGING_MESSAGE_ID,
    name: t('Message ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.SPAN_DURATION,
    name: t('Processing Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT,
    name: t('Retries'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.TRACE_STATUS,
    name: t('Status'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const PRODUCER_COLUMN_ORDER: Column[] = [
  {
    key: SpanIndexedField.ID,
    name: t('Span ID'),
    width: 150,
  },
  {
    key: SpanIndexedField.MESSAGING_MESSAGE_ID,
    name: t('Message ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE,
    name: t('Message Size'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.TRACE_STATUS,
    name: t('Status'),
    width: COL_WIDTH_UNDEFINED,
  },
];

interface Props {
  data: DataRow[];
  isLoading: boolean;
  type: MessageActorType;
  error?: Error | null;
  highlightedSpanId?: string;
  meta?: EventsMetaType;
  onSampleMouseOut?: ComponentProps<typeof GridEditable>['onRowMouseOut'];
  onSampleMouseOver?: ComponentProps<typeof GridEditable>['onRowMouseOver'];
}

export function MessageSpanSamplesTable({
  data,
  isLoading,
  error,
  meta,
  onSampleMouseOver,
  onSampleMouseOut,
  highlightedSpanId,
  type,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <GridEditable
      aria-label={t('Span Samples')}
      isLoading={isLoading}
      error={error}
      data={data}
      columnOrder={
        type === MessageActorType.PRODUCER ? PRODUCER_COLUMN_ORDER : CONSUMER_COLUMN_ORDER
      }
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
      highlightedRowKey={data.findIndex(row => row.span_id === highlightedSpanId)}
      onRowMouseOver={onSampleMouseOver}
      onRowMouseOut={onSampleMouseOut}
      location={location}
    />
  );
}

function renderBodyCell(
  column: Column,
  row: DataRow,
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

  if (key === SpanIndexedField.ID) {
    return (
      <SpanIdCell
        moduleName={ModuleName.QUEUE}
        projectSlug={row.project}
        traceId={row.trace}
        timestamp={row.timestamp}
        transactionId={row[SpanIndexedField.TRANSACTION_ID]}
        spanId={row[SpanIndexedField.ID]}
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

const AlignRight = styled('span')`
  text-align: right;
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;
