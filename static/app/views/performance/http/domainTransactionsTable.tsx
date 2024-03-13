import type {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {RATE_UNIT_TITLE, RateUnit} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import type {MetricsResponse} from 'sentry/views/starfish/types';

type Row = Pick<MetricsResponse, 'transaction' | 'spm()'>;

type Column = GridColumnHeader<'transaction' | 'spm()'>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'transaction',
    name: t('Transaction'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spm()',
    name: `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
    width: COL_WIDTH_UNDEFINED,
  },
];

interface Props {
  data: Row[];
  isLoading: boolean;
  error?: Error | null;
  meta?: EventsMetaType;
}

export function DomainTransactionsTable({data, isLoading, error, meta}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  return (
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
            sort: undefined,
            location,
            sortParameterName: undefined,
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
