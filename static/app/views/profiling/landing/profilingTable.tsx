import {Location} from 'history';

import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {Trace} from 'sentry/types/profiling/trace';

import {ProfilingTableCell} from './profilingTableCell';
import {TableColumnKey, TableColumnOrders} from './types';

interface ProfilingTableProps {
  location: Location;
  traces: Trace[];
}

function ProfilingTable({location, traces}: ProfilingTableProps) {
  return (
    <GridEditable
      isLoading={false}
      data={traces}
      columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
      columnSortBy={[]}
      grid={{renderBodyCell: ProfilingTableCell}}
      location={location}
    />
  );
}

const COLUMN_ORDER: TableColumnKey[] = [
  'id',
  'failed',
  'app_version',
  'interaction_name',
  'start_time_unix',
  'trace_duration_ms',
  'device_model',
  'device_class',
];

const COLUMNS: TableColumnOrders = {
  id: {
    key: 'id',
    name: t('Flamegraph'),
    width: COL_WIDTH_UNDEFINED,
  },
  failed: {
    key: 'failed',
    name: t('Status'),
    width: COL_WIDTH_UNDEFINED,
  },
  app_version: {
    key: 'app_version',
    name: t('Version'),
    width: COL_WIDTH_UNDEFINED,
  },
  interaction_name: {
    key: 'interaction_name',
    name: t('Interaction Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  start_time_unix: {
    key: 'start_time_unix',
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
  device_class: {
    key: 'device_class',
    name: t('Device Class'),
    width: COL_WIDTH_UNDEFINED,
  },
};

export {ProfilingTable};
