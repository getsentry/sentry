import styled from '@emotion/styled';
import {Location} from 'history';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';

interface Props {
  location: Location;
  traces: any[]; // TODO
}

function ProfileTable({location, traces}: Props) {
  const data = traces.map(row => ({
    flamegraph: row.id,
    status: !row.failed,
    version: row.app_version,
    interaction: row.interaction_name,
    timestamp: row.start_time_unix,
    duration: row.trace_duration_ms,
    deviceModel: row.device_model,
    deviceClass: row.device_class,
  }));

  return (
    <GridEditable
      isLoading={false}
      data={data}
      columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
      columnSortBy={[]}
      grid={{renderBodyCell}}
      location={location}
    />
  );
}

type TableColumnKey =
  | 'flamegraph'
  | 'status'
  | 'version'
  | 'interaction'
  | 'timestamp'
  | 'duration'
  | 'deviceModel'
  | 'deviceClass';

type TableColumn = GridColumnOrder<TableColumnKey>;
type TableDataRow = Record<TableColumnKey, any>;

const COLUMN_ORDER: TableColumnKey[] = [
  'flamegraph',
  'status',
  'version',
  'interaction',
  'timestamp',
  'duration',
  'deviceModel',
  'deviceClass',
];

const COLUMNS: Record<TableColumnKey, TableColumn> = {
  flamegraph: {
    key: 'flamegraph',
    name: t('Flamegraph'),
    width: COL_WIDTH_UNDEFINED,
  },
  status: {
    key: 'status',
    name: t('Status'),
    width: COL_WIDTH_UNDEFINED,
  },
  version: {
    key: 'version',
    name: t('Version'),
    width: COL_WIDTH_UNDEFINED,
  },
  interaction: {
    key: 'interaction',
    name: t('Interaction Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  timestamp: {
    key: 'timestamp',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  duration: {
    key: 'duration',
    name: t('Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  deviceModel: {
    key: 'deviceModel',
    name: t('Device Model'),
    width: COL_WIDTH_UNDEFINED,
  },
  deviceClass: {
    key: 'deviceClass',
    name: t('Device Class'),
    width: COL_WIDTH_UNDEFINED,
  },
};

function renderBodyCell(
  column: TableColumn,
  dataRow: TableDataRow,
  _rowIndex: number,
  _columnIndex: number
) {
  const value = dataRow[column.key];

  switch (column.key) {
    case 'flamegraph':
      // TODO: this needs to be a link
      return <Container>{t('View Flamegraph')}</Container>;
    case 'status':
      return (
        <Container>
          <ProfileStatus status={value} />
        </Container>
      );
    case 'timestamp':
      return (
        <Container>
          <DateTime date={value} />
        </Container>
      );
    case 'duration':
      return (
        <Container>
          <Duration seconds={value / 1000} abbreviation />
        </Container>
      );
    default:
      return <Container>{value}</Container>;
  }
}

function ProfileStatus({status}: {status: boolean}) {
  return status ? (
    <IconCheckmark size="sm" color="green300" isCircled />
  ) : (
    <IconClose size="sm" color="red300" isCircled />
  );
}

export const Container = styled('div')`
  ${overflowEllipsis};
`;

export {ProfileTable};
