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
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/insights/common/components/tableCells/spanIdCell';
import type {SpanIndexedResponse} from 'sentry/views/insights/types';
import {ModuleName, SpanIndexedField} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

type DataRowKeys =
  | SpanIndexedField.PROJECT
  | SpanIndexedField.TRANSACTION_ID
  | SpanIndexedField.TRACE
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.SPAN_ID
  | SpanIndexedField.SPAN_DESCRIPTION
  | SpanIndexedField.RESPONSE_CODE;

type ColumnKeys =
  | SpanIndexedField.SPAN_ID
  | SpanIndexedField.SPAN_DESCRIPTION
  | SpanIndexedField.RESPONSE_CODE;

type DataRow = Pick<SpanIndexedResponse, DataRowKeys>;

type Column = GridColumnHeader<ColumnKeys>;

const COLUMN_ORDER: Column[] = [
  {
    key: SpanIndexedField.SPAN_ID,
    name: t('Span ID'),
    width: 150,
  },
  {
    key: SpanIndexedField.RESPONSE_CODE,
    name: t('Status'),
    width: 50,
  },
  {
    key: SpanIndexedField.SPAN_DESCRIPTION,
    name: t('URL'),
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
  referrer?: string;
}

export function SpanSamplesTable({
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
  if (column.key === SpanIndexedField.SPAN_ID) {
    return (
      <SpanIdCell
        moduleName={ModuleName.HTTP}
        projectSlug={row.project}
        traceId={row.trace}
        timestamp={row.timestamp}
        transactionId={row[SpanIndexedField.TRANSACTION_ID]}
        spanId={row[SpanIndexedField.SPAN_ID]}
        source={TraceViewSources.REQUESTS_MODULE}
        location={location}
      />
    );
  }

  if (column.key === SpanIndexedField.SPAN_DESCRIPTION) {
    return <SpanDescriptionCell>{row[column.key]}</SpanDescriptionCell>;
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

const SpanDescriptionCell = styled('span')`
  word-break: break-word;
`;
