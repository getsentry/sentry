import {Location} from 'history';

import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {Trace} from 'sentry/types/profiling/core';

import {ProfilingTableCell} from './profilingTableCell';
import {TableColumn, TableColumnKey, TableColumnOrders, TableDataRow} from './types';

interface ProfilingTableProps {
  error: string | null;
  isLoading: boolean;
  location: Location;
  traces: Trace[];
}

function ProfilingTable({error, isLoading, location, traces}: ProfilingTableProps) {
  return (
    <GridEditable
      isLoading={isLoading}
      error={error}
      data={traces}
      columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
      columnSortBy={[]}
      grid={{renderBodyCell: renderProfilingTableCell}}
      location={location}
    />
  );
}

function renderProfilingTableCell(
  column: TableColumn,
  dataRow: TableDataRow,
  rowIndex: number,
  columnIndex: number
) {
  return (
    <ProfilingTableCell
      column={column}
      dataRow={dataRow}
      rowIndex={rowIndex}
      columnIndex={columnIndex}
    />
  );
}

const COLUMN_ORDER: TableColumnKey[] = [
  'failed',
  'id',
  'project_id',
  'transaction_name',
  'version_name',
  'timestamp',
  'trace_duration_ms',
  'device_model',
  'device_classification',
];

const COLUMNS: TableColumnOrders = {
  id: {
    key: 'id',
    name: t('Profile ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  project_id: {
    key: 'project_id',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  failed: {
    key: 'failed',
    name: t('Status'),
    width: 14, // make this as small as possible
  },
  version_name: {
    key: 'version_name',
    name: t('Version'),
    width: COL_WIDTH_UNDEFINED,
  },
  transaction_name: {
    key: 'transaction_name',
    name: t('Transaction Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  timestamp: {
    key: 'timestamp',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  trace_duration_ms: {
    key: 'trace_duration_ms',
    name: t('Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  device_model: {
    key: 'device_model',
    name: t('Device Model'),
    width: COL_WIDTH_UNDEFINED,
  },
  device_classification: {
    key: 'device_classification',
    name: t('Device Classification'),
    width: COL_WIDTH_UNDEFINED,
  },
};

export {ProfilingTable};
