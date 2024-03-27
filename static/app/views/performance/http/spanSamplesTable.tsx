import styled from '@emotion/styled';
import type {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {TransactionIdCell} from 'sentry/views/starfish/components/tableCells/transactionIdCell';
import type {IndexedResponse} from 'sentry/views/starfish/types';
import {SpanIndexedField} from 'sentry/views/starfish/types';

type ColumnKeys =
  | SpanIndexedField.PROJECT
  | SpanIndexedField.TRANSACTION_ID
  | SpanIndexedField.SPAN_DESCRIPTION
  | SpanIndexedField.RESPONSE_CODE;

type Row = Pick<IndexedResponse, ColumnKeys>;

type Column = GridColumnHeader<ColumnKeys>;

const COLUMN_ORDER: Column[] = [
  {
    key: SpanIndexedField.TRANSACTION_ID,
    name: t('Event ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.RESPONSE_CODE,
    name: t('Status'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.SPAN_DESCRIPTION,
    name: t('URL'),
    width: COL_WIDTH_UNDEFINED,
  },
];

interface Props {
  data: Row[];
  isLoading: boolean;
  error?: Error | null;
  meta?: EventsMetaType;
}

export function SpanSamplesTable({data, isLoading, error, meta}: Props) {
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
      location={location}
    />
  );
}

function renderBodyCell(
  column: Column,
  row: Row,
  meta: EventsMetaType | undefined,
  location: Location,
  organization: Organization
) {
  if (column.key === SpanIndexedField.TRANSACTION_ID) {
    return (
      <TransactionIdCell
        orgSlug={organization.slug}
        projectSlug={row.project}
        transactionId={row[SpanIndexedField.TRANSACTION_ID]}
        spanId={row[SpanIndexedField.ID]}
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
