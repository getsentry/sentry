import type {Location} from 'history';

import GridEditable, {type GridColumnHeader} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import type {MetricsResponse} from 'sentry/views/starfish/types';

type Row = Pick<MetricsResponse, 'transaction'>;

type Column = GridColumnHeader<'transaction'>;

export function DomainTransactionsTable() {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <GridEditable
      aria-label={t('Transactions')}
      isLoading={false}
      error={null}
      data={[] as Row[]}
      columnOrder={[] as Column[]}
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
          renderBodyCell(column, row, undefined, location, organization),
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
