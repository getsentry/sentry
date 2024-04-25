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
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/starfish/components/tableCells/spanIdCell';
import type {IndexedResponse} from 'sentry/views/starfish/types';
import {SpanIndexedField} from 'sentry/views/starfish/types';

type DataRowKeys =
  | SpanIndexedField.PROJECT
  | SpanIndexedField.TRANSACTION_ID
  | SpanIndexedField.TRACE
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.ID
  | SpanIndexedField.SPAN_DESCRIPTION
  | SpanIndexedField.RESPONSE_CODE;

type ColumnKeys =
  | SpanIndexedField.ID
  | SpanIndexedField.MESSAGE_ID
  | SpanIndexedField.MESSAGE_SIZE
  | SpanIndexedField.MESSAGE_STATUS
  | SpanIndexedField.SPAN_SELF_TIME;

type DataRow = Pick<IndexedResponse, DataRowKeys>;

type Column = GridColumnHeader<ColumnKeys>;

const COLUMN_ORDER: Column[] = [
  {
    key: SpanIndexedField.ID,
    name: t('Span ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.MESSAGE_ID,
    name: t('Message ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.SPAN_SELF_TIME,
    name: t('Processing Latency'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.MESSAGE_SIZE,
    name: t('Message Size'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.MESSAGE_STATUS,
    name: t('Status'),
    width: COL_WIDTH_UNDEFINED,
  },
];

interface Props {
  data: DataRow[];
  isLoading: boolean;
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
}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <GridEditable
      aria-label={t('Span Samples')}
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
